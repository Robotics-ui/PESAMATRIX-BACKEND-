import { Router } from 'express';
import { initiateStkPush, mpesaCallback } from '../controllers/payment.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Private Route: Requires User JWT validation token
router.post('/stk-push', authenticateJWT, initiateStkPush);

// Public Route: Open endpoint for Safaricom's webhook callbacks
router.post('/mpesa-callback', mpesaCallback);

export default router;
