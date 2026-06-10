"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentHistory = exports.verifyPayment = exports.mpesaCallback = exports.initiateStkPush = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const tradingDays_1 = require("../utils/tradingDays");
const prisma = new client_1.PrismaClient();
const DARAJA_BASE = 'https://api.safaricom.co.ke';
const DARAJA_OAUTH_URL = `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`;
const DARAJA_STK_URL = `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`;
const DARAJA_STK_QUERY_URL = `${DARAJA_BASE}/mpesa/stkpushquery/v1/query`;
const getDarajaToken = async () => {
    const credentials = Buffer.from(`${env_1.ENV.MPESA.CONSUMER_KEY}:${env_1.ENV.MPESA.CONSUMER_SECRET}`).toString('base64');
    const response = await fetch(DARAJA_OAUTH_URL, {
        method: 'GET',
        headers: { Authorization: `Basic ${credentials}` }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`M-Pesa auth token generation failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data.access_token;
};
const buildTimestampAndPassword = () => {
    const timestamp = new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
    const password = Buffer.from(`${env_1.ENV.MPESA.SHORTCODE}${env_1.ENV.MPESA.PASSKEY}${timestamp}`).toString('base64');
    return { timestamp, password };
};
const initiateStkPush = async (req, res) => {
    try {
        if (!env_1.IS_MPESA_CONFIGURED) {
            res.status(503).json({ error: 'M-Pesa credentials are not configured.' });
            return;
        }
        const userId = req.user.id;
        const { phoneNumber, days } = req.body;
        if (!phoneNumber || !days) {
            res.status(400).json({ error: 'Phone number and number of subscription days are required.' });
            return;
        }
        const parsedDays = parseInt(days, 10);
        if (isNaN(parsedDays) || parsedDays < 1) {
            res.status(400).json({ error: 'Days must be a positive integer.' });
            return;
        }
        const settings = await prisma.subscriptionSettings.findFirst();
        if (!settings) {
            res.status(500).json({ error: 'Subscription settings not configured.' });
            return;
        }
        if (parsedDays < settings.minDays || parsedDays > settings.maxDays) {
            res.status(400).json({
                error: `Subscription days must be between ${settings.minDays} and ${settings.maxDays}.`
            });
            return;
        }
        const amount = Math.ceil(settings.feePerDay * parsedDays);
        const formattedPhone = phoneNumber.startsWith('0')
            ? `254${phoneNumber.slice(1)}`
            : phoneNumber.replace('+', '');
        const token = await getDarajaToken();
        const { timestamp, password } = buildTimestampAndPassword();
        const payload = {
            BusinessShortCode: env_1.ENV.MPESA.SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: formattedPhone,
            PartyB: env_1.ENV.MPESA.SHORTCODE,
            PhoneNumber: formattedPhone,
            CallBackURL: env_1.ENV.MPESA_CALLBACK_URL,
            AccountReference: 'PesaMatrix VIP',
            TransactionDesc: `PesaMatrix ${parsedDays}-day copy trading subscription`
        };
        const response = await fetch(DARAJA_STK_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.ResponseCode === '0') {
            await prisma.payment.create({
                data: {
                    userId,
                    amount,
                    phoneNumber: formattedPhone,
                    subscriptionDays: parsedDays,
                    status: 'PENDING',
                    merchantRequestID: data.MerchantRequestID,
                    checkoutRequestID: data.CheckoutRequestID
                }
            });
            res.status(200).json({
                message: 'STK Push initiated on user device.',
                checkoutRequestId: data.CheckoutRequestID,
                amount,
                days: parsedDays
            });
        }
        else {
            res.status(400).json({ error: data.ResponseDescription || 'STK Push failed.' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.initiateStkPush = initiateStkPush;
const mpesaCallback = async (req, res) => {
    try {
        const { Body } = req.body;
        if (!Body || !Body.stkCallback) {
            res.status(400).json({ error: 'Invalid callback payload structure.' });
            return;
        }
        const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
        const trackingPayment = await prisma.payment.findFirst({
            where: { merchantRequestID: MerchantRequestID, checkoutRequestID: CheckoutRequestID }
        });
        if (!trackingPayment) {
            res.status(404).json({ error: 'Payment record not found.' });
            return;
        }
        if (ResultCode === 0 && CallbackMetadata) {
            const items = CallbackMetadata.Item;
            const mpesaReceiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
            const mpesaReceipt = mpesaReceiptItem ? mpesaReceiptItem.Value : `SYS_GEN_${Date.now()}`;
            await prisma.payment.update({
                where: { id: trackingPayment.id },
                data: { status: 'COMPLETED', mpesaReceipt }
            });
            // Calculate expiry using trading days (Mon–Fri only)
            const now = new Date();
            const currentUser = await prisma.user.findUnique({ where: { id: trackingPayment.userId } });
            const baseDate = (currentUser?.subscriptionStatus && currentUser?.subscriptionExpiry && currentUser.subscriptionExpiry > now)
                ? currentUser.subscriptionExpiry
                : now;
            const newExpiry = (0, tradingDays_1.addTradingDays)(baseDate, trackingPayment.subscriptionDays);
            await prisma.user.update({
                where: { id: trackingPayment.userId },
                data: { subscriptionStatus: true, subscriptionExpiry: newExpiry }
            });
            await prisma.auditLog.create({
                data: {
                    userId: trackingPayment.userId,
                    action: 'SUBSCRIPTION_ACTIVATED',
                    details: `Receipt: ${mpesaReceipt}. Days: ${trackingPayment.subscriptionDays}. Expires: ${newExpiry.toISOString()}`
                }
            });
            console.log(`[Payment Success] Subscription activated for User: ${trackingPayment.userId}. Receipt: ${mpesaReceipt}. Expires: ${newExpiry.toISOString()}`);
        }
        else {
            await prisma.payment.update({
                where: { id: trackingPayment.id },
                data: { status: `FAILED: ${ResultDesc}` }
            });
        }
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.mpesaCallback = mpesaCallback;
const verifyPayment = async (req, res) => {
    try {
        if (!env_1.IS_MPESA_CONFIGURED) {
            res.status(503).json({ error: 'M-Pesa credentials are not configured.' });
            return;
        }
        const { checkoutRequestId } = req.params;
        const payment = await prisma.payment.findFirst({
            where: { checkoutRequestID: checkoutRequestId, userId: req.user.id }
        });
        if (!payment) {
            res.status(404).json({ error: 'Payment not found.' });
            return;
        }
        if (payment.status !== 'PENDING') {
            res.status(200).json({ status: payment.status, payment });
            return;
        }
        const token = await getDarajaToken();
        const { timestamp, password } = buildTimestampAndPassword();
        const response = await fetch(DARAJA_STK_QUERY_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BusinessShortCode: env_1.ENV.MPESA.SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestId
            })
        });
        const data = await response.json();
        res.status(200).json({
            checkoutRequestId,
            resultCode: data.ResultCode,
            resultDesc: data.ResultDesc,
            localPaymentStatus: payment.status
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.verifyPayment = verifyPayment;
const getPaymentHistory = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                amount: true,
                subscriptionDays: true,
                phoneNumber: true,
                mpesaReceipt: true,
                status: true,
                createdAt: true
            }
        });
        res.status(200).json(payments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPaymentHistory = getPaymentHistory;
