import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createPerformance } from '../controllers/performanceController.js';

const router = express.Router();

// Protected endpoint to record a completed performance
router.post('/', authenticate, createPerformance);

export default router;
