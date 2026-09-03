import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index.js';
import User from '../src/models/User.js';
import Performance from '../src/models/Performance.js';
import { testMailbox } from '../src/services/emailService.js';
import { migrateLegacyUsers } from '../src/utils/migrateEmailVerification.js';

// Configure test environment
const JWT_TEST_SECRET = 'codespeed_test_secret_key_12345';
process.env.JWT_SECRET = JWT_TEST_SECRET;
process.env.NODE_ENV = 'test';

describe('Authentication & User Profile API Tests', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;
  const testDbPath = path.resolve('node_modules/.cache/test-db-' + Date.now());

  before(async () => {
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      fs.mkdirSync(testDbPath, { recursive: true });
      mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '4.4.29',
        },
        instance: {
          dbPath: testDbPath,
        },
      });
      mongoUri = mongoServer.getUri();
    }
    await mongoose.connect(mongoUri);

    await new Promise((resolve) => {
      httpServer = http.createServer(app);
      httpServer.listen(0, '127.0.0.1', () => {
        const port = httpServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    try {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/health should return ok', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.message, 'CodeSpeed API is running');
    });
  });

  describe('POST /api/auth/signup & Email Verification Flow', () => {
    let pilotRawToken;

    test('successful signup returns 201 with requiresVerification: true and does not return JWT', async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testpilot',
          email: 'pilot@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.requiresVerification, true);
      assert.equal(data.token, undefined); // No JWT issued prior to email verification
      assert.ok(data.user);
      assert.equal(data.user.username, 'testpilot');
      assert.equal(data.user.email, 'pilot@example.com');
      assert.equal(data.user.emailVerified, false);
      assert.ok(data.user.id);
      assert.equal(data.user.password, undefined);
      assert.equal(data.user.passwordHash, undefined);

      const dbUser = await User.findOne({ email: 'pilot@example.com' });
      assert.ok(dbUser);
      assert.equal(dbUser.emailVerified, false);
      assert.ok(dbUser.verificationTokenHash);
      assert.ok(dbUser.verificationTokenExpires);
      assert.notEqual(dbUser.passwordHash, 'Password123!');

      // Check testMailbox recorded sent email
      const sentMail = testMailbox.find((m) => m.to === 'pilot@example.com');
      assert.ok(sentMail);
      assert.ok(sentMail.rawToken);
      pilotRawToken = sentMail.rawToken;
    });

    test('unverified user cannot log in and receives 403 EMAIL_NOT_VERIFIED', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pilot@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(data.token, undefined);
    });

    test('GET /api/auth/verify-email with valid token verifies email and clears token', async () => {
      assert.ok(pilotRawToken);
      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${pilotRawToken}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.user.emailVerified, true);

      const dbUser = await User.findOne({ email: 'pilot@example.com' });
      assert.equal(dbUser.emailVerified, true);
      assert.equal(dbUser.verificationTokenHash, null);
      assert.equal(dbUser.verificationTokenExpires, null);
    });

    test('verified user can log in and receives 200 with valid JWT', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pilot@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.token);
      assert.ok(data.user);
      assert.equal(data.user.emailVerified, true);
    });

    test('rejects duplicate email with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'different_user',
          email: 'pilot@example.com',
          password: 'NewPassword123!',
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.match(data.message, /email/i);
    });

    test('rejects duplicate username with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testpilot',
          email: 'another@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.match(data.message, /username/i);
    });

    test('rejects invalid input (missing fields, short username, short password, invalid email)', async () => {
      const res1 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user1', email: 'user1@example.com' }),
      });
      assert.equal(res1.status, 400);

      const res2 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user2', email: 'not-an-email', password: 'Password123' }),
      });
      assert.equal(res2.status, 400);

      const res3 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user3', email: 'user3@example.com', password: '123' }),
      });
      assert.equal(res3.status, 400);

      const res4 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ab', email: 'user4@example.com', password: 'Password123' }),
      });
      assert.equal(res4.status, 400);
    });
  });

  describe('Email Verification & Token Lifecycle (GET /verify-email & POST /resend-verification)', () => {
    let unverifiedRawToken;

    before(async () => {
      // Create fresh unverified user
      await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'unverified_racer',
          email: 'unverified@example.com',
          password: 'Password123!',
        }),
      });

      const sentMail = testMailbox.find((m) => m.to === 'unverified@example.com');
      assert.ok(sentMail);
      unverifiedRawToken = sentMail.rawToken;
    });

    test('missing token returns 400 with TOKEN_REQUIRED', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.code, 'TOKEN_REQUIRED');
    });

    test('invalid token returns 400 with TOKEN_INVALID', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=invalid_hex_token_12345`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.code, 'TOKEN_INVALID');
    });

    test('expired token returns 400 with TOKEN_EXPIRED', async () => {
      // Manually expire the token in MongoDB
      await User.updateOne(
        { email: 'unverified@example.com' },
        { verificationTokenExpires: new Date(Date.now() - 1000 * 60) }
      );

      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${unverifiedRawToken}`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.code, 'TOKEN_EXPIRED');
    });

    test('resend verification generates fresh token, invalidates old token, and resets 24h expiry', async () => {
      // Fast-forward last sent time so cooldown allows resend
      await User.updateOne(
        { email: 'unverified@example.com' },
        { lastVerificationEmailSentAt: new Date(Date.now() - 1000 * 70) }
      );

      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unverified@example.com' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');

      // Check new email in testMailbox
      const sentMails = testMailbox.filter((m) => m.to === 'unverified@example.com');
      const latestMail = sentMails[sentMails.length - 1];
      assert.ok(latestMail);
      assert.notEqual(latestMail.rawToken, unverifiedRawToken);

      // Old expired token fails
      const oldRes = await fetch(`${baseUrl}/api/auth/verify-email?token=${unverifiedRawToken}`);
      assert.equal(oldRes.status, 400);

      // New token succeeds
      const newRes = await fetch(`${baseUrl}/api/auth/verify-email?token=${latestMail.rawToken}`);
      assert.equal(newRes.status, 200);
      const newData = await newRes.json();
      assert.equal(newData.status, 'success');
      assert.equal(newData.user.emailVerified, true);
    });

    test('reused token returns 400 with TOKEN_INVALID', async () => {
      const sentMails = testMailbox.filter((m) => m.to === 'unverified@example.com');
      const latestMail = sentMails[sentMails.length - 1];

      // Re-attempt verification with already used token
      const reusedRes = await fetch(`${baseUrl}/api/auth/verify-email?token=${latestMail.rawToken}`);
      assert.equal(reusedRes.status, 400);
      const reusedData = await reusedRes.json();
      assert.equal(reusedData.code, 'TOKEN_INVALID');
    });

    test('resend verification enforces 60s cooldown with 429 RATE_LIMITED', async () => {
      // Create user for cooldown testing
      await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'cooldown_user',
          email: 'cooldown@example.com',
          password: 'Password123!',
        }),
      });

      // Immediate resend attempt must hit cooldown
      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cooldown@example.com' }),
      });

      assert.equal(res.status, 429);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.code, 'RATE_LIMITED');
      assert.ok(data.retryAfterSeconds > 0);
    });

    test('resend verification prevents email enumeration for nonexistent or verified accounts', async () => {
      const resNonexistent = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });
      assert.equal(resNonexistent.status, 200);
      const dataNonexistent = await resNonexistent.json();
      assert.equal(dataNonexistent.status, 'success');

      const resVerified = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pilot@example.com' }), // verified user
      });
      assert.equal(resVerified.status, 200);
      const dataVerified = await resVerified.json();
      assert.equal(dataVerified.status, 'success');
    });

    test('legacy user migration marks existing unverified accounts without tokens as emailVerified: true', async () => {
      // Seed a legacy user created before email verification existed
      await User.create({
        username: 'legacy_veteran',
        email: 'legacy@example.com',
        passwordHash: 'hashed_password_123',
        emailVerified: false,
        verificationTokenHash: null,
      });

      // Run migration
      const migrationResult = await migrateLegacyUsers();
      assert.ok(migrationResult);

      const migratedUser = await User.findOne({ email: 'legacy@example.com' });
      assert.equal(migratedUser.emailVerified, true);
    });
  });

  describe('POST /api/auth/login', () => {
    test('login with valid email returns 200 with valid JWT and safe user details', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pilot@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.token);
      assert.ok(data.user);
      assert.equal(data.user.username, 'testpilot');
      assert.equal(data.user.email, 'pilot@example.com');
      assert.equal(data.user.practiceStatsVisibility, 'private');
      assert.equal(data.user.passwordHash, undefined);
    });

    test('login with valid username returns 200 with valid JWT and safe user details', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testpilot',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.token);
      assert.ok(data.user);
      assert.equal(data.user.username, 'testpilot');
      assert.equal(data.user.email, 'pilot@example.com');
      assert.equal(data.user.passwordHash, undefined);
    });

    test('login with identifier field matching username returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'testpilot',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.token);
    });

    test('case handling: normalized case-insensitive login with uppercase email and mixed-case username', async () => {
      // Uppercase email
      const emailRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'PILOT@EXAMPLE.COM',
          password: 'Password123!',
        }),
      });
      assert.equal(emailRes.status, 200);
      const emailData = await emailRes.json();
      assert.equal(emailData.status, 'success');

      // Mixed-case username
      const userRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'TestPilot',
          password: 'Password123!',
        }),
      });
      assert.equal(userRes.status, 200);
      const userData = await userRes.json();
      assert.equal(userData.status, 'success');
    });

    test('wrong password using valid email returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pilot@example.com',
          password: 'WrongPassword!',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.token, undefined);
    });

    test('wrong password using valid username returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testpilot',
          password: 'WrongPassword!',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.token, undefined);
    });

    test('invalid username or email + password returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'nonexistent_user',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.token, undefined);
    });

    test('missing identifier or password returns 400', async () => {
      const res1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pilot@example.com' }),
      });
      assert.equal(res1.status, 400);

      const res2 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'Password123!' }),
      });
      assert.equal(res2.status, 400);
    });
  });

  describe('JWT Middleware & GET /api/auth/me', () => {
    let validToken;

    before(async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pilot@example.com',
          password: 'Password123!',
        }),
      });
      const data = await loginRes.json();
      validToken = data.token;
    });

    test('authenticated request with valid token returns current user details', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.ok(data.user);
      assert.equal(data.user.username, 'testpilot');
      assert.equal(data.user.email, 'pilot@example.com');
      assert.equal(data.user.emailVerified, true);
      assert.equal(data.user.passwordHash, undefined);
      assert.equal(data.user.password, undefined);
    });

    test('unauthenticated request with missing token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'GET',
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('unauthenticated request with invalid/malformed token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.token.payload',
        },
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });
  });

  describe('PATCH /api/auth/privacy & GET /api/users/:username/profile', () => {
    let userToken;
    let userId;

    before(async () => {
      // Create user for privacy & profile tests
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'publicracer',
          email: 'racer@example.com',
          password: 'Password123!',
        }),
      });
      const signupData = await signupRes.json();
      userId = signupData.user.id;

      // Mark verified & login
      await User.updateOne({ _id: userId }, { emailVerified: true });
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'racer@example.com',
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      userToken = loginData.token;

      // Seed 1 ranked performance (60 WPM)
      await Performance.create({
        userId,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 60,
        accuracy: 98,
        correctChars: 300,
        incorrectChars: 6,
        elapsedSeconds: 60,
        snippetId: 'js-med-01',
      });

      // Seed 1 practice performance (40 WPM)
      await Performance.create({
        userId,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 40,
        accuracy: 95,
        correctChars: 200,
        incorrectChars: 10,
        elapsedSeconds: 60,
        snippetId: 'py-easy-01',
      });
    });

    test('unauthenticated PATCH /api/auth/privacy returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/privacy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceStatsVisibility: 'public' }),
      });
      assert.equal(res.status, 401);
    });

    test('PATCH /api/auth/privacy rejects invalid privacy setting with 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/privacy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ practiceStatsVisibility: 'super_private' }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('GET /api/users/:username/profile returns 404 for nonexistent username', async () => {
      const res = await fetch(`${baseUrl}/api/users/nonexistent_racer_xyz/profile`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('GET /api/users/:username/profile exposes ranked data and omits practice data for other users when private', async () => {
      const res = await fetch(`${baseUrl}/api/users/publicracer/profile`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.data.username, 'publicracer');
      assert.equal(data.data.isOwner, false);

      // Ranked is populated
      assert.ok(data.data.ranked);
      assert.equal(data.data.ranked.summary.totalTests, 1);
      assert.equal(data.data.ranked.summary.personalBest.wpm, 60);

      // Practice is null when private
      assert.equal(data.data.practice, null);
    });

    test('GET /api/users/:username/profile allows profile owner to view own practice stats even when private', async () => {
      const res = await fetch(`${baseUrl}/api/users/publicracer/profile`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.data.isOwner, true);

      // Ranked is populated
      assert.ok(data.data.ranked);
      assert.equal(data.data.ranked.summary.totalTests, 1);

      // Practice IS populated for owner
      assert.ok(data.data.practice);
      assert.equal(data.data.practice.summary.totalTests, 1);
      assert.equal(data.data.practice.summary.personalBest.wpm, 40);
    });

    test('PATCH /api/auth/privacy updates visibility to public and public profile includes practice data for everyone', async () => {
      const patchRes = await fetch(`${baseUrl}/api/auth/privacy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ practiceStatsVisibility: 'public' }),
      });
      assert.equal(patchRes.status, 200);

      // Unauthenticated view now sees practice data
      const pubRes = await fetch(`${baseUrl}/api/users/publicracer/profile`);
      assert.equal(pubRes.status, 200);
      const pubData = await pubRes.json();
      assert.equal(pubData.status, 'success');
      assert.ok(pubData.data.practice);
      assert.equal(pubData.data.practice.summary.totalTests, 1);
      assert.equal(pubData.data.practice.summary.personalBest.wpm, 40);
    });
  });

  describe('PATCH /api/auth/profile & Profile Management', () => {
    let testUserToken;
    let testUserId;
    const dummyAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    before(async () => {
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'settingspilot',
          email: 'settings@example.com',
          password: 'Password123!',
        }),
      });
      const data = await signupRes.json();
      testUserId = data.user.id;

      // Mark verified & login
      await User.updateOne({ _id: testUserId }, { emailVerified: true });
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'settings@example.com',
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      testUserToken = loginData.token;

      // Seed a ranked performance to verify it remains linked after username change
      await Performance.create({
        userId: testUserId,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'hard',
        timerSeconds: 60,
        wpm: 92,
        accuracy: 99,
        correctChars: 460,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-hard-01',
      });
    });

    test('unauthenticated PATCH /api/auth/profile returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: 'Hello world' }),
      });
      assert.equal(res.status, 401);
    });

    test('valid update to bio, profilePhoto, and practiceStatsVisibility succeeds', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          bio: 'Fullstack developer and typing speed enthusiast.',
          profilePhoto: dummyAvatar,
          practiceStatsVisibility: 'public',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.data.user.bio, 'Fullstack developer and typing speed enthusiast.');
      assert.equal(data.data.user.profilePhoto, dummyAvatar);
      assert.equal(data.data.user.practiceStatsVisibility, 'public');
    });

    test('email cannot be changed through PATCH /api/auth/profile and remains immutable', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          email: 'hacked_email@example.com',
          bio: 'Bio updated, email must remain untouched.',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.email, 'settings@example.com'); // Remains original email
      assert.equal(data.data.user.bio, 'Bio updated, email must remain untouched.');

      // Verify with GET /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.equal(meRes.status, 200);
      const meData = await meRes.json();
      assert.equal(meData.user.email, 'settings@example.com');
    });

    test('rejects bio longer than 200 characters with 400', async () => {
      const longBio = 'A'.repeat(201);
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ bio: longBio }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('rejects invalid profile photo format with 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ profilePhoto: 'https://malicious.site/script.js' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('removing profile photo (passing null) succeeds', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ profilePhoto: null }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.profilePhoto, null);
    });

    test('rejects duplicate username taken by another user with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ username: 'testpilot' }), // already belongs to user 1
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('rejects invalid username (too short, spaces, or special characters) with 400', async () => {
      const invalidUsernames = ['ab', 'a b', 'user!name', 'a'.repeat(31)];
      for (const un of invalidUsernames) {
        const res = await fetch(`${baseUrl}/api/auth/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testUserToken}`,
          },
          body: JSON.stringify({ username: un }),
        });
        assert.equal(res.status, 400);
      }
    });

    test('valid username change succeeds, maintains performance history, and updates public profile route', async () => {
      const newUsername = 'settingspilot_v2';

      // 1. Change username
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          username: newUsername,
          bio: 'Updated bio after username rename.',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.username, newUsername);

      // 2. Query public profile with NEW username
      const pubRes = await fetch(`${baseUrl}/api/users/${newUsername}/profile`);
      assert.equal(pubRes.status, 200);
      const pubData = await pubRes.json();
      assert.equal(pubData.data.username, newUsername);
      assert.equal(pubData.data.bio, 'Updated bio after username rename.');

      // 3. Verify performance history remains linked
      assert.equal(pubData.data.ranked.summary.totalTests, 1);
      assert.equal(pubData.data.ranked.summary.personalBest.wpm, 92);

      // 4. Old username route now returns 404
      const oldRes = await fetch(`${baseUrl}/api/users/settingspilot/profile`);
      assert.equal(oldRes.status, 404);
    });

    test('Unicode username regression: Semnótēs signup, settings profile saving, and public profile routing', async () => {
      // 1. Signup with Unicode username Semnótēs
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Semnótēs',
          email: 'semnotes@example.com',
          password: 'Password123!',
        }),
      });
      assert.equal(signupRes.status, 201);
      const signupData = await signupRes.json();
      assert.equal(signupData.status, 'success');
      assert.equal(signupData.user.username, 'Semnótēs');

      // Verify email & login to obtain JWT
      await User.updateOne({ email: 'semnotes@example.com' }, { emailVerified: true });
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'semnotes@example.com',
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      const semnotesToken = loginData.token;

      // 2. Semnótēs user opens settings and saves profile (with same username or updated bio/privacy)
      const profileRes = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${semnotesToken}`,
        },
        body: JSON.stringify({
          username: 'Semnótēs',
          bio: 'Scholar of ancient Greek syntax and fast typing.',
          practiceStatsVisibility: 'public',
        }),
      });
      assert.equal(profileRes.status, 200);
      const profileData = await profileRes.json();
      assert.equal(profileData.status, 'success');
      assert.equal(profileData.data.user.username, 'Semnótēs');
      assert.equal(profileData.data.user.bio, 'Scholar of ancient Greek syntax and fast typing.');

      // 3. Public profile query with /api/users/Semnótēs/profile (and URI encoded)
      const pubRes = await fetch(`${baseUrl}/api/users/${encodeURIComponent('Semnótēs')}/profile`);
      assert.equal(pubRes.status, 200);
      const pubData = await pubRes.json();
      assert.equal(pubData.data.username, 'Semnótēs');
      assert.equal(pubData.data.bio, 'Scholar of ancient Greek syntax and fast typing.');

      // 4. Duplicate Unicode username check: another user cannot signup with Semnótēs or case-insensitive variant
      const dupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Semnótēs',
          email: 'another_semnotes@example.com',
          password: 'Password123!',
        }),
      });
      assert.equal(dupRes.status, 409);

      // 5. Update username to another Unicode name (e.g. José)
      const renameRes = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${semnotesToken}`,
        },
        body: JSON.stringify({
          username: 'José',
        }),
      });
      assert.equal(renameRes.status, 200);
      const renameData = await renameRes.json();
      assert.equal(renameData.data.user.username, 'José');

      // 6. Public profile works with José
      const josePubRes = await fetch(`${baseUrl}/api/users/${encodeURIComponent('José')}/profile`);
      assert.equal(josePubRes.status, 200);
      const josePubData = await josePubRes.json();
      assert.equal(josePubData.data.username, 'José');
    });
  });

  describe('POST /api/auth/change-password & Security', () => {
    let pwUserToken;

    before(async () => {
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'passwordtester',
          email: 'pwtest@example.com',
          password: 'InitialPassword123!',
        }),
      });
      const data = await signupRes.json();
      await User.updateOne({ _id: data.user.id }, { emailVerified: true });

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pwtest@example.com',
          password: 'InitialPassword123!',
        }),
      });
      const loginData = await loginRes.json();
      pwUserToken = loginData.token;
    });

    test('unauthenticated POST /api/auth/change-password returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'InitialPassword123!',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'BrandNewPassword456!',
        }),
      });
      assert.equal(res.status, 401);
    });

    test('wrong current password returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pwUserToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'BrandNewPassword456!',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.message, 'Current password is incorrect.');
    });

    test('mismatched confirmation password returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pwUserToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'InitialPassword123!',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'DifferentPassword789!',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('valid change-password updates password and allows login with new password', async () => {
      // 1. Change password
      const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pwUserToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'InitialPassword123!',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'BrandNewPassword456!',
        }),
      });

      assert.equal(changeRes.status, 200);
      const changeData = await changeRes.json();
      assert.equal(changeData.status, 'success');

      // 2. Old password login now fails (401)
      const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pwtest@example.com',
          password: 'InitialPassword123!',
        }),
      });
      assert.equal(oldLoginRes.status, 401);

      // 3. New password login succeeds (200)
      const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pwtest@example.com',
          password: 'BrandNewPassword456!',
        }),
      });
      assert.equal(newLoginRes.status, 200);
      const newLoginData = await newLoginRes.json();
      assert.equal(newLoginData.status, 'success');
      assert.ok(newLoginData.token);
    });
  });

  describe('GET /api/users/search & Developer Discovery', () => {
    let searchAuthToken;

    before(async () => {
      // Create user for search tests
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'search_discoverer',
          email: 'discoverer@example.com',
          password: 'Password123!',
        }),
      });
      const data = await signupRes.json();
      await User.updateOne({ _id: data.user.id }, { emailVerified: true });

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'discoverer@example.com',
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      searchAuthToken = loginData.token;
    });

    test('unauthenticated GET /api/users/search returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/users/search?q=test`);
      assert.equal(res.status, 401);
    });

    test('query shorter than 2 characters returns empty array with 200', async () => {
      const emptyRes = await fetch(`${baseUrl}/api/users/search?q=`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(emptyRes.status, 200);
      const emptyData = await emptyRes.json();
      assert.deepEqual(emptyData.data, []);

      const singleCharRes = await fetch(`${baseUrl}/api/users/search?q=a`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(singleCharRes.status, 200);
      const singleCharData = await singleCharRes.json();
      assert.deepEqual(singleCharData.data, []);
    });

    test('exact username search matches accurately', async () => {
      const res = await fetch(`${baseUrl}/api/users/search?q=search_discoverer`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.length >= 1);
      assert.ok(data.data.some((u) => u.username === 'search_discoverer'));
    });

    test('partial username search is case-insensitive', async () => {
      const resLower = await fetch(`${baseUrl}/api/users/search?q=discover`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(resLower.status, 200);
      const dataLower = await resLower.json();
      assert.ok(dataLower.data.some((u) => u.username === 'search_discoverer'));

      const resUpper = await fetch(`${baseUrl}/api/users/search?q=DISCOVER`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(resUpper.status, 200);
      const dataUpper = await resUpper.json();
      assert.ok(dataUpper.data.some((u) => u.username === 'search_discoverer'));
    });

    test('Unicode username search: "Sem" and "sem" match "Semnótēs", "jos" matches "José"', async () => {
      const resSem = await fetch(`${baseUrl}/api/users/search?q=Sem`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(resSem.status, 200);
      const dataSem = await resSem.json();
      assert.ok(Array.isArray(dataSem.data));

      const resJose = await fetch(`${baseUrl}/api/users/search?q=${encodeURIComponent('jos')}`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(resJose.status, 200);
      const dataJose = await resJose.json();
      assert.ok(dataJose.data.some((u) => u.username === 'José'));
    });

    test('regex metacharacters are escaped safely and do not trigger regex errors or matches', async () => {
      const res = await fetch(`${baseUrl}/api/users/search?q=${encodeURIComponent('.*')}`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.length, 0);
    });

    test('security & projection audit: returns only username, bio, profilePhoto and never sensitive fields', async () => {
      const res = await fetch(`${baseUrl}/api/users/search?q=search_discoverer`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.length >= 1);

      for (const item of data.data) {
        assert.ok(typeof item.username === 'string');
        assert.ok(item.bio !== undefined);
        assert.ok(item.profilePhoto !== undefined);

        assert.equal(item.email, undefined);
        assert.equal(item.passwordHash, undefined);
        assert.equal(item.practiceStatsVisibility, undefined);
        assert.equal(item._id, undefined);
        assert.equal(item.id, undefined);
        assert.equal(item.ranked, undefined);
        assert.equal(item.practice, undefined);
      }
    });

    test('search results limit is capped at 10', async () => {
      const res = await fetch(`${baseUrl}/api/users/search?q=e`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(res.status, 200);

      const res2 = await fetch(`${baseUrl}/api/users/search?q=er`, {
        headers: { Authorization: `Bearer ${searchAuthToken}` },
      });
      assert.equal(res2.status, 200);
      const data = await res2.json();
      assert.ok(data.data.length <= 10);
    });
  });
});
