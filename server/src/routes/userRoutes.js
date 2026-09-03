import express from 'express';
import { getPublicProfile } from '../controllers/authController.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// Public user profile endpoint: GET /api/users/:username/profile
router.get('/:username/profile', optionalAuthenticate, getPublicProfile);

export default router;
