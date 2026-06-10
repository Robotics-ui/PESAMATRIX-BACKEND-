import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import MetaApi from 'metaapi.cloud-sdk';
import { ENV } from '../config/env';

const prisma = new PrismaClient();
const metaApi = new MetaApi(ENV.METAAPI_TOKEN);

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { masterAccountId } = req.query;

    if (!masterAccountId) {
      res.status(400).json({ error: 'masterAccountId is a required query parameter.' });
      return;
    }

    const masterAccount = await prisma.tradingAccount.findFirst({
      where: {
        id: String(masterAccountId),
        userId: req.user!.id,
        accountType: 'MASTER'
      }
    });

    if (!masterAccount || masterAccount.connectionStatus !== 'CONNECTED') {
      res.status(404).json({ error: 'Active master account terminal connection not found.' });
      return;
    }

    const account = await metaApi.metatraderAccountApi.getAccount(masterAccount.metaApiAccountId);

    const connection = account.getStreamingConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const historyStorage = connection.historyStorage;
    const historyDeals = historyStorage.getDealsByTimeRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );

    let totalProfit = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    const signalHistory = historyDeals
      .filter((deal: any) => deal.entryType === 'DEAL_ENTRY_OUT')
      .map((deal: any) => {
        const profit = deal.profit + (deal.swap || 0) + (deal.commission || 0);
        totalProfit += profit;

        if (profit > 0) {
          winningTrades++;
          grossProfit += profit;
        } else if (profit < 0) {
          losingTrades++;
          grossLoss += Math.abs(profit);
        }

        return {
          id: deal.id,
          symbol: deal.symbol,
          type: deal.type,
          volume: deal.volume,
          profit: parseFloat(profit.toFixed(2)),
          time: deal.time
        };
      });

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    res.status(200).json({
      metrics: {
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalActiveSignals: totalTrades,
        growthPercentage: totalProfit > 0 ? parseFloat(((grossProfit / 10000) * 100).toFixed(2)) : 0
      },
      chartData: signalHistory.slice(-15).map((s: any) => ({ time: s.time, profit: s.profit })),
      recentSignals: signalHistory.slice(-6).reverse()
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
