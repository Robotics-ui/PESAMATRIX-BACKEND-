"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccounts = exports.provisionAccount = void 0;
const client_1 = require("@prisma/client");
const metaapi_queue_1 = require("../queue/metaapi.queue");
const prisma = new client_1.PrismaClient();
const provisionAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { login, password, server, accountType } = req.body; // MASTER or SUBSCRIBER
        if (!login || !password || !server || !accountType) {
            res.status(400).json({ error: 'Missing required trading account fields.' });
            return;
        }
        // 1. Log placeholder account details in our DB
        const account = await prisma.tradingAccount.create({
            data: {
                userId,
                login: String(login),
                password,
                server,
                accountType,
                metaApiAccountId: `PENDING_${Date.now()}_${login}`, // Temp fallback ID
                connectionStatus: 'PROVISIONING'
            }
        });
        // 2. Queue the heavy cloud setup task out of the request loop
        await metaapi_queue_1.metaApiQueue.add('PROVISION_TERMINAL', {
            type: 'PROVISION_TERMINAL',
            payload: { accountId: account.id, login, password, server }
        });
        res.status(202).json({
            message: 'Account provisioning initiated natively on MetaApi infrastructure.',
            accountId: account.id,
            status: 'PROVISIONING'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.provisionAccount = provisionAccount;
const getAccounts = async (req, res) => {
    try {
        const accounts = await prisma.tradingAccount.findMany({
            where: { userId: req.user.id },
            select: { id: true, accountType: true, login: true, server: true, connectionStatus: true, createdAt: true }
        });
        res.status(200).json(accounts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAccounts = getAccounts;
