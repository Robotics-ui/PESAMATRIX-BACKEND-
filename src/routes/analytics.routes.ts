import { Router } from 'express';
import { getDashboardStats } from '../controllers/analytics.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Protect metrics streaming vectors using standard user token keys
router.get('/dashboard-stats', authenticateJWT, getDashboardStats);

export default router;
