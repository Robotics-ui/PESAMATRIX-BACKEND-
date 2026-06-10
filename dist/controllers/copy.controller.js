"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToStrategy = exports.createStrategy = void 0;
const client_1 = require("@prisma/client");
const metaapi_queue_1 = require("../queue/metaapi.queue");
const prisma = new client_1.PrismaClient();
const createStrategy = async (req, res) => {
    try {
        const { masterAccountId, name } = req.body;
        const masterAccount = await prisma.tradingAccount.findFirst({
            where: { id: masterAccountId, userId: req.user.id, accountType: 'MASTER' }
        });
        if (!masterAccount || masterAccount.connectionStatus !== 'CONNECTED') {
            res.status(400).json({ error: 'Valid, fully-connected master account is required.' });
            return;
        }
        const strategy = await prisma.copyStrategy.create({
            data: {
                masterAccountId: masterAccount.id,
                name,
                metaApiStrategyId: `STRATEGY_PENDING_${Date.now()}`
            }
        });
        await metaapi_queue_1.metaApiQueue.add('CREATE_COPY_STRATEGY', {
            type: 'CREATE_COPY_STRATEGY',
            payload: { strategyId: strategy.id, masterMetaApiId: masterAccount.metaApiAccountId, name }
        });
        res.status(202).json({ message: 'Strategy creation queued inside the CopyFactory engine.', strategyId: strategy.id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createStrategy = createStrategy;
const subscribeToStrategy = async (req, res) => {
    try {
        const { subscriberAccountId, strategyId, riskMultiplier } = req.body;
        // Subscription enforcement: only paid, active subscribers may link to copy strategies
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!currentUser?.subscriptionStatus || !currentUser?.subscriptionExpiry || currentUser.subscriptionExpiry < new Date()) {
            res.status(403).json({ error: 'An active paid subscription is required to receive copied trades.' });
            return;
        }
        const subscriberAccount = await prisma.tradingAccount.findFirst({
            where: { id: subscriberAccountId, userId: req.user.id, accountType: 'SUBSCRIBER' }
        });
        if (!subscriberAccount || subscriberAccount.connectionStatus !== 'CONNECTED') {
            res.status(400).json({ error: 'Valid, fully-connected subscriber account is required.' });
            return;
        }
        const strategy = await prisma.copyStrategy.findUnique({ where: { id: strategyId } });
        if (!strategy || strategy.metaApiStrategyId.startsWith('STRATEGY_PENDING')) {
            res.status(400).json({ error: 'Target master copy strategy is not fully ready.' });
            return;
        }
        const subscription = await prisma.strategySubscription.create({
            data: {
                subscriberAccountId: subscriberAccount.id,
                strategyId: strategy.id,
                riskMultiplier: riskMultiplier || 1.0,
                metaApiSubscriberId: `SUB_PENDING_${Date.now()}`,
                isActive: false
            }
        });
        await metaapi_queue_1.metaApiQueue.add('SUBSCRIBE_ACCOUNT', {
            type: 'SUBSCRIBE_ACCOUNT',
            payload: {
                subscriptionId: subscription.id,
                strategyMetaApiId: strategy.metaApiStrategyId,
                subscriberMetaApiId: subscriberAccount.metaApiAccountId,
                riskMultiplier: subscription.riskMultiplier
            }
        });
        res.status(202).json({ message: 'Subscription linkage queued successfully.', subscriptionId: subscription.id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.subscribeToStrategy = subscribeToStrategy;
