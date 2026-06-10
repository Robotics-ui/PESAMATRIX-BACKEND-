import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { metaApiQueue } from '../queue/metaapi.queue';

const prisma = new PrismaClient();

export const provisionAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
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
    if (metaApiQueue) {
      await metaApiQueue.add('PROVISION_TERMINAL', {
        type: 'PROVISION_TERMINAL',
        payload: { accountId: account.id, login, password, server }
      });
    }

    res.status(202).json({
      message: metaApiQueue
        ? 'Account provisioning initiated natively on MetaApi infrastructure.'
        : 'Account registered. MetaApi provisioning will begin once METAAPI_TOKEN and UPSTASH_REDIS_URL are configured.',
      accountId: account.id,
      status: 'PROVISIONING'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAccounts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId: req.user!.id },
      select: { id: true, accountType: true, login: true, server: true, connectionStatus: true, createdAt: true }
    });
    res.status(200).json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
