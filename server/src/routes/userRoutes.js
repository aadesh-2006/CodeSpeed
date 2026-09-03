import express from 'express';
import { getPublicProfile } from '../controllers/authController.js';

const router = express.Router();

// Public user profile endpoint: GET /api/users/:username/profile
router.get('/:username/profile', getPublicProfile);

export default router;
