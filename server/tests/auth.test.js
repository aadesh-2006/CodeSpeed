import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index.js';
import User from '../src/models/User.js';

// Configure test environment
const JWT_TEST_SECRET = 'codespeed_test_secret_key_12345';
process.env.JWT_SECRET = JWT_TEST_SECRET;
process.env.NODE_ENV = 'test';

describe('Authentication API Tests', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;
  const testDbPath = path.resolve('node_modules/.cache/test-db-' + Date.now());

  before(async () => {
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      fs.mkdirSync(testDbPath, { recursive: true });
      // Start MongoMemoryServer for isolated integration testing
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

    // Start HTTP server on random available port
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
      // Ignored if file locked
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
      assert.ok(data.user.id);
      // Password or passwordHash must NEVER be returned
      assert.equal(data.user.password, undefined);
      assert.equal(data.user.passwordHash, undefined);

      // Verify user exists in MongoDB and stores passwordHash, not plaintext
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
      // Missing password
      const res1 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user1', email: 'user1@example.com' }),
      });
      assert.equal(res1.status, 400);

      // Invalid email format
      const res2 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user2', email: 'not-an-email', password: 'Password123' }),
      });
      assert.equal(res2.status, 400);

      // Password too short (< 6 chars)
      const res3 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user3', email: 'user3@example.com', password: '123' }),
      });
      assert.equal(res3.status, 400);

      // Username too short (< 3 chars)
      const res4 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ab', email: 'user4@example.com', password: 'Password123' }),
      });
      assert.equal(res4.status, 400);
    });
  });

  describe('POST /api/auth/login', () => {
    test('correct credentials returns 200 with valid JWT and safe user details', async () => {
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
      assert.equal(data.user.passwordHash, undefined);
    });

    test('incorrect password returns 401', async () => {
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

    test('nonexistent user returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.status, 'error');
      assert.equal(data.token, undefined);
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
});
