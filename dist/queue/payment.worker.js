"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentWorker = exports.paymentQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const prisma = new client_1.PrismaClient();
const DARAJA_BASE = 'https://api.safaricom.co.ke';
const getDarajaToken = async () => {
    const credentials = Buffer.from(`${env_1.ENV.MPESA.CONSUMER_KEY}:${env_1.ENV.MPESA.CONSUMER_SECRET}`).toString('base64');
    const response = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: { Authorization: `Basic ${credentials}` }
    });
    if (!response.ok)
        throw new Error(`M-Pesa token error: ${response.status}`);
    const data = await response.json();
    return data.access_token;
};
const createPaymentQueue = () => new bullmq_1.Queue('PaymentTasks', connection_1.queueConnectionOptions);
const createPaymentWorker = () => new bullmq_1.Worker('PaymentTasks', async (job) => {
    const { type, payload } = job.data;
    switch (type) {
        case 'VERIFY_PAYMENT': {
            const { paymentId, checkoutRequestID } = payload;
            if (!env_1.IS_MPESA_CONFIGURED) {
                console.warn('[Payment Worker] M-Pesa not configured, skipping verification.');
                return;
            }
            const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
            if (!payment || payment.status !== 'PENDING')
                return;
            try {
                const token = await getDarajaToken();
                const timestamp = new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
                const password = Buffer.from(`${env_1.ENV.MPESA.SHORTCODE}${env_1.ENV.MPESA.PASSKEY}${timestamp}`).toString('base64');
                const response = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        BusinessShortCode: env_1.ENV.MPESA.SHORTCODE,
                        Password: password,
                        Timestamp: timestamp,
                        CheckoutRequestID: checkoutRequestID
                    })
                });
                const data = await response.json();
                if (data.ResultCode === '0' || data.ResultCode === 0) {
                    console.log(`[Payment Worker] Payment ${paymentId} confirmed via STK query.`);
                }
                else if (data.ResultCode === '1032') {
                    await prisma.payment.update({
                        where: { id: paymentId },
                        data: { status: 'FAILED: Cancelled by user' }
                    });
                }
                else {
                    console.log(`[Payment Worker] Payment ${paymentId} status: ${data.ResultDesc}`);
                }
            }
            catch (err) {
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
}, { ...connection_1.queueConnectionOptions, concurrency: 3 });
exports.paymentQueue = env_1.IS_REDIS_CONFIGURED ? createPaymentQueue() : null;
exports.paymentWorker = env_1.IS_REDIS_CONFIGURED ? createPaymentWorker() : null;
