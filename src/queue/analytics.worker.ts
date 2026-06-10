import { Queue, Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { PrismaClient } from '@prisma/client';
import { IS_REDIS_CONFIGURED } from '../config/env';
import { countRemainingTradingDays } from '../utils/tradingDays';

const prisma = new PrismaClient();

const createAnalyticsQueue = () => new Queue('AnalyticsTasks', queueConnectionOptions);

const createAnalyticsWorker = () => new Worker(
  'AnalyticsTasks',
  async (job: Job) => {
    const { type } = job.data;

    switch (type) {
      case 'COMPUTE_SUBSCRIPTION_SUMMARY': {
        const now = new Date();

        const [total, active, expiring] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({
            where: { subscriptionStatus: true, subscriptionExpiry: { gt: now } }
          }),
          prisma.user.count({
            where: {
              subscriptionStatus: true,
              subscriptionExpiry: {
                gt: now,
                lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // expiring in 3 days
              }
            }
          })
        ]);

        console.log(`[Analytics] Subscription summary — Total: ${total}, Active: ${active}, Expiring soon: ${expiring}`);
        break;
      }

      case 'AUDIT_INACTIVE_ACCOUNTS': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const inactiveAccounts = await prisma.tradingAccount.findMany({
          where: {
            connectionStatus: 'PROVISIONING',
            createdAt: { lt: thirtyDaysAgo }
          },
          select: { id: true, login: true, userId: true, createdAt: true }
        });

        if (inactiveAccounts.length > 0) {
          console.warn(`[Analytics] ${inactiveAccounts.length} account(s) stuck in PROVISIONING for >30 days.`);
          for (const acct of inactiveAccounts) {
            await prisma.tradingAccount.update({
              where: { id: acct.id },
              data: { connectionStatus: 'FAILED' }
            });
          }
        }
        break;
      }

      case 'REPLICATION_HEALTH_CHECK': {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentFailures = await prisma.tradeReplicationLog.count({
          where: { status: 'FAILED', createdAt: { gt: oneHourAgo } }
        });

        if (recentFailures > 0) {
          console.warn(`[Analytics] ${recentFailures} replication failure(s) in the last hour.`);
        } else {
          console.log('[Analytics] Replication health check passed. No recent failures.');
        }
        break;
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 2 }
);

export const analyticsQueue = IS_REDIS_CONFIGURED ? createAnalyticsQueue() : null as any;
export const analyticsWorker = IS_REDIS_CONFIGURED ? createAnalyticsWorker() : null as any;
