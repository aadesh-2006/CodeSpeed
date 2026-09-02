import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper to generate JWT token containing only user ID.
 */
const generateToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured in the environment.');
  }
  return jwt.sign({ id: userId }, jwtSecret, {
    expiresIn: '7d',
  });
};

/**
 * Handle user registration.
 * POST /api/auth/signup
 */
export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and password are required.',
      });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Validate username length
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({
        status: 'error',
        message: 'Username must be between 3 and 30 characters in length.',
      });
    }

    // Validate email format
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    // Validate password requirements
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        status: 'error',
        message: 'Password cannot exceed 128 characters.',
      });
    }

    // Check for existing duplicate email or username
    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
      });
    }

    const existingUsername = await User.findOne({ username: trimmedUsername });
    if (existingUsername) {
      return res.status(409).json({
        status: 'error',
        message: 'This username is already taken. Please choose another.',
      });
    }

    // Hash password with bcryptjs
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create and save user
    const newUser = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
    });

    // Generate token
    const token = generateToken(newUser._id.toString());

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully.',
      token,
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Signup error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during user registration.',
    });
  }
};

/**
 * Handle user login.
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    // Compare password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    // Generate token containing only user ID
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Login error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during login.',
    });
  }
};

/**
 * Get current authenticated user details.
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      status: 'success',
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] GetMe error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving user data.',
    });
  }
};
