import express from 'express';
import {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  updatePrivacy,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/privacy', authenticate, updatePrivacy);
router.post('/change-password', authenticate, changePassword);

export default router;
