import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createPerformance,
  getPerformances,
  getPerformanceGraph,
} from '../controllers/performanceController.js';

const router = express.Router();

// Protected endpoints for performance records
router.post('/', authenticate, createPerformance);
router.get('/', authenticate, getPerformances);
router.get('/graph', authenticate, getPerformanceGraph);

export default router;
