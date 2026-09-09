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

describe('Daily Typing Streak System Tests (Unified Ranked + Practice)', () => {
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

    test('returns zero streak and 7 empty days when no performance records exist', () => {
      const result = calculateDailyStreak([], {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 0);
      assert.equal(result.longestStreak, 0);
      assert.equal(result.activeToday, false);
      assert.equal(result.today, today);
      assert.equal(result.recentDays.length, 7);
      assert.equal(result.recentDays[6].isToday, true);
      assert.equal(result.recentDays[6].active, false);
    });

    test('first session today (Ranked or Practice) creates streak = 1 and longest = 1', () => {
      const timestamps = ['2026-09-09T10:00:00Z'];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 1);
      assert.equal(result.longestStreak, 1);
      assert.equal(result.activeToday, true);
      assert.equal(result.recentDays[6].active, true);
    });

    test('second consecutive day (yesterday + today) creates streak = 2', () => {
      const timestamps = ['2026-09-08T15:00:00Z', '2026-09-09T11:00:00Z'];
      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });
      assert.equal(result.currentStreak, 2);
      assert.equal(result.longestStreak, 2);
      assert.equal(result.activeToday, true);
    });

    test('multiple sessions on same day count once without duplicating streak', () => {
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
      assert.equal(result.activeToday, true);
    });

    test('missed day breaks current streak (current = 0), while longest streak is preserved', () => {
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
      assert.equal(result.activeToday, false);
      assert.equal(result.recentDays[6].active, false); // today
      assert.equal(result.recentDays[5].active, false); // yesterday
      assert.equal(result.recentDays[4].active, true);  // 2026-09-07
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
      assert.equal(result.activeToday, true);
    });

    test('timezone-aware date formatting shifts boundaries accurately', () => {
      const ts = '2026-09-09T23:30:00Z';
      const dateUtc = formatDateInTimezone(ts, 'UTC');
      const dateIst = formatDateInTimezone(ts, 'Asia/Kolkata');

      assert.equal(dateUtc, '2026-09-09');
      assert.equal(dateIst, '2026-09-10');
    });
  });

  describe('Database & API Integration Tests (Ranked and Practice Combined)', () => {
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

    test('first Practice session creates streak = 1', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 60,
        accuracy: 98,
        correctChars: 300,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-1',
        createdAt: new Date(),
      });

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, true);
      assert.equal(resData.data.currentStreak, 1);
      assert.equal(resData.data.longestStreak, 1);
    });

    test('first Ranked session creates streak = 1', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 120,
        wpm: 75,
        accuracy: 99,
        correctChars: 450,
        incorrectChars: 2,
        elapsedSeconds: 120,
        snippetId: 'py-1',
        createdAt: new Date(),
      });

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, true);
      assert.equal(resData.data.currentStreak, 1);
      assert.equal(resData.data.longestStreak, 1);
    });

    test('Practice yesterday followed by Ranked today creates consecutive streak = 2', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // Practice yesterday
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

      // Ranked today
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
        createdAt: today,
      });

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, true);
      assert.equal(resData.data.currentStreak, 2);
      assert.equal(resData.data.longestStreak, 2);
    });

    test('Ranked yesterday followed by Practice today creates consecutive streak = 2', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // Ranked yesterday
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'c',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 72,
        accuracy: 99,
        correctChars: 320,
        incorrectChars: 1,
        elapsedSeconds: 60,
        snippetId: 'c-1',
        createdAt: yesterday,
      });

      // Practice today
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 68,
        accuracy: 96,
        correctChars: 180,
        incorrectChars: 4,
        elapsedSeconds: 30,
        snippetId: 'py-1',
        createdAt: today,
      });

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, true);
      assert.equal(resData.data.currentStreak, 2);
      assert.equal(resData.data.longestStreak, 2);
    });

    test('multiple Ranked and Practice sessions on same day count as single active day', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();

      // 3 Ranked + 2 Practice sessions today
      for (let i = 0; i < 3; i++) {
        await Performance.create({
          userId: userA._id,
          mode: 'ranked',
          language: 'javascript',
          difficulty: 'medium',
          timerSeconds: 60,
          wpm: 70 + i,
          accuracy: 98,
          correctChars: 300,
          incorrectChars: 2,
          elapsedSeconds: 60,
          snippetId: `js-ranked-${i}`,
          createdAt: new Date(today.getTime() + i * 1000),
        });
      }

      for (let i = 0; i < 2; i++) {
        await Performance.create({
          userId: userA._id,
          mode: 'practice',
          language: 'python',
          difficulty: 'easy',
          timerSeconds: 30,
          wpm: 65 + i,
          accuracy: 97,
          correctChars: 150,
          incorrectChars: 3,
          elapsedSeconds: 30,
          snippetId: `py-prac-${i}`,
          createdAt: new Date(today.getTime() + (i + 5) * 1000),
        });
      }

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, true);
      assert.equal(resData.data.currentStreak, 1);
      assert.equal(resData.data.longestStreak, 1);
    });

    test('practice private and public privacy settings both count equally', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const today = new Date();

      // User A (private)
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

      // User B (public)
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
      assert.equal(resA.rb.data.activeToday, true);
      assert.equal(resA.rb.data.currentStreak, 1);

      assert.equal(resB.sc, 200);
      assert.equal(resB.rb.data.activeToday, true);
      assert.equal(resB.rb.data.currentStreak, 1);
    });

    test('historical Ranked and Practice records contribute to longest streak', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      // 4-day historical run in August
      const dates = [
        new Date('2026-08-10T12:00:00Z'),
        new Date('2026-08-11T12:00:00Z'),
        new Date('2026-08-12T12:00:00Z'),
        new Date('2026-08-13T12:00:00Z'),
      ];

      // Alternate Ranked and Practice
      for (let i = 0; i < dates.length; i++) {
        await Performance.create({
          userId: userA._id,
          mode: i % 2 === 0 ? 'ranked' : 'practice',
          language: 'html',
          difficulty: 'easy',
          timerSeconds: 30,
          wpm: 50,
          accuracy: 95,
          correctChars: 120,
          incorrectChars: 2,
          elapsedSeconds: 30,
          snippetId: `snippet-${i}`,
          createdAt: dates[i],
        });
      }

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.activeToday, false);
      assert.equal(resData.data.currentStreak, 0);
      assert.equal(resData.data.longestStreak, 4);
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
        mode: 'ranked',
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

      // Query User A: did NOT type today -> activeToday = false, currentStreak = 0, longestStreak = 1
      await getUserStreak({ user: { id: userA._id.toString() }, query: { timezone: 'UTC' } }, res);
      assert.equal(sc, 200);
      assert.equal(rb.data.activeToday, false);
      assert.equal(rb.data.currentStreak, 0);
      assert.equal(rb.data.longestStreak, 1);
    });
  });
});
