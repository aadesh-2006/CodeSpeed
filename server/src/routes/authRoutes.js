import express from 'express';
import {
  signup,
  login,
  verifyEmail,
  resendVerification,
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
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected routes
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/privacy', authenticate, updatePrivacy);
router.post('/change-password', authenticate, changePassword);

export default router;
