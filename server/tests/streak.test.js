import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Performance from '../src/models/Performance.js';
import {
  calculateDailyStreak,
  formatDateInTimezone,
  daysDifference,
  addDays,
} from '../src/utils/streakCalculator.js';

const JWT_TEST_SECRET = 'codespeed_test_secret_key_12345';
process.env.JWT_SECRET = JWT_TEST_SECRET;
process.env.NODE_ENV = 'test';

const generateToken = (userId) => jwt.sign({ id: userId }, JWT_TEST_SECRET, { expiresIn: '7d' });

describe('Daily Practice Streak System Tests', () => {
  let mongoServer;
  let userA, userB;
  let tokenA, tokenB;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Performance.deleteMany({});

    userA = await User.create({
      username: 'streaker_dev',
      email: 'streaker@example.com',
      passwordHash: 'dummyhash',
      emailVerified: true,
      practiceStatsVisibility: 'private',
    });
    tokenA = generateToken(userA._id.toString());

    userB = await User.create({
      username: 'other_dev',
      email: 'other@example.com',
      passwordHash: 'dummyhash',
      emailVerified: true,
      practiceStatsVisibility: 'public',
    });
    tokenB = generateToken(userB._id.toString());
  });

  describe('Pure Logic Streak Calculator Unit Tests', () => {
    const today = '2026-09-09';

    test('returns zero streak and 7 empty days when no practice records exist', () => {
      const result = calculateDailyStreak([], {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 0);
      assert.equal(result.longestStreak, 0);
      assert.equal(result.practicedToday, false);
      assert.equal(result.today, today);
      assert.equal(result.recentDays.length, 7);
      assert.equal(result.recentDays[6].isToday, true);
      assert.equal(result.recentDays[6].practiced, false);
    });

    test('first Practice session today creates streak = 1 and longest = 1', () => {
      const timestamps = ['2026-09-09T10:00:00Z'];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 1);
      assert.equal(result.longestStreak, 1);
      assert.equal(result.practicedToday, true);
      assert.equal(result.recentDays[6].practiced, true);
    });

    test('second consecutive Practice day (yesterday + today) creates streak = 2', () => {
      const timestamps = ['2026-09-08T15:00:00Z', '2026-09-09T11:00:00Z'];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 2);
      assert.equal(result.longestStreak, 2);
      assert.equal(result.practicedToday, true);
    });

    test('multiple Practice sessions on same day count once without duplicating streak', () => {
      const timestamps = [
        '2026-09-08T09:00:00Z',
        '2026-09-08T14:30:00Z',
        '2026-09-08T22:00:00Z',
        '2026-09-09T08:00:00Z',
        '2026-09-09T18:00:00Z',
      ];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 2);
      assert.equal(result.longestStreak, 2);
      assert.equal(result.practicedToday, true);
    });

    test('missed day breaks current streak (current = 0), while longest streak is preserved', () => {
      // Practiced 3 consecutive days, missed yesterday and today
      const timestamps = [
        '2026-09-05T10:00:00Z',
        '2026-09-06T10:00:00Z',
        '2026-09-07T10:00:00Z',
      ];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 0);
      assert.equal(result.longestStreak, 3);
      assert.equal(result.practicedToday, false);
      assert.equal(result.recentDays[6].practiced, false); // today
      assert.equal(result.recentDays[5].practiced, false); // yesterday
      assert.equal(result.recentDays[4].practiced, true);  // 2026-09-07
    });

    test('computes longest streak across multiple historical non-contiguous runs', () => {
      const timestamps = [
        // Run 1: 2 days
        '2026-08-01T10:00:00Z',
        '2026-08-02T10:00:00Z',
        // Gap
        // Run 2: 4 days (longest)
        '2026-08-10T10:00:00Z',
        '2026-08-11T10:00:00Z',
        '2026-08-12T10:00:00Z',
        '2026-08-13T10:00:00Z',
        // Gap
        // Run 3: 3 days (current)
        '2026-09-07T10:00:00Z',
        '2026-09-08T10:00:00Z',
        '2026-09-09T10:00:00Z',
      ];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 3);
      assert.equal(result.longestStreak, 4);
      assert.equal(result.practicedToday, true);
    });

    test('timezone-aware date formatting shifts boundaries accurately', () => {
      // 2026-09-09 23:30 UTC is 2026-09-10 05:00 in Asia/Kolkata
      const ts = '2026-09-09T23:30:00Z';
      const dateUtc = formatDateInTimezone(ts, 'UTC');
      const dateIst = formatDateInTimezone(ts, 'Asia/Kolkata');

      assert.equal(dateUtc, '2026-09-09');
      assert.equal(dateIst, '2026-09-10');
    });
  });

  describe('Database & API Integration Tests', () => {
    test('unauthenticated request returns 401', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const req = { user: null, query: {} };
      let statusCode = null;
      let responseBody = null;

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
            },
          };
        },
      };

      await getUserStreak(req, res);
      assert.equal(statusCode, 401);
      assert.equal(responseBody.status, 'error');
    });

    test('derives streak exclusively from practice records and ignores ranked records', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // Create Practice record yesterday
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 65,
        accuracy: 98.5,
        correctChars: 300,
        incorrectChars: 5,
        elapsedSeconds: 58,
        snippetId: 'js-1',
        createdAt: yesterday,
      });

      // Create Practice record today
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 70,
        accuracy: 99.0,
        correctChars: 350,
        incorrectChars: 3,
        elapsedSeconds: 59,
        snippetId: 'py-1',
        createdAt: today,
      });

      // Create Ranked records on consecutive days (should NOT be mixed in or artificially inflate)
      const dayBeforeYesterday = new Date(Date.now() - 2 * 86400000);
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'cpp',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 80,
        accuracy: 97.5,
        correctChars: 400,
        incorrectChars: 10,
        elapsedSeconds: 118,
        snippetId: 'cpp-1',
        createdAt: dayBeforeYesterday,
      });

      const req = { user: { id: userA._id.toString() }, query: { timezone: 'UTC' } };
      let statusCode = null;
      let responseBody = null;

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
            },
          };
        },
      };

      await getUserStreak(req, res);
      assert.equal(statusCode, 200);
      assert.equal(responseBody.status, 'success');
      assert.equal(responseBody.data.currentStreak, 2);
      assert.equal(responseBody.data.longestStreak, 2);
      assert.equal(responseBody.data.practicedToday, true);
    });

    test('practice private and public privacy settings both count equally', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();

      // User A has practiceStatsVisibility: 'private'
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 60,
        accuracy: 95,
        correctChars: 250,
        incorrectChars: 10,
        elapsedSeconds: 60,
        snippetId: 'js-1',
        createdAt: today,
      });

      // User B has practiceStatsVisibility: 'public'
      await Performance.create({
        userId: userB._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 98,
        correctChars: 320,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'py-1',
        createdAt: today,
      });

      const executeStreak = async (user) => {
        let sc = null;
        let rb = null;
        const res = {
          status: (c) => {
            sc = c;
            return { json: (d) => { rb = d; } };
          },
        };
        await getUserStreak({ user: { id: user._id.toString() }, query: { timezone: 'UTC' } }, res);
        return { sc, rb };
      };

      const resA = await executeStreak(userA);
      const resB = await executeStreak(userB);

      assert.equal(resA.sc, 200);
      assert.equal(resA.rb.data.practicedToday, true);
      assert.equal(resA.rb.data.currentStreak, 1);

      assert.equal(resB.sc, 200);
      assert.equal(resB.rb.data.practicedToday, true);
      assert.equal(resB.rb.data.currentStreak, 1);
    });

    test('enforces strict user isolation: User A streak contains zero User B records', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // User A practiced yesterday
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 60,
        accuracy: 95,
        correctChars: 250,
        incorrectChars: 10,
        elapsedSeconds: 60,
        snippetId: 'js-1',
        createdAt: yesterday,
      });

      // User B practiced today
      await Performance.create({
        userId: userB._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 98,
        correctChars: 320,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'py-1',
        createdAt: today,
      });

      let sc = null;
      let rb = null;
      const res = {
        status: (c) => {
          sc = c;
          return { json: (d) => { rb = d; } };
        },
      };

      // Query User A: did NOT practice today -> currentStreak = 0, longestStreak = 1
      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(sc, 200);
      assert.equal(rb.data.practicedToday, false);
      assert.equal(rb.data.currentStreak, 0);
      assert.equal(rb.data.longestStreak, 1);
    });
  });
});
