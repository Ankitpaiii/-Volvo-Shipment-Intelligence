import { Router } from 'express';
import * as placementController from '../controllers/placementController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/companies', placementController.getCompanies);
router.post('/companies', placementController.addCompany);
router.patch('/companies/:id', placementController.updateCompany);
router.delete('/companies/:id', placementController.deleteCompany);

// AI placement prep features
router.post('/dsa-problem', placementController.getDSAProblem);
router.post('/mock-interview', placementController.startMockInterview);
router.post('/evaluate-interview', placementController.evaluateInterview);
router.post('/resume-analyze', placementController.analyzeATSResume);

export default router;
