import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.post('/tip', aiController.tip);
router.post('/summarize', aiController.summarize);
router.post('/flashcards', aiController.flashcards);
router.post('/attendance', aiController.attendance);
router.post('/mcq', aiController.mcq);

export default router;
