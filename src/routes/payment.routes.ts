import { Router } from 'express';
import { initiateStkPush, mpesaCallback, verifyPayment, getPaymentHistory } from '../controllers/payment.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/stk-push', authenticateJWT, initiateStkPush);
router.post('/mpesa-callback', mpesaCallback);
router.get('/verify/:checkoutRequestId', authenticateJWT, verifyPayment);
router.get('/history', authenticateJWT, getPaymentHistory);

export default router;
