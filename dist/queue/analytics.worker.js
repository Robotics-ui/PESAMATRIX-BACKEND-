"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsWorker = exports.analyticsQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const prisma = new client_1.PrismaClient();
const createAnalyticsQueue = () => new bullmq_1.Queue('AnalyticsTasks', connection_1.queueConnectionOptions);
const createAnalyticsWorker = () => new bullmq_1.Worker('AnalyticsTasks', async (job) => {
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
            }
            else {
                console.log('[Analytics] Replication health check passed. No recent failures.');
            }
            break;
        }
    }
}, { ...connection_1.queueConnectionOptions, concurrency: 2 });
exports.analyticsQueue = env_1.IS_REDIS_CONFIGURED ? createAnalyticsQueue() : null;
exports.analyticsWorker = env_1.IS_REDIS_CONFIGURED ? createAnalyticsWorker() : null;
