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

  describe('POST /api/auth/signup', () => {
    test('successful signup returns 201 with token and safe user details', async () => {
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
      assert.ok(data.token);
      assert.ok(data.user);
      assert.equal(data.user.username, 'testpilot');
      assert.equal(data.user.email, 'pilot@example.com');
      assert.equal(data.user.practiceStatsVisibility, 'private');
      assert.ok(data.user.id);
      assert.equal(data.user.password, undefined);
      assert.equal(data.user.passwordHash, undefined);

      const dbUser = await User.findOne({ email: 'pilot@example.com' });
      assert.ok(dbUser);
      assert.ok(dbUser.passwordHash);
      assert.notEqual(dbUser.passwordHash, 'Password123!');
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
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.status, 'error');
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
      userToken = signupData.token;
      userId = signupData.user.id;

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
        body: JSON.stringify({ practiceStatsVisibility: 'invalid_mode' }),
      });
      assert.equal(res.status, 400);
    });

    test('GET /api/users/:username/profile returns 404 for nonexistent username', async () => {
      const res = await fetch(`${baseUrl}/api/users/nonexistentuser_9999/profile`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.status, 'error');
    });

    test('GET /api/users/:username/profile exposes ranked data and omits practice data for other users when private', async () => {
      // 1. Unauthenticated request
      const resUnauth = await fetch(`${baseUrl}/api/users/publicracer/profile`);
      assert.equal(resUnauth.status, 200);
      const dataUnauth = await resUnauth.json();
      assert.equal(dataUnauth.status, 'success');
      assert.equal(dataUnauth.data.username, 'publicracer');
      assert.equal(dataUnauth.data.isOwner, false);

      // Security check: private fields MUST NOT be exposed
      assert.equal(dataUnauth.data.email, undefined);
      assert.equal(dataUnauth.data.passwordHash, undefined);
      assert.equal(dataUnauth.data.practiceStatsVisibility, undefined);
      assert.equal(dataUnauth.data.practicePrivacy, undefined);

      // Ranked data is ALWAYS exposed
      assert.ok(dataUnauth.data.ranked);
      assert.equal(dataUnauth.data.ranked.summary.totalTests, 1);
      assert.equal(dataUnauth.data.ranked.summary.personalBest.wpm, 60);
      assert.ok(dataUnauth.data.ranked.badges);
      assert.ok(dataUnauth.data.ranked.graphData);
      assert.equal(dataUnauth.data.ranked.graphData.length, 1);

      // Practice data MUST be null for other users when private
      assert.equal(dataUnauth.data.practice, null);
    });

    test('GET /api/users/:username/profile allows profile owner to view own practice stats even when private', async () => {
      // Owner requesting their own profile with auth token
      const resOwner = await fetch(`${baseUrl}/api/users/publicracer/profile`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      assert.equal(resOwner.status, 200);
      const dataOwner = await resOwner.json();
      assert.equal(dataOwner.status, 'success');
      assert.equal(dataOwner.data.username, 'publicracer');
      assert.equal(dataOwner.data.isOwner, true);

      // Owner receives their own practice data
      assert.ok(dataOwner.data.practice);
      assert.equal(dataOwner.data.practice.summary.totalTests, 1);
      assert.equal(dataOwner.data.practice.summary.personalBest.wpm, 40);
      assert.equal(dataOwner.data.practice.graphData.length, 1);

      // Security: sensitive user fields are still never exposed
      assert.equal(dataOwner.data.email, undefined);
      assert.equal(dataOwner.data.passwordHash, undefined);
      assert.equal(dataOwner.data.practiceStatsVisibility, undefined);
    });

    test('PATCH /api/auth/privacy updates visibility to public and public profile includes practice data for everyone', async () => {
      // 1. Update privacy to public
      const patchRes = await fetch(`${baseUrl}/api/auth/privacy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ practiceStatsVisibility: 'public' }),
      });
      assert.equal(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.equal(patchData.data.user.practiceStatsVisibility, 'public');

      // 2. Fetch public profile as unauthenticated viewer
      const profileRes = await fetch(`${baseUrl}/api/users/publicracer/profile`);
      assert.equal(profileRes.status, 200);
      const profileData = await profileRes.json();

      // Practice data is NOW exposed to everyone
      assert.ok(profileData.data.practice);
      assert.equal(profileData.data.practice.summary.totalTests, 1);
      assert.equal(profileData.data.practice.summary.personalBest.wpm, 40);
      assert.equal(profileData.data.practice.graphData.length, 1);
    });
  });
});
