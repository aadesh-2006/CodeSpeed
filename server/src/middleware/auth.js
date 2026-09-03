import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication middleware to verify incoming JWT in Authorization header.
 * Attaches the authenticated user object to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('[Auth Middleware] JWT_SECRET is not set in environment.');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server configuration error.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token.',
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token payload.',
      });
    }

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User belonging to this token no longer exists.',
      });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };

    next();
  } catch (error) {
    console.error('[Auth Middleware] Error during authentication:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during authentication.',
    });
  }
};

/**
 * Optional authentication middleware.
 * If Authorization header with valid JWT is provided, attaches user context to req.user.
 * If missing, invalid, or expired, proceeds without req.user without rejecting the request.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || !token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded && decoded.id) {
        req.user = {
          id: decoded.id.toString(),
        };
      }
    } catch {
      // Non-fatal: unauthenticated viewer
    }
    next();
  } catch {
    next();
  }
};

export default authenticate;

