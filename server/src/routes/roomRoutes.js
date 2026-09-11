import express from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { createRoom, getRoom, getRoomResults } from '../controllers/roomController.js';

const router = express.Router();

// Create room (Host must be authenticated)
router.post('/', authenticate, createRoom);

// Get room by code (Optional authentication)
router.get('/:code', optionalAuthenticate, getRoom);

// Get finalized competition results (Participant authenticated only)
router.get('/:code/results', authenticate, getRoomResults);

export default router;
