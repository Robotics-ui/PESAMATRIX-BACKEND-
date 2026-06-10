import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

const SAFARICOM_IPS = new Set([
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.138',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
]);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
};

const validatePayloadStructure = (body: any): string | null => {
  if (!body || typeof body !== 'object') return 'Missing request body.';
  if (!body.Body) return 'Missing Body field.';
  if (!body.Body.stkCallback) return 'Missing Body.stkCallback field.';

  const cb = body.Body.stkCallback;
  if (typeof cb.MerchantRequestID !== 'string') return 'Missing or invalid MerchantRequestID.';
  if (typeof cb.CheckoutRequestID !== 'string') return 'Missing or invalid CheckoutRequestID.';
  if (typeof cb.ResultCode !== 'number') return 'Missing or invalid ResultCode.';

  return null;
};

export const validateMpesaCallback = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = getClientIp(req);

  if (IS_PRODUCTION) {
    if (!SAFARICOM_IPS.has(clientIp)) {
      console.warn(`[M-Pesa Security] Rejected callback from unauthorized IP: ${clientIp}`);
      res.status(403).json({ error: 'Forbidden: unauthorized callback source.' });
      return;
    }

    if (ENV.MPESA_WEBHOOK_SECRET) {
      const provided = req.query.token as string | undefined;
      if (!provided || provided !== ENV.MPESA_WEBHOOK_SECRET) {
        console.warn(`[M-Pesa Security] Rejected callback: invalid or missing webhook token from IP ${clientIp}.`);
        res.status(403).json({ error: 'Forbidden: invalid webhook token.' });
        return;
      }
    }
  } else {
    if (!SAFARICOM_IPS.has(clientIp)) {
      console.warn(`[M-Pesa Security] DEV MODE — allowing callback from non-Safaricom IP: ${clientIp}. This would be blocked in production.`);
    }
  }

  const structureError = validatePayloadStructure(req.body);
  if (structureError) {
    console.warn(`[M-Pesa Security] Rejected malformed callback payload: ${structureError}`);
    res.status(400).json({ error: `Invalid callback payload: ${structureError}` });
    return;
  }

  console.log(`[M-Pesa] Callback accepted from IP: ${clientIp}`);
  next();
};
