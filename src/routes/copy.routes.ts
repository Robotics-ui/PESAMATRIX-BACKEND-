import { Router } from 'express';
import { createStrategy, subscribeToStrategy } from '../controllers/copy.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
const router = Router();
router.use(authenticateJWT);
router.post('/strategy', createStrategy);
router.post('/subscribe', subscribeToStrategy);
export default router;
