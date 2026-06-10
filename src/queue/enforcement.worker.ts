import { Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { PrismaClient } from '@prisma/client';
import { ENV, IS_REDIS_CONFIGURED, IS_METAAPI_CONFIGURED } from '../config/env';

const prisma = new PrismaClient();

const getCopyFactory = () => {
  if (!IS_METAAPI_CONFIGURED) throw new Error('METAAPI_TOKEN not configured');
  const CopyFactory = require('metaapi.cloud-copyfactory-sdk').default;
  return new CopyFactory(ENV.METAAPI_TOKEN);
};

const createWorker = () => new Worker(
  'EnforcementTasks',
  async (job: Job) => {
    if (job.name === 'SWEEP_EXPIRED_SUBSCRIPTIONS') {
      console.log('[Cron Worker] Initiating system-wide subscription expiry sweep...');

      const now = new Date();
      const expiredUsers = await prisma.user.findMany({
        where: { subscriptionStatus: true, subscriptionExpiry: { lt: now } },
        include: {
          tradingAccounts: {
            include: { subscriptions: { where: { isActive: true } } }
          }
        }
      });

      if (expiredUsers.length === 0) {
        console.log('[Cron Worker] Verification check complete. Zero expired records found.');
        return;
      }

      const configApi = getCopyFactory().configurationApi;

      for (const user of expiredUsers) {
        console.log(`[Expiry Triggered] Revoking access for User ID: ${user.id}`);

        for (const account of user.tradingAccounts) {
          for (const sub of account.subscriptions) {
            try {
              await configApi.removeSubscriber(sub.metaApiSubscriberId);
              await prisma.strategySubscription.update({
                where: { id: sub.id },
                data: { isActive: false }
              });
              console.log(`[MetaApi Sync] Removed subscriber: ${sub.metaApiSubscriberId}`);
            } catch (error: any) {
              console.error(`[MetaApi Error] Failed to revoke ${sub.metaApiSubscriberId}: ${error.message}`);
            }
          }

          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: { connectionStatus: 'DISCONNECTED' }
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: false }
        });

        console.log(`[Status Complete] Access restricted for User ID: ${user.id}`);
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 1 }
);

export const enforcementWorker = IS_REDIS_CONFIGURED ? createWorker() : null as any;
