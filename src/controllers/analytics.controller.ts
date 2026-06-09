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

    // 1. Fetch the master account details from the database
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

    // 2. Access MetaApi's synchronization engine for this account
    const accountConnection = await metaApi.metatraderAccountApi.getMetatraderAccountConnection(
      masterAccount.metaApiAccountId
    );
    
    // Ensure the terminal connection is fully active inside MetaApi
    await accountConnection.connect();
    await accountConnection.waitSynchronized();

    // 3. Request historical closed trade transactions from the cloud server
    // We fetch a standard block of the last 500 records to calculate metrics
    const historyStorage = accountConnection.historyStorage;
    const historyDeals = await historyStorage.getDealsByTimeRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      new Date()
    );

    // 4. Process analytics in-memory
    let totalProfit = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    const signalHistory = historyDeals
      .filter(deal => deal.entryType === 'DEAL_ENTRY_OUT') // Filter only for closed trades
      .map(deal => {
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
          type: deal.type, // DEAL_TYPE_BUY or DEAL_TYPE_SELL
          volume: deal.volume,
          profit: parseFloat(profit.toFixed(2)),
          time: deal.time
        };
      });

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    // 5. Structure payload to match dashboard visual indicators perfectly
    res.status(200).json({
      metrics: {
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalActiveSignals: totalTrades,
        growthPercentage: totalProfit > 0 ? parseFloat(((grossProfit / 10000) * 100).toFixed(2)) : 0 // Assumes a standard base scale model
      },
      chartData: signalHistory.slice(-15).map(s => ({ time: s.time, profit: s.profit })), // Quick sparkline data
      recentSignals: signalHistory.slice(-6).reverse() // Populates the live transaction history feed component
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
