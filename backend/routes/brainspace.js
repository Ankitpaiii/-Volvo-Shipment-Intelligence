import { Router } from 'express';
import * as brainspaceController from '../controllers/brainspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/startup-validate', brainspaceController.validateStartup);
router.get('/reports', brainspaceController.getStartupReports);
router.delete('/reports/:id', brainspaceController.deleteStartupReport);

export default router;
