import { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/', chatController.sendMessage);
router.get('/sessions', chatController.getSessions);
router.get('/sessions/:id', chatController.getSessionMessages);
router.delete('/sessions/:id', chatController.deleteSession);

export default router;
