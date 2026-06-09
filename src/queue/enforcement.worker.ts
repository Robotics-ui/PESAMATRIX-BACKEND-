import { Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { PrismaClient } from '@prisma/client';
import MetaApi from 'metaapi.cloud-sdk';
import { ENV } from '../config/env';

const prisma = new PrismaClient();
const metaApi = new MetaApi(ENV.METAAPI_TOKEN);

export const enforcementWorker = new Worker(
  'EnforcementTasks',
  async (job: Job) => {
    if (job.name === 'SWEEP_EXPIRED_SUBSCRIPTIONS') {
      console.log('[Cron Worker] Initiating system-wide subscription expiry sweep...');

      const now = new Date();

      // 1. Locate all users whose access plan window has expired but status is still marked true
      const expiredUsers = await prisma.user.findMany({
        where: {
          subscriptionStatus: true,
          subscriptionExpiry: {
            lt: now
          }
        },
        include: {
          tradingAccounts: {
            include: {
              subscriptions: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      if (expiredUsers.length === 0) {
        console.log('[Cron Worker] Verification check complete. Zero expired records found.');
        return;
      }

      const copyFactory = metaApi.copyFactoryApi;

      for (const user of expiredUsers) {
        console.log(`[Expiry Triggered] Revoking access for User ID: ${user.id}`);

        for (const account of user.tradingAccounts) {
          for (const sub of account.subscriptions) {
            try {
              // 2. Terminate the copy link directly inside the MetaApi Cloud Engine
              // This guarantees copying stops instantly even if our server is offline later
              await copyFactory.deleteSubscriber(sub.metaApiSubscriberId);

              // 3. Mark the subscription link as inactive in our database records
              await prisma.strategySubscription.update({
                where: { id: sub.id },
                data: { isActive: false }
              });

              console.log(`[MetaApi Sync] Removed subscriber endpoint connection token: ${sub.metaApiSubscriberId}`);
            } catch (error: any) {
              console.error(`[MetaApi Error] Failed to revoke token connection ${sub.metaApiSubscriberId}: ${error.message}`);
              // Continue processing other accounts; do not let one fault block the queue sweep loop
            }
          }

          // 4. Update the actual account terminal status to reflect lack of credentials
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: { connectionStatus: 'DISCONNECTED' }
          });
        }

        // 5. Officially turn off their global premium flag
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: false }
        });

        console.log(`[Status Complete] User access level restricted for ID: ${user.id}`);
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 1 }
);
