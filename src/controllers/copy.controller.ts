import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { metaApiQueue } from '../queue/metaapi.queue';

const prisma = new PrismaClient();

export const createStrategy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { masterAccountId, name } = req.body;

    const masterAccount = await prisma.tradingAccount.findFirst({
      where: { id: masterAccountId, userId: req.user!.id, accountType: 'MASTER' }
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

    await metaApiQueue.add('CREATE_COPY_STRATEGY', {
      type: 'CREATE_COPY_STRATEGY',
      payload: { strategyId: strategy.id, masterMetaApiId: masterAccount.metaApiAccountId, name }
    });

    res.status(202).json({ message: 'Strategy creation queued inside the CopyFactory engine.', strategyId: strategy.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const subscribeToStrategy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subscriberAccountId, strategyId, riskMultiplier } = req.body;

    const subscriberAccount = await prisma.tradingAccount.findFirst({
      where: { id: subscriberAccountId, userId: req.user!.id, accountType: 'SUBSCRIBER' }
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

    await metaApiQueue.add('SUBSCRIBE_ACCOUNT', {
      type: 'SUBSCRIBE_ACCOUNT',
      payload: {
        subscriptionId: subscription.id,
        strategyMetaApiId: strategy.metaApiStrategyId,
        subscriberMetaApiId: subscriberAccount.metaApiAccountId,
        riskMultiplier: subscription.riskMultiplier
      }
    });

    res.status(202).json({ message: 'Subscription linkage queued successfully.', subscriptionId: subscription.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
