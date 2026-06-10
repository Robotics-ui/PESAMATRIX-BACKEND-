"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforcementWorker = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const prisma = new client_1.PrismaClient();
const getCopyFactory = () => {
    if (!env_1.IS_METAAPI_CONFIGURED)
        throw new Error('METAAPI_TOKEN not configured');
    const CopyFactory = require('metaapi.cloud-copyfactory-sdk').default;
    return new CopyFactory(env_1.ENV.METAAPI_TOKEN);
};
const createWorker = () => new bullmq_1.Worker('EnforcementTasks', async (job) => {
    if (job.name === 'SWEEP_EXPIRED_SUBSCRIPTIONS') {
        console.log('[Enforcement] Initiating system-wide subscription expiry sweep...');
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
            console.log('[Enforcement] Sweep complete. Zero expired subscriptions found.');
            return;
        }
        console.log(`[Enforcement] Found ${expiredUsers.length} expired user(s). Revoking access...`);
        const configApi = env_1.IS_METAAPI_CONFIGURED ? getCopyFactory().configurationApi : null;
        for (const user of expiredUsers) {
            console.log(`[Enforcement] Revoking access for User ID: ${user.id}`);
            for (const account of user.tradingAccounts) {
                for (const sub of account.subscriptions) {
                    try {
                        if (configApi) {
                            await configApi.removeSubscriber(sub.metaApiSubscriberId);
                        }
                        await prisma.strategySubscription.update({
                            where: { id: sub.id },
                            data: { isActive: false }
                        });
                        console.log(`[Enforcement] Removed subscriber: ${sub.metaApiSubscriberId}`);
                    }
                    catch (error) {
                        console.error(`[Enforcement] Failed to revoke ${sub.metaApiSubscriberId}: ${error.message}`);
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
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'SUBSCRIPTION_EXPIRED_ENFORCEMENT',
                    details: `Subscription expired at ${user.subscriptionExpiry?.toISOString()}. Access revoked automatically.`,
                    performedBy: 'SYSTEM'
                }
            });
            console.log(`[Enforcement] Access revoked for User ID: ${user.id}`);
        }
        console.log(`[Enforcement] Sweep complete. Processed ${expiredUsers.length} user(s).`);
    }
}, { ...connection_1.queueConnectionOptions, concurrency: 1 });
exports.enforcementWorker = env_1.IS_REDIS_CONFIGURED ? createWorker() : null;
