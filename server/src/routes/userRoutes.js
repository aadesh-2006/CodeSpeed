import express from 'express';
import { getPublicProfile, searchUsers } from '../controllers/authController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// Search developers endpoint: GET /api/users/search?q=<query>
router.get('/search', authenticate, searchUsers);

// Public user profile endpoint: GET /api/users/:username/profile
router.get('/:username/profile', optionalAuthenticate, getPublicProfile);

export default router;
