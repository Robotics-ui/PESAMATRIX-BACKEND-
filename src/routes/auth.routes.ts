import { Router } from 'express';
import { register, login, changePassword, getProfile } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authenticateJWT, changePassword);
router.get('/profile', authenticateJWT, getProfile);

export default router;
