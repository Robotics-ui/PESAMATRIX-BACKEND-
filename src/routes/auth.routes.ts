import { Router } from 'express';
import { register, login, changePassword, getProfile, resetAdminPassword } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authenticateJWT, changePassword);
router.get('/profile', authenticateJWT, getProfile);
router.post('/admin/reset-password', authenticateJWT, requireAdmin, resetAdminPassword);

export default router;
