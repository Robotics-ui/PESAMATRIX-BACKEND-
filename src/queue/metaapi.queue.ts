import { Queue, Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import MetaApi from 'metaapi.cloud-sdk';
import CopyFactory from 'metaapi.cloud-copyfactory-sdk';
import { ENV } from '../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const metaApi = new MetaApi(ENV.METAAPI_TOKEN);
const copyFactory = new CopyFactory(ENV.METAAPI_TOKEN);

export const metaApiQueue = new Queue('MetaApiTasks', queueConnectionOptions);

export const metaApiWorker = new Worker(
  'MetaApiTasks',
  async (job: Job) => {
    const { type, payload } = job.data;

    switch (type) {
      case 'PROVISION_TERMINAL': {
        const { accountId, login, password, server } = payload;

        try {
          const account = await metaApi.metatraderAccountApi.createAccount({
            name: `PesaMatrix_${login}`,
            type: 'cloud-g2',
            platform: 'mt5',
            login: login,
            password: password,
            server: server,
            magic: 10001,
            quoteStreamingIntervalInSeconds: 2.5
          });

          await prisma.tradingAccount.update({
            where: { id: accountId },
            data: {
              metaApiAccountId: account.id,
              connectionStatus: 'CONNECTED'
            }
          });

          await account.deploy();
          await account.waitConnected();
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
            name: name,
            description: `PesaMatrix copy trading strategy for ${name}`,
            accountId: masterMetaApiId,
          });

          await prisma.copyStrategy.update({
            where: { id: strategyId },
            data: { metaApiStrategyId: newStrategyId }
          });
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
            subscriptions: [
              {
                strategyId: strategyMetaApiId,
                multiplier: riskMultiplier
              }
            ]
          });

          await prisma.strategySubscription.update({
            where: { id: subscriptionId },
            data: {
              metaApiSubscriberId: subscriberMetaApiId,
              isActive: true
            }
          });
        } catch (error: any) {
          throw new Error(`Failed linking subscriber to network strategy: ${error.message}`);
        }
        break;
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 5 }
);
