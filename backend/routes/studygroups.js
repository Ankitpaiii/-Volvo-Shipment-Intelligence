import { Router } from 'express';
import * as studyGroupController from '../controllers/studyGroupController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', studyGroupController.getGroups);
router.post('/', studyGroupController.createGroup);
router.post('/match', studyGroupController.matchPartners);
router.post('/:id/join', studyGroupController.joinGroup);

export default router;
