import { Router } from 'express';
import {
  listUsers,
  getUserDetail,
  adjustSubscription,
  getSettings,
  updateSettings,
  getSystemAnalytics,
  getAllPayments,
  getReplicationLogs,
  getAuditLogs
} from '../controllers/admin.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

router.use(authenticateJWT, requireAdmin);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/subscription', adjustSubscription);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/analytics', getSystemAnalytics);
router.get('/payments', getAllPayments);
router.get('/replication-logs', getReplicationLogs);
router.get('/audit-logs', getAuditLogs);

export default router;
