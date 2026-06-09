import { Queue, Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import MetaApi from 'metaapi.cloud-sdk';
import { ENV } from '../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const metaApi = new MetaApi(ENV.METAAPI_TOKEN);

export const metaApiQueue = new Queue('MetaApiTasks', queueConnectionOptions);

export const metaApiWorker = new Worker(
  'MetaApiTasks',
  async (job: Job) => {
    const { type, payload } = job.data;

    switch (type) {
      case 'PROVISION_TERMINAL': {
        const { accountId, login, password, server } = payload;
        
        try {
          // 1. Instruct MetaApi to provision a pure cloud infrastructure terminal
          const account = await metaApi.metatraderAccountApi.createMetatraderAccount({
            name: `PesaMatrix_${login}`,
            type: 'cloud',
            platform: 'mt5',
            login: login,
            password: password,
            server: server,
            magic: 10001, // System tracking separation identifier
            quoteStreamingIntervalInSeconds: 2.5
          });

          // 2. Synchronize database status
          await prisma.tradingAccount.update({
            where: { id: accountId },
            data: { 
              metaApiAccountId: account.id,
              connectionStatus: 'CONNECTED' 
            }
          });

          // 3. Immediately instruct MetaApi to deploy the cloud runner
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
          const copyFactory = metaApi.copyFactoryApi;
          
          // Register strategy natively in the cloud execution layer
          const strategy = await copyFactory.createStrategy({
            name: name,
            accountId: masterMetaApiId,
            stopOutBalance: 100, // Safety protection margin
          });

          await prisma.copyStrategy.update({
            where: { id: strategyId },
            data: { metaApiStrategyId: strategy.id }
          });
        } catch (error: any) {
          throw new Error(`Failed to initialize strategy inside CopyFactory: ${error.message}`);
        }
        break;
      }

      case 'SUBSCRIBE_ACCOUNT': {
        const { subscriptionId, strategyMetaApiId, subscriberMetaApiId, riskMultiplier } = payload;
        try {
          const copyFactory = metaApi.copyFactoryApi;

          // Wire Subscriber Cloud Terminal to CopyFactory Strategy Engine
          const subscriber = await copyFactory.createSubscriber({
            accountId: subscriberMetaApiId,
            strategies: [
              {
                id: strategyMetaApiId,
                ratio: riskMultiplier
              }
            ]
          });

          await prisma.strategySubscription.update({
            where: { id: subscriptionId },
            data: { 
              metaApiSubscriberId: subscriber.id,
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
