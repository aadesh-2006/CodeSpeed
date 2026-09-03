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
});
