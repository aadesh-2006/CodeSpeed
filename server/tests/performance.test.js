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

describe('Performance Persistence, History & Sorting API Tests', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;
  let testUser;
  let testToken;
  let otherUser;
  let otherToken;
  let emptyUser;
  let emptyToken;
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

    const passwordHash = await bcrypt.hash('Password123!', 8);

    // Primary test user
    testUser = await User.create({
      username: 'perfuser',
      email: 'perfuser@example.com',
      passwordHash,
    });
    testToken = jwt.sign({ id: testUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

    // Second test user (for isolation checks)
    otherUser = await User.create({
      username: 'otheruser',
      email: 'otheruser@example.com',
      passwordHash,
    });
    otherToken = jwt.sign({ id: otherUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

    // Third test user (empty history)
    emptyUser = await User.create({
      username: 'emptyuser',
      email: 'emptyuser@example.com',
      passwordHash,
    });
    emptyToken = jwt.sign({ id: emptyUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

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

  describe('POST /api/performances — Creation & Validation', () => {
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

    test('server derives userId exclusively from JWT and ignores client-supplied userId', async () => {
      const spoofedUserId = new mongoose.Types.ObjectId().toString();
      const payloadWithSpoofedUser = {
        ...validPayload,
        userId: spoofedUserId,
      };

      const res = await makeRequest('/api/performances', {
        body: payloadWithSpoofedUser,
        token: testToken,
      });

      assert.equal(res.status, 201);
      const perf = res.data.data.performance;
      assert.equal(perf.userId, testUser._id.toString());
      assert.notEqual(perf.userId, spoofedUserId);
    });

    test('rejects missing or unsupported language with 400', async () => {
      const resInvalid = await makeRequest('/api/performances', {
        body: { ...validPayload, language: 'ruby' },
        token: testToken,
      });
      assert.equal(resInvalid.status, 400);
      assert.ok(resInvalid.data.message.includes('Unsupported language'));
    });

    test('rejects invalid difficulty level with 400', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, difficulty: 'impossible' },
        token: testToken,
      });
      assert.equal(res.status, 400);
    });

    test('rejects invalid timer duration with 400', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, timerSeconds: 45 },
        token: testToken,
      });
      assert.equal(res.status, 400);
    });

    test('rejects negative WPM with 400', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, wpm: -10 },
        token: testToken,
      });
      assert.equal(res.status, 400);
    });

    test('rejects accuracy out of 0-100 range with 400', async () => {
      const res = await makeRequest('/api/performances', {
        body: { ...validPayload, accuracy: 105 },
        token: testToken,
      });
      assert.equal(res.status, 400);
    });

    test('rejects negative characters and negative elapsedSeconds with 400', async () => {
      const resChars = await makeRequest('/api/performances', {
        body: { ...validPayload, correctChars: -1 },
        token: testToken,
      });
      assert.equal(resChars.status, 400);

      const resElapsed = await makeRequest('/api/performances', {
        body: { ...validPayload, elapsedSeconds: -1 },
        token: testToken,
      });
      assert.equal(resElapsed.status, 400);
    });

    test('rejects empty or missing snippetId with 400', async () => {
      const resEmpty = await makeRequest('/api/performances', {
        body: { ...validPayload, snippetId: '   ' },
        token: testToken,
      });
      assert.equal(resEmpty.status, 400);
    });

    test('successfully saves a multiline practice attempt where correctChars reflects meaningful uninflated characters and satisfies anti-tamper validation', async () => {
      const multilinePayload = {
        mode: 'practice',
        language: 'java',
        difficulty: 'medium',
        timerSeconds: 30,
        wpm: 18,
        accuracy: 100,
        correctChars: 45,
        incorrectChars: 0,
        elapsedSeconds: 30,
        snippetId: 'java-medium-01',
      };

      const res = await makeRequest('/api/performances', {
        body: multilinePayload,
        token: testToken,
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.status, 'success');
      assert.equal(res.data.data.performance.wpm, 18);
      assert.equal(res.data.data.performance.correctChars, 45);
      assert.equal(res.data.data.performance.mode, 'practice');
    });
  });

  describe('GET /api/performances — History Retrieval, Filters, Sorting & Pagination', () => {
    // Seed distinct test records for testUser and otherUser
    before(async () => {
      // Clear existing records before history suite
      await Performance.deleteMany({});

      // Create 4 records for testUser:
      // 1. JS, 60s, easy, 65 WPM (Oldest)
      await Performance.create({
        userId: testUser._id,
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 65,
        accuracy: 97,
        correctChars: 325,
        incorrectChars: 10,
        elapsedSeconds: 60,
        snippetId: 'js-easy-01',
        createdAt: new Date(Date.now() - 40000),
      });

      // 2. Python, 60s, medium, 80 WPM
      await Performance.create({
        userId: testUser._id,
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 99,
        correctChars: 400,
        incorrectChars: 4,
        elapsedSeconds: 60,
        snippetId: 'py-medium-01',
        createdAt: new Date(Date.now() - 30000),
      });

      // 3. Python, 120s, hard, 85 WPM
      await Performance.create({
        userId: testUser._id,
        language: 'python',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 85,
        accuracy: 98,
        correctChars: 850,
        incorrectChars: 17,
        elapsedSeconds: 120,
        snippetId: 'py-hard-01',
        createdAt: new Date(Date.now() - 20000),
      });

      // 4. Python, 60s, easy, 80 WPM (Same WPM as #2, but created newer for tie-break testing)
      await Performance.create({
        userId: testUser._id,
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 99.5,
        correctChars: 400,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'py-easy-01',
        createdAt: new Date(Date.now() - 10000), // Newest for testUser
      });

      // Create 2 records for otherUser
      await Performance.create({
        userId: otherUser._id,
        language: 'java',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 55,
        accuracy: 95,
        correctChars: 275,
        incorrectChars: 14,
        elapsedSeconds: 60,
        snippetId: 'java-easy-01',
      });
      await Performance.create({
        userId: otherUser._id,
        language: 'cpp',
        difficulty: 'medium',
        timerSeconds: 180,
        wpm: 70,
        accuracy: 96,
        correctChars: 630,
        incorrectChars: 26,
        elapsedSeconds: 180,
        snippetId: 'cpp-medium-01',
      });
    });

    test('rejects unauthenticated GET request with 401', async () => {
      const res = await makeRequest('/api/performances', { method: 'GET' });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, 'error');
    });

    test('returns 200 and all performances for authenticated user in newest-first order by default', async () => {
      const res = await makeRequest('/api/performances', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'success');
      assert.equal(res.data.data.performances.length, 4);
      assert.equal(res.data.data.pagination.total, 4);

      // Verify newest first: py-easy-01 -> py-hard-01 -> py-medium-01 -> js-easy-01
      const perfs = res.data.data.performances;
      assert.equal(perfs[0].snippetId, 'py-easy-01');
      assert.equal(perfs[1].snippetId, 'py-hard-01');
      assert.equal(perfs[2].snippetId, 'py-medium-01');
      assert.equal(perfs[3].snippetId, 'js-easy-01');
    });

    test('explicit sort=newest returns records ordered by createdAt descending', async () => {
      const res = await makeRequest('/api/performances?sort=newest', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      const perfs = res.data.data.performances;
      assert.equal(perfs[0].snippetId, 'py-easy-01');
      assert.equal(perfs[1].snippetId, 'py-hard-01');
      assert.equal(perfs[2].snippetId, 'py-medium-01');
      assert.equal(perfs[3].snippetId, 'js-easy-01');
    });

    test('sort=wpm_desc returns records ordered by highest WPM first with deterministic tie-breaking', async () => {
      const res = await makeRequest('/api/performances?sort=wpm_desc', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      const perfs = res.data.data.performances;
      // WPM order: 85 (py-hard-01) -> 80 (py-easy-01 newer) -> 80 (py-medium-01 older) -> 65 (js-easy-01)
      assert.equal(perfs[0].wpm, 85);
      assert.equal(perfs[0].snippetId, 'py-hard-01');

      assert.equal(perfs[1].wpm, 80);
      assert.equal(perfs[1].snippetId, 'py-easy-01'); // newer 80 WPM

      assert.equal(perfs[2].wpm, 80);
      assert.equal(perfs[2].snippetId, 'py-medium-01'); // older 80 WPM

      assert.equal(perfs[3].wpm, 65);
      assert.equal(perfs[3].snippetId, 'js-easy-01');
    });

    test('sort=wpm_asc returns records ordered by lowest WPM first with deterministic tie-breaking', async () => {
      const res = await makeRequest('/api/performances?sort=wpm_asc', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      const perfs = res.data.data.performances;
      // WPM order: 65 (js-easy-01) -> 80 (py-easy-01 newer) -> 80 (py-medium-01 older) -> 85 (py-hard-01)
      assert.equal(perfs[0].wpm, 65);
      assert.equal(perfs[0].snippetId, 'js-easy-01');

      assert.equal(perfs[1].wpm, 80);
      assert.equal(perfs[1].snippetId, 'py-easy-01');

      assert.equal(perfs[2].wpm, 80);
      assert.equal(perfs[2].snippetId, 'py-medium-01');

      assert.equal(perfs[3].wpm, 85);
      assert.equal(perfs[3].snippetId, 'py-hard-01');
    });

    test('combines sort=wpm_desc with language filter', async () => {
      const res = await makeRequest('/api/performances?language=python&sort=wpm_desc', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.performances.length, 3);
      assert.equal(res.data.data.performances[0].wpm, 85);
      assert.equal(res.data.data.performances[1].wpm, 80);
      assert.equal(res.data.data.performances[2].wpm, 80);
      for (const p of res.data.data.performances) {
        assert.equal(p.language, 'python');
      }
    });

    test('combines sort=wpm_asc with timer filter', async () => {
      const res = await makeRequest('/api/performances?timerSeconds=60&sort=wpm_asc', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.performances.length, 3); // js 65 WPM, py 80 WPM, py 80 WPM
      assert.equal(res.data.data.performances[0].wpm, 65);
      assert.equal(res.data.data.performances[1].wpm, 80);
      assert.equal(res.data.data.performances[2].wpm, 80);
      for (const p of res.data.data.performances) {
        assert.equal(p.timerSeconds, 60);
      }
    });

    test('combines sort=wpm_desc with both language and timer filters', async () => {
      const res = await makeRequest('/api/performances?language=python&timerSeconds=60&sort=wpm_desc', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.performances.length, 2);
      assert.equal(res.data.data.performances[0].snippetId, 'py-easy-01'); // newer 80 WPM
      assert.equal(res.data.data.performances[1].snippetId, 'py-medium-01'); // older 80 WPM
    });

    test('sorting applies before pagination (skip & limit) correctly', async () => {
      // Sort wpm_desc with page=1, limit=2: should return 85 WPM and 80 WPM (py-easy-01)
      const resP1 = await makeRequest('/api/performances?sort=wpm_desc&page=1&limit=2', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resP1.status, 200);
      assert.equal(resP1.data.data.performances.length, 2);
      assert.equal(resP1.data.data.performances[0].wpm, 85);
      assert.equal(resP1.data.data.performances[1].wpm, 80);
      assert.equal(resP1.data.data.pagination.page, 1);
      assert.equal(resP1.data.data.pagination.totalPages, 2);

      // Page 2 should return 80 WPM (py-medium-01) and 65 WPM (js-easy-01)
      const resP2 = await makeRequest('/api/performances?sort=wpm_desc&page=2&limit=2', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resP2.status, 200);
      assert.equal(resP2.data.data.performances.length, 2);
      assert.equal(resP2.data.data.performances[0].wpm, 80);
      assert.equal(resP2.data.data.performances[1].wpm, 65);
      assert.equal(resP2.data.data.pagination.page, 2);
    });

    test('rejects unsupported sort options with 400 Bad Request', async () => {
      const resBad = await makeRequest('/api/performances?sort=fastest', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBad.status, 400);
      assert.ok(resBad.data.message.includes('Invalid sort option'));

      const resBadSql = await makeRequest('/api/performances?sort=wpm_ascending', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBadSql.status, 400);
    });

    test('enforces user isolation with sorting active: User A never sees User B records', async () => {
      const resA = await makeRequest('/api/performances?sort=wpm_desc', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resA.data.data.performances.length, 4);
      for (const item of resA.data.data.performances) {
        assert.equal(item.userId, testUser._id.toString());
      }

      const resB = await makeRequest('/api/performances?sort=wpm_desc', {
        method: 'GET',
        token: otherToken,
      });
      assert.equal(resB.data.data.performances.length, 2);
      for (const item of resB.data.data.performances) {
        assert.equal(item.userId, otherUser._id.toString());
      }
    });

    test('returns empty array with total 0 for user with no test history', async () => {
      const res = await makeRequest('/api/performances?sort=wpm_desc', {
        method: 'GET',
        token: emptyToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.performances.length, 0);
      assert.equal(res.data.data.pagination.total, 0);
      assert.equal(res.data.data.pagination.totalPages, 1);
    });

    test('filters accurately by language query parameter', async () => {
      const resPy = await makeRequest('/api/performances?language=python', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resPy.status, 200);
      assert.equal(resPy.data.data.performances.length, 3);
      for (const p of resPy.data.data.performances) {
        assert.equal(p.language, 'python');
      }

      const resJs = await makeRequest('/api/performances?language=javascript', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resJs.status, 200);
      assert.equal(resJs.data.data.performances.length, 1);
      assert.equal(resJs.data.data.performances[0].language, 'javascript');

      // 'all' returns all
      const resAll = await makeRequest('/api/performances?language=all', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resAll.data.data.performances.length, 4);
    });

    test('filters accurately by timerSeconds query parameter', async () => {
      const res60 = await makeRequest('/api/performances?timerSeconds=60', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(res60.status, 200);
      assert.equal(res60.data.data.performances.length, 3);
      for (const p of res60.data.data.performances) {
        assert.equal(p.timerSeconds, 60);
      }

      const res120 = await makeRequest('/api/performances?timerSeconds=120', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(res120.status, 200);
      assert.equal(res120.data.data.performances.length, 1);
      assert.equal(res120.data.data.performances[0].timerSeconds, 120);

      // 'all' returns all
      const resAll = await makeRequest('/api/performances?timerSeconds=all', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resAll.data.data.performances.length, 4);
    });

    test('rejects invalid filter query parameters with 400', async () => {
      const resBadLang = await makeRequest('/api/performances?language=rust', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBadLang.status, 400);
      assert.ok(resBadLang.data.message.includes('Invalid language filter'));

      const resBadTimer = await makeRequest('/api/performances?timerSeconds=999', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBadTimer.status, 400);
      assert.ok(resBadTimer.data.message.includes('Invalid timer filter'));
    });
  });

  describe('GET /api/performances/graph — WPM Progression Graph Data', () => {
    test('rejects unauthenticated GET /graph request with 401', async () => {
      const res = await makeRequest('/api/performances/graph', { method: 'GET' });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, 'error');
    });

    test('returns 200 and all graph points in chronological createdAt ASC order with 1-based attempt numbers', async () => {
      const res = await makeRequest('/api/performances/graph', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'success');
      assert.equal(res.data.data.graphData.length, 4);
      assert.equal(res.data.data.totalCount, 4);
      assert.equal(res.data.data.displayedCount, 4);
      assert.equal(res.data.data.truncated, false);

      const data = res.data.data.graphData;
      // Chronological order: js-easy-01 (oldest) -> py-medium-01 -> py-hard-01 -> py-easy-01 (newest)
      assert.equal(data[0].attemptNumber, 1);
      assert.equal(data[0].snippetId, 'js-easy-01');
      assert.equal(data[0].wpm, 65);

      assert.equal(data[1].attemptNumber, 2);
      assert.equal(data[1].snippetId, 'py-medium-01');
      assert.equal(data[1].wpm, 80);

      assert.equal(data[2].attemptNumber, 3);
      assert.equal(data[2].snippetId, 'py-hard-01');
      assert.equal(data[2].wpm, 85);

      assert.equal(data[3].attemptNumber, 4);
      assert.equal(data[3].snippetId, 'py-easy-01');
      assert.equal(data[3].wpm, 80);
    });

    test('filters graph data by language and re-indexes attempt numbers starting from 1', async () => {
      const res = await makeRequest('/api/performances/graph?language=python', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.graphData.length, 3);
      assert.equal(res.data.data.totalCount, 3);

      const data = res.data.data.graphData;
      assert.equal(data[0].attemptNumber, 1);
      assert.equal(data[0].snippetId, 'py-medium-01');
      assert.equal(data[0].language, 'python');

      assert.equal(data[1].attemptNumber, 2);
      assert.equal(data[1].snippetId, 'py-hard-01');
      assert.equal(data[1].language, 'python');

      assert.equal(data[2].attemptNumber, 3);
      assert.equal(data[2].snippetId, 'py-easy-01');
      assert.equal(data[2].language, 'python');
    });

    test('filters graph data by timerSeconds and re-indexes attempt numbers starting from 1', async () => {
      const res = await makeRequest('/api/performances/graph?timerSeconds=120', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.graphData.length, 1);
      assert.equal(res.data.data.totalCount, 1);
      assert.equal(res.data.data.graphData[0].attemptNumber, 1);
      assert.equal(res.data.data.graphData[0].snippetId, 'py-hard-01');
    });

    test('combines language and timer filters for graph data', async () => {
      const res = await makeRequest('/api/performances/graph?language=python&timerSeconds=60', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.graphData.length, 2);
      assert.equal(res.data.data.graphData[0].attemptNumber, 1);
      assert.equal(res.data.data.graphData[0].snippetId, 'py-medium-01');

      assert.equal(res.data.data.graphData[1].attemptNumber, 2);
      assert.equal(res.data.data.graphData[1].snippetId, 'py-easy-01');
    });

    test('returns empty graphData for user with no test attempts', async () => {
      const res = await makeRequest('/api/performances/graph', {
        method: 'GET',
        token: emptyToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.graphData.length, 0);
      assert.equal(res.data.data.totalCount, 0);
      assert.equal(res.data.data.displayedCount, 0);
      assert.equal(res.data.data.truncated, false);
    });

    test('enforces user isolation: User A graph data contains zero User B records', async () => {
      const resA = await makeRequest('/api/performances/graph', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resA.data.data.graphData.length, 4);

      const resB = await makeRequest('/api/performances/graph', {
        method: 'GET',
        token: otherToken,
      });
      assert.equal(resB.data.data.graphData.length, 2);
      for (const p of resB.data.data.graphData) {
        assert.ok(p.language === 'java' || p.language === 'cpp');
      }
    });

    test('rejects invalid filter query parameters with 400', async () => {
      const resBadLang = await makeRequest('/api/performances/graph?language=golang', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBadLang.status, 400);

      const resBadTimer = await makeRequest('/api/performances/graph?timerSeconds=50', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resBadTimer.status, 400);
    });
  });

  describe('GET /api/performances/summary — Dashboard Aggregation', () => {
    test('rejects unauthenticated GET /summary request with 401', async () => {
      const res = await makeRequest('/api/performances/summary', { method: 'GET' });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, 'error');
    });

    test('returns 200 with accurate user aggregates, personal best, language breakdown, and recent attempts', async () => {
      const res = await makeRequest('/api/performances/summary', {
        method: 'GET',
        token: testToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'success');

      const data = res.data.data;
      assert.equal(data.totalTests, 4);
      assert.equal(data.totalTimeTypedSeconds, 300);
      assert.equal(data.averageWpm, 78);
      assert.equal(data.averageAccuracy, 98.4);

      // Personal Best: highest WPM is py-hard-01 with 85 WPM
      assert.ok(data.personalBest);
      assert.equal(data.personalBest.wpm, 85);
      assert.equal(data.personalBest.accuracy, 98);
      assert.equal(data.personalBest.language, 'python');
      assert.equal(data.personalBest.snippetId, 'py-hard-01');

      // Language Breakdown
      assert.equal(data.languageBreakdown.length, 2);
      const pyLang = data.languageBreakdown.find((l) => l.language === 'python');
      assert.ok(pyLang);
      assert.equal(pyLang.testCount, 3);
      assert.equal(pyLang.bestWpm, 85);
      assert.equal(pyLang.averageWpm, 82);

      const jsLang = data.languageBreakdown.find((l) => l.language === 'javascript');
      assert.ok(jsLang);
      assert.equal(jsLang.testCount, 1);
      assert.equal(jsLang.bestWpm, 65);
      assert.equal(jsLang.averageWpm, 65);

      // Recent 3 attempts in newest-first order
      assert.equal(data.recentAttempts.length, 3);
      assert.equal(data.recentAttempts[0].snippetId, 'py-easy-01');
      assert.equal(data.recentAttempts[1].snippetId, 'py-hard-01');
      assert.equal(data.recentAttempts[2].snippetId, 'py-medium-01');
    });

    test('deterministic Personal Best tie-breaking: highest WPM, then highest accuracy, then newest createdAt', async () => {
      // Create user with tie-break scenarios
      const tieUser = await User.create({
        username: 'tieuser',
        email: 'tieuser@example.com',
        passwordHash: 'dummyhash',
      });
      const tieToken = jwt.sign({ id: tieUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

      // Attempt 1: 90 WPM, 95% acc, older
      await Performance.create({
        userId: tieUser._id,
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 95,
        correctChars: 450,
        incorrectChars: 15,
        elapsedSeconds: 60,
        snippetId: 'py-01',
        createdAt: new Date(Date.now() - 30000),
      });

      // Attempt 2: 90 WPM, 99% acc, newer (should win over attempt 1 due to accuracy)
      await Performance.create({
        userId: tieUser._id,
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 99,
        correctChars: 450,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'py-02',
        createdAt: new Date(Date.now() - 20000),
      });

      // Attempt 3: 90 WPM, 99% acc, newest (should win over attempt 2 due to newest createdAt)
      await Performance.create({
        userId: tieUser._id,
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 99,
        correctChars: 450,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'py-03',
        createdAt: new Date(Date.now() - 10000),
      });

      const res = await makeRequest('/api/performances/summary', {
        method: 'GET',
        token: tieToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.personalBest.snippetId, 'py-03');
    });

    test('returns clean zeroed summary structure for user with zero attempts', async () => {
      const res = await makeRequest('/api/performances/summary', {
        method: 'GET',
        token: emptyToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.totalTests, 0);
      assert.equal(res.data.data.totalTimeTypedSeconds, 0);
      assert.equal(res.data.data.averageWpm, 0);
      assert.equal(res.data.data.averageAccuracy, 0);
      assert.equal(res.data.data.personalBest, null);
      assert.deepEqual(res.data.data.languageBreakdown, []);
      assert.deepEqual(res.data.data.recentAttempts, []);
    });

    test('enforces user isolation: User A summary contains zero User B records', async () => {
      const resA = await makeRequest('/api/performances/summary', {
        method: 'GET',
        token: testToken,
      });
      assert.equal(resA.data.data.totalTests, 4);

      const resB = await makeRequest('/api/performances/summary', {
        method: 'GET',
        token: otherToken,
      });
      assert.equal(resB.data.data.totalTests, 2);
      assert.equal(resB.data.data.personalBest.language, 'cpp');
    });
  });

  /* ========================================================
     M9 — Ranked Mode, Anti-Tamper & Badges API Tests
     ======================================================== */
  describe('M9 — Migration, Ranked Mode, Anti-Tamper & Badges', () => {
    let m9User;
    let m9Token;

    before(async () => {
      m9User = await User.create({
        username: 'rankedchampion',
        email: 'champion@example.com',
        passwordHash: 'dummyhash123',
      });
      m9Token = jwt.sign({ id: m9User._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });
    });

    test('migration script classifies legacy documents missing mode as practice', async () => {
      const { migrateModes } = await import('../scripts/migrate-modes.js');

      // Create a legacy document missing the mode field entirely using native collection
      const legacyDoc = {
        userId: m9User._id,
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 55,
        accuracy: 98,
        correctChars: 275,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'legacy-py-01',
        createdAt: new Date(),
      };
      await Performance.collection.insertOne(legacyDoc);

      const docBefore = await Performance.collection.findOne({ snippetId: 'legacy-py-01' });
      assert.equal(docBefore.mode, undefined);

      // Run migration
      const result = await migrateModes(mongoose);
      assert.ok(result.modifiedCount >= 1);

      const docAfter = await Performance.collection.findOne({ snippetId: 'legacy-py-01' });
      assert.equal(docAfter.mode, 'practice');
    });

    test('POST /api/performances accepts valid mode practice and ranked', async () => {
      const resPractice = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'practice',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 60,
          accuracy: 100,
          correctChars: 300,
          incorrectChars: 0,
          elapsedSeconds: 60,
          snippetId: 'py-prac-01',
        },
      });
      assert.equal(resPractice.status, 201);
      assert.equal(resPractice.data.data.performance.mode, 'practice');

      const resRanked = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 60,
          accuracy: 100,
          correctChars: 300,
          incorrectChars: 0,
          elapsedSeconds: 60,
          snippetId: 'py-rank-01',
        },
      });
      assert.equal(resRanked.status, 201);
      assert.equal(resRanked.data.data.performance.mode, 'ranked');
    });

    test('POST /api/performances rejects invalid mode values with 400', async () => {
      const res = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'unranked_custom',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 60,
          accuracy: 100,
          correctChars: 300,
          incorrectChars: 0,
          elapsedSeconds: 60,
          snippetId: 'py-test-01',
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /mode/i);
    });

    test('anti-tamper: rejects impossible WPM (> 350 WPM) with 400', async () => {
      const res = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 450,
          accuracy: 100,
          correctChars: 2250,
          incorrectChars: 0,
          elapsedSeconds: 60,
          snippetId: 'py-cheat-01',
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /ceiling/i);
    });

    test('anti-tamper: rejects mathematically inconsistent character accuracy with 400', async () => {
      const res = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 60,
          accuracy: 99.5, // Claims 99.5% accuracy but typed 100 correct + 100 incorrect (50% real accuracy)
          correctChars: 300,
          incorrectChars: 300,
          elapsedSeconds: 60,
          snippetId: 'py-cheat-02',
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /inconsistent/i);
    });

    test('anti-tamper: rejects elapsed time exceeding timer duration + 5s grace with 400', async () => {
      const res = await makeRequest('/api/performances', {
        method: 'POST',
        token: m9Token,
        body: {
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 30,
          wpm: 60,
          accuracy: 100,
          correctChars: 150,
          incorrectChars: 0,
          elapsedSeconds: 50, // Exceeds 30s + 5s grace
          snippetId: 'py-cheat-03',
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /grace/i);
    });

    test('GET /api/performances, /graph, and /summary isolate practice vs ranked data', async () => {
      // Create fresh user for mode isolation test
      const isoUser = await User.create({
        username: 'isouser',
        email: 'iso@example.com',
        passwordHash: 'dummyhash',
      });
      const isoToken = jwt.sign({ id: isoUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

      // 1 Practice test: 50 WPM
      await Performance.create({
        userId: isoUser._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 50,
        accuracy: 100,
        correctChars: 250,
        incorrectChars: 0,
        elapsedSeconds: 60,
        snippetId: 'iso-prac-1',
      });

      // 2 Ranked tests: 80 WPM, 90 WPM (with explicit chronological createdAt)
      await Performance.create({
        userId: isoUser._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 100,
        correctChars: 400,
        incorrectChars: 0,
        elapsedSeconds: 60,
        snippetId: 'iso-rank-1',
        createdAt: new Date(Date.now() + 1000),
      });
      await Performance.create({
        userId: isoUser._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 100,
        correctChars: 450,
        incorrectChars: 0,
        elapsedSeconds: 60,
        snippetId: 'iso-rank-2',
        createdAt: new Date(Date.now() + 2000),
      });

      // Query Practice History
      const resPracHist = await makeRequest('/api/performances?mode=practice', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resPracHist.data.data.performances.length, 1);
      assert.equal(resPracHist.data.data.performances[0].snippetId, 'iso-prac-1');

      // Query Ranked History
      const resRankHist = await makeRequest('/api/performances?mode=ranked', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resRankHist.data.data.performances.length, 2);
      assert.equal(resRankHist.data.data.performances[0].snippetId, 'iso-rank-2');

      // Query Practice Summary
      const resPracSum = await makeRequest('/api/performances/summary?mode=practice', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resPracSum.data.data.totalTests, 1);
      assert.equal(resPracSum.data.data.personalBest.wpm, 50);

      // Query Ranked Summary
      const resRankSum = await makeRequest('/api/performances/summary?mode=ranked', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resRankSum.data.data.totalTests, 2);
      assert.equal(resRankSum.data.data.personalBest.wpm, 90);

      // Query Graphs
      const resPracGraph = await makeRequest('/api/performances/graph?mode=practice', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resPracGraph.data.data.graphData.length, 1);

      const resRankGraph = await makeRequest('/api/performances/graph?mode=ranked', {
        method: 'GET',
        token: isoToken,
      });
      assert.equal(resRankGraph.data.data.graphData.length, 2);
    });

    test('GET /api/performances/badges evaluates speed milestones, 5-streaks, streak resets, and volume', async () => {
      const badgeUser = await User.create({
        username: 'badgeuser',
        email: 'badge@example.com',
        passwordHash: 'dummyhash',
      });
      const badgeToken = jwt.sign({ id: badgeUser._id.toString() }, JWT_TEST_SECRET, { expiresIn: '1h' });

      // Check initial 0 tests
      const resInit = await makeRequest('/api/performances/badges', { method: 'GET', token: badgeToken });
      assert.equal(resInit.status, 200);
      assert.equal(resInit.data.data.earnedCount, 0);
      assert.equal(resInit.data.data.totalBadges, 14);

      // Add 1 high practice attempt (120 WPM) -> MUST NOT award any badges
      await Performance.create({
        userId: badgeUser._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'hard',
        timerSeconds: 60,
        wpm: 120,
        accuracy: 100,
        correctChars: 600,
        incorrectChars: 0,
        elapsedSeconds: 60,
        snippetId: 'prac-super',
      });

      const resPracCheck = await makeRequest('/api/performances/badges', { method: 'GET', token: badgeToken });
      assert.equal(resPracCheck.data.data.earnedCount, 0);

      // Add 4 consecutive ranked tests >= 50 WPM
      for (let i = 1; i <= 4; i++) {
        await Performance.create({
          userId: badgeUser._id,
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 55,
          accuracy: 98,
          correctChars: 275,
          incorrectChars: 5,
          elapsedSeconds: 60,
          snippetId: `rank-streak-${i}`,
          createdAt: new Date(Date.now() + i * 1000),
        });
      }

      // Check: 'first_ranked' and 'wpm_50' earned, but 'streak_50_5' NOT yet (only 4 streak)
      const res4Streak = await makeRequest('/api/performances/badges', { method: 'GET', token: badgeToken });
      const badges4 = res4Streak.data.data.badges;
      const bFirst = badges4.find((b) => b.id === 'first_ranked');
      const bWpm50 = badges4.find((b) => b.id === 'wpm_50');
      const bStreak50 = badges4.find((b) => b.id === 'streak_50_5');

      assert.equal(bFirst.earned, true);
      assert.equal(bWpm50.earned, true);
      assert.equal(bStreak50.earned, false);
      assert.equal(bStreak50.progress.current, 4);

      // 5th attempt: drops below 50 WPM (40 WPM) -> Streak breaks!
      await Performance.create({
        userId: badgeUser._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 40,
        accuracy: 98,
        correctChars: 200,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'rank-broken-streak',
        createdAt: new Date(Date.now() + 5000),
      });

      const resBroken = await makeRequest('/api/performances/badges', { method: 'GET', token: badgeToken });
      const bStreakBroken = resBroken.data.data.badges.find((b) => b.id === 'streak_50_5');
      assert.equal(bStreakBroken.earned, false);
      assert.equal(bStreakBroken.progress.activeStreak, 0);

      // Now complete 5 consecutive >= 50 WPM attempts
      for (let i = 6; i <= 10; i++) {
        await Performance.create({
          userId: badgeUser._id,
          mode: 'ranked',
          language: 'python',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 60,
          accuracy: 98,
          correctChars: 300,
          incorrectChars: 5,
          elapsedSeconds: 60,
          snippetId: `rank-streak-win-${i}`,
          createdAt: new Date(Date.now() + i * 1000),
        });
      }

      // Check: 'streak_50_5' and 'ranked_10' NOW earned!
      const resWon = await makeRequest('/api/performances/badges', { method: 'GET', token: badgeToken });
      const bStreakWon = resWon.data.data.badges.find((b) => b.id === 'streak_50_5');
      const bRanked10 = resWon.data.data.badges.find((b) => b.id === 'ranked_10');

      assert.equal(bStreakWon.earned, true);
      assert.equal(bRanked10.earned, true);
    });
  });
});
