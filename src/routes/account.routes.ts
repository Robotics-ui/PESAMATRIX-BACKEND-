import { Router } from 'express';
import { provisionAccount, getAccounts } from '../controllers/account.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
const router = Router();
router.use(authenticateJWT);
router.post('/provision', provisionAccount);
router.get('/', getAccounts);
export default router;
