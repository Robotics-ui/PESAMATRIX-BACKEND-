import { Queue, Worker, Job } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { PrismaClient } from '@prisma/client';
import { ENV, IS_REDIS_CONFIGURED, IS_MPESA_CONFIGURED } from '../config/env';

const prisma = new PrismaClient();

const DARAJA_BASE = 'https://api.safaricom.co.ke';

const getDarajaToken = async (): Promise<string> => {
  const credentials = Buffer.from(`${ENV.MPESA.CONSUMER_KEY}:${ENV.MPESA.CONSUMER_SECRET}`).toString('base64');
  const response = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!response.ok) throw new Error(`M-Pesa token error: ${response.status}`);
  const data = await response.json() as any;
  return data.access_token;
};

const createPaymentQueue = () => new Queue('PaymentTasks', queueConnectionOptions);

const createPaymentWorker = () => new Worker(
  'PaymentTasks',
  async (job: Job) => {
    const { type, payload } = job.data;

    switch (type) {
      case 'VERIFY_PAYMENT': {
        const { paymentId, checkoutRequestID } = payload;

        if (!IS_MPESA_CONFIGURED) {
          console.warn('[Payment Worker] M-Pesa not configured, skipping verification.');
          return;
        }

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.status !== 'PENDING') return;

        try {
          const token = await getDarajaToken();
          const timestamp = new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
          const password = Buffer.from(`${ENV.MPESA.SHORTCODE}${ENV.MPESA.PASSKEY}${timestamp}`).toString('base64');

          const response = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              BusinessShortCode: ENV.MPESA.SHORTCODE,
              Password: password,
              Timestamp: timestamp,
              CheckoutRequestID: checkoutRequestID
            })
          });

          const data = await response.json() as any;

          if (data.ResultCode === '0' || data.ResultCode === 0) {
            console.log(`[Payment Worker] Payment ${paymentId} confirmed via STK query.`);
          } else if (data.ResultCode === '1032') {
            await prisma.payment.update({
              where: { id: paymentId },
              data: { status: 'FAILED: Cancelled by user' }
            });
          } else {
            console.log(`[Payment Worker] Payment ${paymentId} status: ${data.ResultDesc}`);
          }
        } catch (err: any) {
          console.error(`[Payment Worker] Verification failed for ${paymentId}: ${err.message}`);
          throw err;
        }
        break;
      }

      case 'EXPIRE_STALE_PAYMENTS': {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
        const stale = await prisma.payment.updateMany({
          where: { status: 'PENDING', createdAt: { lt: cutoff } },
          data: { status: 'FAILED: Timed out' }
        });
        if (stale.count > 0) {
          console.log(`[Payment Worker] Expired ${stale.count} stale PENDING payment(s).`);
        }
        break;
      }
    }
  },
  { ...queueConnectionOptions, concurrency: 3 }
);

export const paymentQueue = IS_REDIS_CONFIGURED ? createPaymentQueue() : null as any;
export const paymentWorker = IS_REDIS_CONFIGURED ? createPaymentWorker() : null as any;
