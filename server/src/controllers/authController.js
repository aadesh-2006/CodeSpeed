import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Performance from '../models/Performance.js';
import { evaluateBadges } from '../utils/badgeRules.js';
import { sendVerificationEmail } from '../services/emailService.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[\p{L}\p{N}_]{3,30}$/u;
const dataUriRegex = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Escape special regex characters in a string for safe RegExp construction.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    const { username, email, password } = req.body || {};

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and password are required.',
      });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Validate username length and character format (supporting Unicode letters, numbers, and underscores)
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json({
        status: 'error',
        message: 'Username must be between 3 and 30 characters and contain only letters, numbers, and underscores.',
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

    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') },
    });
    if (existingUsername) {
      return res.status(409).json({
        status: 'error',
        message: 'This username is already taken. Please choose another.',
      });
    }

    // Hash password with bcryptjs
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate single-use cryptographic verification token (256-bit entropy)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    // Create user in unverified state
    const newUser = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      emailVerified: false,
      verificationTokenHash,
      verificationTokenExpires,
      lastVerificationEmailSentAt: new Date(),
      bio: '',
      profilePhoto: null,
      practiceStatsVisibility: 'private',
    });

    // Send verification email
    await sendVerificationEmail(trimmedEmail, trimmedUsername, rawVerificationToken);

    return res.status(201).json({
      status: 'success',
      message: 'Account created successfully! Please check your email to verify your account before logging in.',
      requiresVerification: true,
      email: newUser.email,
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
        emailVerified: false,
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
    const { email, username, identifier, password } = req.body || {};
    const loginIdentifier = (identifier || email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username or email and password are required.',
      });
    }

    // Find user by either email (case-insensitive) or username (case-insensitive)
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier.toLowerCase() },
        { username: { $regex: new RegExp(`^${escapeRegex(loginIdentifier)}$`, 'i') } },
      ],
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid username, email, or password.',
      });
    }

    // Compare password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid username, email, or password.',
      });
    }

    // Check if user has verified their email address (legacy accounts without field default to true)
    if (user.emailVerified === false) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        email: user.email,
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
        emailVerified: true,
        bio: user.bio || '',
        profilePhoto: user.profilePhoto || null,
        practiceStatsVisibility: user.practiceStatsVisibility || 'private',
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
 * Verify user email address with cryptographic token.
 * GET /api/auth/verify-email?token=<token>
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req, res) => {
  try {
    const rawToken = req.query?.token || req.body?.token;
    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        status: 'error',
        code: 'TOKEN_REQUIRED',
        message: 'Verification token is required.',
      });
    }

    const token = rawToken.trim();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Query active user with matching token that has not expired
    const user = await User.findOne({
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      // Check if token matched an expired token
      const expiredUser = await User.findOne({ verificationTokenHash: tokenHash });
      if (expiredUser) {
        return res.status(400).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          message: 'This email verification link has expired. Please request a new verification link.',
        });
      }

      return res.status(400).json({
        status: 'error',
        code: 'TOKEN_INVALID',
        message: 'Invalid or already used verification link.',
      });
    }

    // Mark as verified and invalidate token (single-use guarantee)
    user.emailVerified = true;
    user.verificationTokenHash = null;
    user.verificationTokenExpires = null;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Email verified successfully! You can now log in to CodeSpeed.',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] VerifyEmail error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during email verification.',
    });
  }
};

/**
 * Resend email verification link with rate limiting / cooldown.
 * POST /api/auth/resend-verification
 */
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Email address is required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    // Anti-enumeration generic response if account does not exist or is already verified
    const genericSuccess = {
      status: 'success',
      message: 'If an unverified account with that email exists, a verification link has been sent.',
    };

    if (!user || user.emailVerified) {
      return res.status(200).json(genericSuccess);
    }

    // Cooldown check: 60 seconds per resend attempt
    const now = Date.now();
    if (user.lastVerificationEmailSentAt) {
      const timeSinceLast = now - new Date(user.lastVerificationEmailSentAt).getTime();
      const cooldownMs = 60 * 1000;
      if (timeSinceLast < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLast) / 1000);
        return res.status(429).json({
          status: 'error',
          code: 'RATE_LIMITED',
          message: `Please wait ${remainingSeconds} seconds before requesting another verification email.`,
          retryAfterSeconds: remainingSeconds,
        });
      }
    }

    // Generate new single-use token & 24-hour expiry (invalidating previous token)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationTokenExpires = new Date(now + 24 * 60 * 60 * 1000);

    user.verificationTokenHash = verificationTokenHash;
    user.verificationTokenExpires = verificationTokenExpires;
    user.lastVerificationEmailSentAt = new Date(now);
    await user.save();

    await sendVerificationEmail(user.email, user.username, rawVerificationToken);

    return res.status(200).json({
      status: 'success',
      message: 'A fresh verification link has been sent to your email address.',
    });
  } catch (error) {
    console.error('[Auth Controller] ResendVerification error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error resending verification email.',
    });
  }
};

/**
 * Get current authenticated user details.
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      status: 'success',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified ?? true,
        bio: user.bio || '',
        profilePhoto: user.profilePhoto || null,
        practiceStatsVisibility: user.practiceStatsVisibility || 'private',
        createdAt: user.createdAt,
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

/**
 * Update authenticated user profile and account details.
 * PATCH /api/auth/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    const { username, bio, profilePhoto, practiceStatsVisibility } = req.body || {};

    // 1. Update Username (supports Unicode letters, numbers, and underscores)
    if (username !== undefined) {
      const trimmedUsername = typeof username === 'string' ? username.trim() : '';
      if (!usernameRegex.test(trimmedUsername)) {
        return res.status(400).json({
          status: 'error',
          message: 'Username must be between 3 and 30 characters and contain only letters, numbers, and underscores.',
        });
      }

      // If changed, check uniqueness
      if (trimmedUsername.toLowerCase() !== user.username.toLowerCase()) {
        const duplicate = await User.findOne({
          _id: { $ne: userId },
          username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') },
        });
        if (duplicate) {
          return res.status(409).json({
            status: 'error',
            message: 'This username is already taken. Please choose another.',
          });
        }
      }
      user.username = trimmedUsername;
    }

    // 2. Update Bio
    if (bio !== undefined) {
      const trimmedBio = typeof bio === 'string' ? bio.trim() : '';
      if (trimmedBio.length > 200) {
        return res.status(400).json({
          status: 'error',
          message: 'Bio cannot exceed 200 characters.',
        });
      }
      user.bio = trimmedBio;
    }

    // 3. Update Profile Photo
    if (profilePhoto !== undefined) {
      if (profilePhoto === null || profilePhoto === '') {
        user.profilePhoto = null;
      } else if (typeof profilePhoto === 'string') {
        if (profilePhoto.length > 350000) {
          return res.status(400).json({
            status: 'error',
            message: 'Profile photo is too large. Maximum image size is 250KB.',
          });
        }
        if (!dataUriRegex.test(profilePhoto)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid image format. Supported formats: PNG, JPEG, WebP, GIF.',
          });
        }
        user.profilePhoto = profilePhoto;
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid profile photo data.',
        });
      }
    }

    // 4. Update Practice Visibility
    if (practiceStatsVisibility !== undefined) {
      const normalizedVisibility = String(practiceStatsVisibility).toLowerCase().trim();
      if (!['private', 'public'].includes(normalizedVisibility)) {
        return res.status(400).json({
          status: 'error',
          message: "Invalid visibility. Must be 'private' or 'public'.",
        });
      }
      user.practiceStatsVisibility = normalizedVisibility;
    }

    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          bio: user.bio || '',
          profilePhoto: user.profilePhoto || null,
          practiceStatsVisibility: user.practiceStatsVisibility,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('[Auth Controller] UpdateProfile error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error updating profile.',
    });
  }
};

/**
 * Change authenticated user password.
 * POST /api/auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'New password and confirmation do not match.',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        status: 'error',
        message: 'New password cannot exceed 128 characters.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password is incorrect.',
      });
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('[Auth Controller] ChangePassword error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error changing password.',
    });
  }
};

/**
 * Update authenticated user privacy settings (backward-compatible alias).
 * PATCH /api/auth/privacy
 */
export const updatePrivacy = async (req, res) => {
  return updateProfile(req, res);
};

/**
 * Retrieve a user's shareable public profile.
 * GET /api/users/:username/profile
 * Ranked data is ALWAYS public. Practice data is included for the owner or if practiceStatsVisibility is 'public'.
 */
export const getPublicProfile = async (req, res) => {
  try {
    const usernameParam = req.params?.username ? req.params.username.trim() : '';
    if (!usernameParam) {
      return res.status(400).json({
        status: 'error',
        message: 'Username parameter is required.',
      });
    }

    const user = await User.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(usernameParam)}$`, 'i') },
    });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: `User '${usernameParam}' not found.`,
      });
    }

    // Check if the requester is the profile owner via authenticated JWT
    const isOwner = Boolean(req.user?.id && req.user.id.toString() === user._id.toString());

    // 1. Ranked Data (Always Public)
    const rankedDocs = await Performance.find({ userId: user._id, mode: 'ranked' }).sort({ createdAt: 1 });
    const rankedBadges = evaluateBadges(rankedDocs);

    let rankedSummary = {
      totalTests: 0,
      totalTimeTypedSeconds: 0,
      averageWpm: 0,
      averageAccuracy: 0,
      personalBest: null,
    };

    if (rankedDocs.length > 0) {
      const total = rankedDocs.length;
      const totalTime = rankedDocs.reduce((acc, r) => acc + (r.elapsedSeconds || 0), 0);
      const sumWpm = rankedDocs.reduce((acc, r) => acc + (r.wpm || 0), 0);
      const sumAcc = rankedDocs.reduce((acc, r) => acc + (r.accuracy || 0), 0);
      const sortedPb = [...rankedDocs].sort((a, b) => {
        if (b.wpm !== a.wpm) return b.wpm - a.wpm;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      const pb = sortedPb[0];
      rankedSummary = {
        totalTests: total,
        totalTimeTypedSeconds: totalTime,
        averageWpm: Math.round(sumWpm / total),
        averageAccuracy: Math.round((sumAcc / total) * 10) / 10,
        personalBest: {
          wpm: pb.wpm,
          accuracy: pb.accuracy,
          language: pb.language,
          difficulty: pb.difficulty,
          timerSeconds: pb.timerSeconds,
          createdAt: pb.createdAt,
        },
      };
    }

    const rankedGraph = rankedDocs.map((p, i) => ({
      id: p._id ? p._id.toString() : p.id,
      attemptNumber: i + 1,
      wpm: p.wpm,
      accuracy: p.accuracy,
      language: p.language,
      difficulty: p.difficulty,
      timerSeconds: p.timerSeconds,
      createdAt: p.createdAt,
    }));

    // 2. Practice Data: Included if requester is the profile owner OR user has public visibility
    let practiceData = null;
    if (isOwner || user.practiceStatsVisibility === 'public') {
      const practiceDocs = await Performance.find({
        userId: user._id,
        $or: [{ mode: 'practice' }, { mode: { $exists: false } }],
      }).sort({ createdAt: 1 });

      let practiceSummary = {
        totalTests: 0,
        totalTimeTypedSeconds: 0,
        averageWpm: 0,
        averageAccuracy: 0,
        personalBest: null,
      };

      if (practiceDocs.length > 0) {
        const total = practiceDocs.length;
        const totalTime = practiceDocs.reduce((acc, r) => acc + (r.elapsedSeconds || 0), 0);
        const sumWpm = practiceDocs.reduce((acc, r) => acc + (r.wpm || 0), 0);
        const sumAcc = practiceDocs.reduce((acc, r) => acc + (r.accuracy || 0), 0);
        const sortedPb = [...practiceDocs].sort((a, b) => {
          if (b.wpm !== a.wpm) return b.wpm - a.wpm;
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        const pb = sortedPb[0];
        practiceSummary = {
          totalTests: total,
          totalTimeTypedSeconds: totalTime,
          averageWpm: Math.round(sumWpm / total),
          averageAccuracy: Math.round((sumAcc / total) * 10) / 10,
          personalBest: {
            wpm: pb.wpm,
            accuracy: pb.accuracy,
            language: pb.language,
            difficulty: pb.difficulty,
            timerSeconds: pb.timerSeconds,
            createdAt: pb.createdAt,
          },
        };
      }

      const practiceGraph = practiceDocs.map((p, i) => ({
        id: p._id ? p._id.toString() : p.id,
        attemptNumber: i + 1,
        wpm: p.wpm,
        accuracy: p.accuracy,
        language: p.language,
        difficulty: p.difficulty,
        timerSeconds: p.timerSeconds,
        createdAt: p.createdAt,
      }));

      practiceData = {
        summary: practiceSummary,
        graphData: practiceGraph,
      };
    }

    return res.status(200).json({
      status: 'success',
      data: {
        username: user.username,
        memberSince: user.createdAt,
        bio: user.bio || '',
        profilePhoto: user.profilePhoto || null,
        isOwner,
        ranked: {
          summary: rankedSummary,
          badges: rankedBadges,
          graphData: rankedGraph,
        },
        practice: practiceData,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] GetPublicProfile error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving public profile.',
    });
  }
};

/**
 * Search users by username for developer discovery.
 * GET /api/users/search?q=<query>
 */
export const searchUsers = async (req, res) => {
  try {
    const rawQuery = req.query?.q ? String(req.query.q).trim() : '';

    // Minimum query length 2 characters to prevent massive broad searches
    if (!rawQuery || rawQuery.length < 2) {
      return res.status(200).json({
        status: 'success',
        data: [],
      });
    }

    // Limit maximum query length
    const query = rawQuery.slice(0, 50);

    // Escape regex characters safely for case-insensitive partial substring match
    const searchRegex = new RegExp(escapeRegex(query), 'i');

    const users = await User.find({ username: { $regex: searchRegex } })
      .select('username bio profilePhoto -_id')
      .sort({ username: 1 })
      .limit(10);

    const safeResults = users.map((u) => ({
      username: u.username,
      bio: u.bio || '',
      profilePhoto: u.profilePhoto || null,
    }));

    return res.status(200).json({
      status: 'success',
      data: safeResults,
    });
  } catch (error) {
    console.error('[Auth Controller] SearchUsers error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error searching developers.',
    });
  }
};
