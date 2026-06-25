import { Router } from 'express';
import * as deadlinePlannerController from '../controllers/deadlinePlannerController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/study-plan', deadlinePlannerController.createStudyPlan);

export default router;
