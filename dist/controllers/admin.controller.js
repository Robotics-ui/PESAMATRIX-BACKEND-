"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = exports.getReplicationLogs = exports.getAllPayments = exports.getSystemAnalytics = exports.updateSettings = exports.getSettings = exports.adjustSubscription = exports.getUserDetail = exports.listUsers = void 0;
const client_1 = require("@prisma/client");
const tradingDays_1 = require("../utils/tradingDays");
const prisma = new client_1.PrismaClient();
// GET /api/admin/users
const listUsers = async (req, res) => {
    try {
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '20'));
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    isAdmin: true,
                    subscriptionStatus: true,
                    subscriptionExpiry: true,
                    createdAt: true,
                    _count: { select: { tradingAccounts: true, payments: true } }
                }
            }),
            prisma.user.count()
        ]);
        const usersWithDays = users.map(u => ({
            ...u,
            remainingTradingDays: u.subscriptionExpiry ? (0, tradingDays_1.countRemainingTradingDays)(u.subscriptionExpiry) : 0
        }));
        res.status(200).json({ users: usersWithDays, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.listUsers = listUsers;
// GET /api/admin/users/:id
const getUserDetail = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                tradingAccounts: {
                    include: { managedStrategy: true, subscriptions: true }
                },
                payments: { orderBy: { createdAt: 'desc' }, take: 10 },
                auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
            }
        });
        if (!user) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        res.status(200).json({
            ...user,
            remainingTradingDays: user.subscriptionExpiry
                ? (0, tradingDays_1.countRemainingTradingDays)(user.subscriptionExpiry)
                : 0
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getUserDetail = getUserDetail;
// PATCH /api/admin/users/:id/subscription
const adjustSubscription = async (req, res) => {
    try {
        const { subscriptionStatus, subscriptionExpiry } = req.body;
        const targetUserId = req.params.id;
        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        const updated = await prisma.user.update({
            where: { id: targetUserId },
            data: {
                ...(typeof subscriptionStatus === 'boolean' && { subscriptionStatus }),
                ...(subscriptionExpiry && { subscriptionExpiry: new Date(subscriptionExpiry) })
            },
            select: { id: true, email: true, subscriptionStatus: true, subscriptionExpiry: true }
        });
        await prisma.auditLog.create({
            data: {
                userId: targetUserId,
                action: 'ADMIN_SUBSCRIPTION_ADJUSTMENT',
                details: `Status: ${subscriptionStatus}, Expiry: ${subscriptionExpiry}`,
                performedBy: req.user.id
            }
        });
        res.status(200).json({ message: 'Subscription updated.', user: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.adjustSubscription = adjustSubscription;
// GET /api/admin/settings
const getSettings = async (req, res) => {
    try {
        const settings = await prisma.subscriptionSettings.findFirst();
        if (!settings) {
            res.status(404).json({ error: 'Settings not initialised.' });
            return;
        }
        res.status(200).json(settings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getSettings = getSettings;
// PUT /api/admin/settings
const updateSettings = async (req, res) => {
    try {
        const { feePerDay, minDays, maxDays } = req.body;
        if (feePerDay !== undefined && feePerDay <= 0) {
            res.status(400).json({ error: 'Fee per day must be greater than 0.' });
            return;
        }
        if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
            res.status(400).json({ error: 'Minimum days cannot exceed maximum days.' });
            return;
        }
        let settings = await prisma.subscriptionSettings.findFirst();
        if (!settings) {
            settings = await prisma.subscriptionSettings.create({
                data: { feePerDay: feePerDay ?? 100, minDays: minDays ?? 1, maxDays: maxDays ?? 30, updatedBy: req.user.id }
            });
        }
        else {
            settings = await prisma.subscriptionSettings.update({
                where: { id: settings.id },
                data: {
                    ...(feePerDay !== undefined && { feePerDay }),
                    ...(minDays !== undefined && { minDays }),
                    ...(maxDays !== undefined && { maxDays }),
                    updatedBy: req.user.id
                }
            });
        }
        res.status(200).json({ message: 'Settings updated.', settings });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateSettings = updateSettings;
// GET /api/admin/analytics
const getSystemAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const [totalUsers, activeSubscribers, expiredSubscribers, totalPayments, completedPayments, totalAccounts, masterAccounts, subscriberAccounts, activeSubscriptions, successfulReplications, failedReplications, recentAuditLogs] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { subscriptionStatus: true, subscriptionExpiry: { gt: now } } }),
            prisma.user.count({ where: { subscriptionStatus: true, subscriptionExpiry: { lte: now } } }),
            prisma.payment.count(),
            prisma.payment.findMany({ where: { status: 'COMPLETED' }, select: { amount: true } }),
            prisma.tradingAccount.count(),
            prisma.tradingAccount.count({ where: { accountType: 'MASTER' } }),
            prisma.tradingAccount.count({ where: { accountType: 'SUBSCRIBER' } }),
            prisma.strategySubscription.count({ where: { isActive: true } }),
            prisma.tradeReplicationLog.count({ where: { status: 'SUCCESS' } }),
            prisma.tradeReplicationLog.count({ where: { status: 'FAILED' } }),
            prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
        ]);
        const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);
        res.status(200).json({
            users: {
                total: totalUsers,
                activeSubscribers,
                expiredSubscribers,
                nonSubscribed: totalUsers - activeSubscribers - expiredSubscribers
            },
            revenue: {
                total: parseFloat(totalRevenue.toFixed(2)),
                completedPayments: completedPayments.length,
                totalTransactions: totalPayments
            },
            trading: {
                totalAccounts,
                masterAccounts,
                subscriberAccounts,
                activeSubscriptions
            },
            replication: {
                successful: successfulReplications,
                failed: failedReplications,
                total: successfulReplications + failedReplications
            },
            recentAuditLogs
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getSystemAnalytics = getSystemAnalytics;
// GET /api/admin/payments
const getAllPayments = async (req, res) => {
    try {
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '20'));
        const skip = (page - 1) * limit;
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, email: true } } }
            }),
            prisma.payment.count()
        ]);
        res.status(200).json({ payments, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllPayments = getAllPayments;
// GET /api/admin/replication-logs
const getReplicationLogs = async (req, res) => {
    try {
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '50'));
        const skip = (page - 1) * limit;
        const { status, strategyId } = req.query;
        const where = {};
        if (status)
            where.status = String(status);
        if (strategyId)
            where.strategyId = String(strategyId);
        const [logs, total] = await Promise.all([
            prisma.tradeReplicationLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    subscriberAccount: { select: { id: true, login: true, userId: true } }
                }
            }),
            prisma.tradeReplicationLog.count({ where })
        ]);
        res.status(200).json({ logs, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getReplicationLogs = getReplicationLogs;
// GET /api/admin/audit-logs
const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '50'));
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, email: true } } }
            }),
            prisma.auditLog.count()
        ]);
        res.status(200).json({ logs, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAuditLogs = getAuditLogs;
