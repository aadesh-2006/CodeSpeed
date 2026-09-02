import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index.js';
import User from '../src/models/User.js';
import Performance from '../src/models/Performance.js';

const JWT_TEST_SECRET = 'codespeed_test_secret_key_12345';
process.env.JWT_SECRET = JWT_TEST_SECRET;
process.env.NODE_ENV = 'test';

describe('Performance Persistence API Tests', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;
  let testUser;
  let testToken;
  const testDbPath = path.resolve('node_modules/.cache/test-perf-db-' + Date.now());

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

    // Create a test user
    const passwordHash = await bcrypt.hash('Password123!', 8);
    testUser = await User.create({
      username: 'perfuser',
      email: 'perfuser@example.com',
      passwordHash,
    });

    testToken = jwt.sign({ id: testUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

    // Start HTTP server on random port
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
      if (fs.existsSync(testDbPath)) {
        fs.rmSync(testDbPath, { recursive: true, force: true });
      }
    } catch {
      // Cleanup best effort
    }
  });

  // Helper function to send HTTP requests
  async function makeRequest(endpoint, { method = 'POST', body, token } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const validPayload = {
    language: 'javascript',
    difficulty: 'medium',
    timerSeconds: 60,
    wpm: 75,
    accuracy: 98.5,
    correctChars: 375,
    incorrectChars: 6,
    elapsedSeconds: 60,
    snippetId: 'js-medium-01',
  };

  describe('Authentication Enforcement', () => {
    test('rejects unauthenticated request with 401 when no token is provided', async () => {
      const res = await makeRequest('/api/performances', {
        body: validPayload,
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, 'error');
      assert.ok(res.data.message.includes('Authentication required'));
    });

    test('rejects request with 401 when invalid token is provided', async () => {
      const res = await makeRequest('/api/performances', {
        body: validPayload,
        token: 'invalid_token_xyz',
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, 'error');
    });
  });

  describe('Successful Performance Creation', () => {
    test('persists performance and returns 201 with saved document', async () => {
      const res = await makeRequest('/api/performances', {
        body: validPayload,
        token: testToken,
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.status, 'success');
      assert.ok(res.data.data.performance);

      const perf = res.data.data.performance;
      assert.ok(perf.id);
      assert.equal(perf.userId, testUser._id.toString());
      assert.equal(perf.language, 'javascript');
      assert.equal(perf.difficulty, 'medium');
      assert.equal(perf.timerSeconds, 60);
      assert.equal(perf.wpm, 75);
      assert.equal(perf.accuracy, 98.5);
      assert.equal(perf.correctChars, 375);
      assert.equal(perf.incorrectChars, 6);
      assert.equal(perf.elapsedSeconds, 60);
      assert.equal(perf.snippetId, 'js-medium-01');
      assert.ok(perf.createdAt);

      // Verify in MongoDB directly
      const inDb = await Performance.findById(perf.id);
      assert.ok(inDb);
      assert.equal(inDb.wpm, 75);
    });

    test('allows elapsedSeconds to be 0', async () => {
      const payloadZeroElapsed = {
        ...validPayload,
        elapsedSeconds: 0,
        snippetId: 'js-easy-01',
      };
      const res = await makeRequest('/api/performances', {
        body: payloadZeroElapsed,
        token: testToken,
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.data.performance.elapsedSeconds, 0);
    });
  });

  describe('User Isolation & Security', () => {
    test('server derives userId exclusively from JWT and ignores client-supplied userId', async () => {
      const spoofedUserId = new mongoose.Types.ObjectId().toString();
      const payloadWithSpoofedUser = {
        ...validPayload,
        userId: spoofedUserId, // Attacker attempts to forge another user's ID
      };

      const res = await makeRequest('/api/performances', {
        body: payloadWithSpoofedUser,
        token: testToken,
      });

      assert.equal(res.status, 201);
      const perf = res.data.data.performance;
      // Stored record must belong to testUser, NOT spoofedUserId
      assert.equal(perf.userId, testUser._id.toString());
      assert.notEqual(perf.userId, spoofedUserId);

      const inDb = await Performance.findById(perf.id);
      assert.equal(inDb.userId.toString(), testUser._id.toString());
    });
  });

  describe('Validation Enforcement (400 Bad Request)', () => {
    test('rejects missing or unsupported language', async () => {
      const resMissing = await makeRequest('/api/performances', {
        body: { ...validPayload, language: '' },
        token: testToken,
      });
      assert.equal(resMissing.status, 400);

      const resInvalid = await makeRequest('/api/performances', {
        body: { ...validPayload, language: 'ruby' },
        token: testToken,
      });
      assert.equal(resInvalid.status, 400);
      assert.ok(resInvalid.data.message.includes('Unsupported language'));
    });

    test('rejects invalid difficulty level', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, difficulty: 'impossible' },
        token: testToken,
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.message.includes('Invalid difficulty'));
    });

    test('rejects invalid timer duration', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, timerSeconds: 45 }, // 45s is not in [30, 60, 120, 180, 240, 300, 600]
        token: testToken,
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.message.includes('Invalid timer duration'));
    });

    test('rejects negative WPM or non-numeric WPM', async () => {
      const resNeg = await makeRequest('/api/performances', {
        body: { ...validPayload, wpm: -10 },
        token: testToken,
      });
      assert.equal(resNeg.status, 400);

      const resStr = await makeRequest('/api/performances', {
        body: { ...validPayload, wpm: 'fast' },
        token: testToken,
      });
      assert.equal(resStr.status, 400);
    });

    test('rejects accuracy out of 0-100 range', async () => {
      const resHigh = await makeRequest('/api/performances', {
        body: { ...validPayload, accuracy: 105 },
        token: testToken,
      });
      assert.equal(resHigh.status, 400);

      const resLow = await makeRequest('/api/performances', {
        body: { ...validPayload, accuracy: -5 },
        token: testToken,
      });
      assert.equal(resLow.status, 400);
    });

    test('rejects negative character counts', async () => {
      const resCorrect = await makeRequest('/api/performances', {
        body: { ...validPayload, correctChars: -1 },
        token: testToken,
      });
      assert.equal(resCorrect.status, 400);

      const resIncorrect = await makeRequest('/api/performances', {
        body: { ...validPayload, incorrectChars: -1 },
        token: testToken,
      });
      assert.equal(resIncorrect.status, 400);
    });

    test('rejects negative elapsedSeconds', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, elapsedSeconds: -1 },
        token: testToken,
      });
      assert.equal(res.status, 400);
    });

    test('rejects empty or missing snippetId', async () => {
      const resEmpty = await makeRequest('/api/performances', {
        body: { ...validPayload, snippetId: '   ' },
        token: testToken,
      });
      assert.equal(resEmpty.status, 400);

      const resMissing = await makeRequest('/api/performances', {
        body: { ...validPayload, snippetId: undefined },
        token: testToken,
      });
      assert.equal(resMissing.status, 400);
    });
  });
});
