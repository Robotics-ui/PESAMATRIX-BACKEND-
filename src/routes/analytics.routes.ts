import { Router } from 'express';
import { getDashboardStats, getSubscriptionStats } from '../controllers/analytics.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/dashboard-stats', authenticateJWT, getDashboardStats);
router.get('/subscription-stats', authenticateJWT, getSubscriptionStats);

export default router;
