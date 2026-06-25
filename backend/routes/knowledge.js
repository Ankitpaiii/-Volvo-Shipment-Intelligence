import { Router } from 'express';
import * as knowledgeController from '../controllers/knowledgeController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/upload', knowledgeController.uploadMiddleware, knowledgeController.uploadDocument);
router.get('/documents', knowledgeController.getDocuments);
router.delete('/documents/:id', knowledgeController.deleteDocument);
router.post('/search', knowledgeController.queryKnowledge);

export default router;
