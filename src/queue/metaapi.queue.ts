import { Queue, Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { ENV, IS_REDIS_CONFIGURED, IS_METAAPI_CONFIGURED } from '../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getMetaApi = () => {
  if (!IS_METAAPI_CONFIGURED) throw new Error('METAAPI_TOKEN not configured');
  const MetaApi = require('metaapi.cloud-sdk').default;
  return new MetaApi(ENV.METAAPI_TOKEN);
};

const getCopyFactory = () => {
  if (!IS_METAAPI_CONFIGURED) throw new Error('METAAPI_TOKEN not configured');
  const CopyFactory = require('metaapi.cloud-copyfactory-sdk').default;
  return new CopyFactory(ENV.METAAPI_TOKEN);
};

const createQueue = () => new Queue('MetaApiTasks', queueConnectionOptions);

const createWorker = () => new Worker(
  'MetaApiTasks',
  async (job: Job) => {
    const { type, payload } = job.data;
    const metaApi = getMetaApi();
    const copyFactory = getCopyFactory();

    switch (type) {
      case 'PROVISION_TERMINAL': {
        const { accountId, login, password, server } = payload;
        try {
          const account = await metaApi.metatraderAccountApi.createAccount({
            name: `PesaMatrix_${login}`,
            type: 'cloud-g2',
            platform: 'mt5',
            login,
            password,
            server,
            magic: 10001,
            quoteStreamingIntervalInSeconds: 2.5
          });

          await prisma.tradingAccount.update({
            where: { id: accountId },
            data: { metaApiAccountId: account.id, connectionStatus: 'CONNECTED' }
          });

          await account.deploy();
          await account.waitConnected();
          console.log(`[MetaApi] Terminal provisioned for account ${accountId}`);
        } catch (error: any) {
          await prisma.tradingAccount.update({
            where: { id: accountId },
            data: { connectionStatus: 'FAILED' }
          });
          throw new Error(`Failed to spin up cloud terminal: ${error.message}`);
        }
        break;
      }

      case 'CREATE_COPY_STRATEGY': {
        const { strategyId, masterMetaApiId, name } = payload;
        try {
          const configApi = copyFactory.configurationApi;
          const { id: newStrategyId } = await configApi.generateStrategyId();

          await configApi.updateStrategy(newStrategyId, {
            name,
            description: `PesaMatrix copy trading strategy for ${name}`,
            accountId: masterMetaApiId,
          });

          await prisma.copyStrategy.update({
            where: { id: strategyId },
            data: { metaApiStrategyId: newStrategyId }
          });

          console.log(`[MetaApi] CopyFactory strategy created: ${newStrategyId}`);
        } catch (error: any) {
          throw new Error(`Failed to initialize strategy inside CopyFactory: ${error.message}`);
        }
        break;
      }

      case 'SUBSCRIBE_ACCOUNT': {
        const { subscriptionId, strategyMetaApiId, subscriberMetaApiId, riskMultiplier } = payload;
        try {
          const configApi = copyFactory.configurationApi;

          await configApi.updateSubscriber(subscriberMetaApiId, {
            name: `PesaMatrix_subscriber_${subscriberMetaApiId}`,
            subscriptions: [{ strategyId: strategyMetaApiId, multiplier: riskMultiplier }]
          });

          await prisma.strategySubscription.update({
            where: { id: subscriptionId },
            data: { metaApiSubscriberId: subscriberMetaApiId, isActive: true }
          });

          console.log(`[MetaApi] Subscriber ${subscriberMetaApiId} linked to strategy ${strategyMetaApiId}`);
        } catch (error: any) {
          throw new Error(`Failed linking subscriber to network strategy: ${error.message}`);
        }
        break;
      }

      case 'UNSUBSCRIBE_ACCOUNT': {
        const { subscriptionId, subscriberMetaApiId } = payload;
        try {
          const configApi = copyFactory.configurationApi;
          await configApi.removeSubscriber(subscriberMetaApiId);

          await prisma.strategySubscription.update({
            where: { id: subscriptionId },
            data: { isActive: false }
          });

          console.log(`[MetaApi] Subscriber ${subscriberMetaApiId} removed from strategy`);
        } catch (error: any) {
          throw new Error(`Failed to unsubscribe account: ${error.message}`);
        }
        break;
      }

      case 'LOG_REPLICATION_EVENT': {
        const { masterTradeId, subscriberAccountId, strategyId, symbol, action, volume, status, errorMessage } = payload;
        try {
          await prisma.tradeReplicationLog.create({
            data: {
              masterTradeId,
              subscriberAccountId,
              strategyId,
              symbol,
              action,
              volume,
              status,
              errorMessage: errorMessage || null
            }
          });

          if (status === 'FAILED') {
            console.error(`[Replication FAILED] Trade ${masterTradeId} → Subscriber ${subscriberAccountId}: ${errorMessage}`);
          } else {
            console.log(`[Replication ${status}] Trade ${masterTradeId} → Subscriber ${subscriberAccountId} [${action}]`);
          }
        } catch (error: any) {
          console.error(`[Replication Log Error] ${error.message}`);
        }
        break;
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 5 }
);

export const metaApiQueue = IS_REDIS_CONFIGURED ? createQueue() : null as any;
export const metaApiWorker = IS_REDIS_CONFIGURED ? createWorker() : null as any;
