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
      practiceStatsVisibility: 'private',
    });
    tokenA = generateToken(userA._id.toString());

    userB = await User.create({
      username: 'other_dev',
      email: 'other@example.com',
      passwordHash: 'dummyhash',
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

    test('multiple sessions on same day count once without duplicating streak and aggregate dailyActivity testCount', () => {
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

      // Verify dailyActivity aggregation
      assert.ok(Array.isArray(result.dailyActivity));
      assert.equal(result.dailyActivity.length, 2);
      assert.deepEqual(result.dailyActivity, [
        { date: '2026-09-08', testCount: 3 },
        { date: '2026-09-09', testCount: 2 },
      ]);
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

  describe('Public Profile Streak Integration Tests', () => {
    test('public profile contains streak calculated for profile owner', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      const today = new Date();
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 75,
        accuracy: 98,
        correctChars: 300,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-1',
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

      // Unauthenticated visitor
      await getPublicProfile({ params: { username: userA.username } }, res);
      assert.equal(resCode, 200);
      assert.ok(resData.data.streak);
      assert.equal(resData.data.streak.activeToday, true);
      assert.equal(resData.data.streak.currentStreak, 1);
      assert.equal(resData.data.streak.longestStreak, 1);
      assert.ok(Array.isArray(resData.data.streak.recentDays));
      assert.equal(resData.data.streak.recentDays.length, 7);
    });

    test('another authenticated visitor sees profile owner streak (not their own)', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // User A has 2-day streak
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 99,
        correctChars: 320,
        incorrectChars: 1,
        elapsedSeconds: 60,
        snippetId: 'py-1',
        createdAt: yesterday,
      });
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 70,
        accuracy: 97,
        correctChars: 180,
        incorrectChars: 2,
        elapsedSeconds: 30,
        snippetId: 'js-1',
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

      // User B visits User A's profile
      await getPublicProfile({ params: { username: userA.username }, user: { id: userB._id.toString() } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.isOwner, false);
      assert.equal(resData.data.streak.currentStreak, 2);
      assert.equal(resData.data.streak.longestStreak, 2);
      assert.equal(resData.data.streak.activeToday, true);

      // User A visits User B's profile
      await getPublicProfile({ params: { username: userB.username }, user: { id: userA._id.toString() } }, res);
      assert.equal(resCode, 200);
      assert.equal(resData.data.isOwner, false);
      assert.equal(resData.data.streak.currentStreak, 0);
      assert.equal(resData.data.streak.longestStreak, 0);
      assert.equal(resData.data.streak.activeToday, false);
    });

    test('Practice private setting does NOT hide or affect the public streak', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      // Ensure User A is private
      await User.updateOne({ _id: userA._id }, { practiceStatsVisibility: 'private' });

      const today = new Date();
      // User A completed only Practice sessions
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'c',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 65,
        accuracy: 96,
        correctChars: 260,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'c-1',
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

      // Unauthenticated visitor
      await getPublicProfile({ params: { username: userA.username } }, res);
      assert.equal(resCode, 200);
      // Practice stats are hidden (null)
      assert.equal(resData.data.practice, null);
      // But Streak is fully present and public!
      assert.ok(resData.data.streak);
      assert.equal(resData.data.streak.activeToday, true);
      assert.equal(resData.data.streak.currentStreak, 1);
      assert.equal(resData.data.streak.longestStreak, 1);
      // Since visitor and userA practice is private, visitor dailyActivity only has ranked (0 in this case)
      assert.deepEqual(resData.data.streak.dailyActivity, []);

      // But when owner visits their own profile, owner dailyActivity includes their practice session!
      let ownerResCode = null;
      let ownerResData = null;
      const ownerRes = {
        status: (c) => {
          ownerResCode = c;
          return { json: (d) => { ownerResData = d; } };
        },
      };
      await getPublicProfile({ params: { username: userA.username }, user: { id: userA._id.toString() } }, ownerRes);
      assert.equal(ownerResCode, 200);
      assert.equal(ownerResData.data.isOwner, true);
      assert.equal(ownerResData.data.streak.dailyActivity.length, 1);
      assert.equal(ownerResData.data.streak.dailyActivity[0].testCount, 1);
    });

    test('calculates public streak in profile owner timezone', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      // Set userA timezone to Asia/Tokyo (UTC+9)
      await User.updateOne({ _id: userA._id }, { timezone: 'Asia/Tokyo' });

      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'hard',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 99,
        correctChars: 360,
        incorrectChars: 1,
        elapsedSeconds: 60,
        snippetId: 'ts-1',
        createdAt: new Date('2026-09-08T16:00:00.000Z'),
      });

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getPublicProfile({ params: { username: userA.username } }, res);
      assert.equal(resCode, 200);
      assert.ok(resData.data.streak);
      assert.equal(resData.data.streak.recentDays.length, 7);
    });

    test('security audit: public profile never exposes sensitive fields or credentials', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
      };

      await getPublicProfile({ params: { username: userA.username } }, res);
      assert.equal(resCode, 200);
      const data = resData.data;

      assert.equal(data.email, undefined);
      assert.equal(data.passwordHash, undefined);
      assert.equal(data.verificationTokenHash, undefined);
      assert.equal(data.verificationTokenExpires, undefined);
      assert.equal(data.lastVerificationEmailSentAt, undefined);
      assert.equal(data.practiceStatsVisibility, undefined);
      assert.equal(data._id, undefined);
      assert.equal(data.id, undefined);
      assert.equal(data.timezone, undefined);
    });
  });

  describe('Daily Activity Details API Tests (GET /api/users/:username/activity/:date)', () => {
    test('returns 400 for missing or invalid date format', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      await getUserDailyActivity({ params: { username: userA.username, date: 'invalid-date' } }, res);
      assert.equal(resCode, 400);
      assert.equal(resBody.status, 'error');

      await getUserDailyActivity({ params: { username: userA.username, date: '2026-02-31' } }, res);
      assert.equal(resCode, 400);
      assert.equal(resBody.status, 'error');
    });

    test('returns 404 for non-existent user', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      await getUserDailyActivity({ params: { username: 'nonexistent_user', date: '2026-09-10' } }, res);
      assert.equal(resCode, 404);
      assert.equal(resBody.status, 'error');
    });

    test('returns clean 0-test response with 200 for date with no recorded attempts', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      await getUserDailyActivity({ params: { username: userA.username, date: '2026-09-10' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resBody.status, 'success');
      assert.equal(resBody.data.totalTests, 0);
      assert.equal(resBody.data.tests.length, 0);
      assert.equal(resBody.data.formattedDate, 'September 10, 2026');
    });

    test('public visitor sees only Ranked tests when user practiceStatsVisibility is private', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      const targetDate = new Date('2026-09-10T10:00:00Z');

      // 2 Ranked + 1 Practice
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 98,
        correctChars: 320,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-r1',
        createdAt: targetDate,
      });
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 85,
        accuracy: 99,
        correctChars: 180,
        incorrectChars: 1,
        elapsedSeconds: 30,
        snippetId: 'py-r1',
        createdAt: new Date('2026-09-10T14:00:00Z'),
      });
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'cpp',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 75,
        accuracy: 95,
        correctChars: 450,
        incorrectChars: 10,
        elapsedSeconds: 120,
        snippetId: 'cpp-p1',
        createdAt: new Date('2026-09-10T16:00:00Z'),
      });

      // Visitor (unauthenticated or userB) requesting userA's activity
      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      await getUserDailyActivity({ params: { username: userA.username, date: '2026-09-10' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resBody.data.isOwner, false);
      assert.equal(resBody.data.totalTests, 2);
      assert.equal(resBody.data.rankedCount, 2);
      assert.equal(resBody.data.practiceCount, 0);
      assert.ok(resBody.data.tests.every((t) => t.mode === 'ranked'));
    });

    test('profile owner can view both Ranked and Practice attempts on their daily activity', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      // Create 2 Ranked + 1 Practice performances
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 98,
        correctChars: 320,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-r1',
        createdAt: new Date('2026-09-10T10:00:00Z'),
      });
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 85,
        accuracy: 99,
        correctChars: 180,
        incorrectChars: 1,
        elapsedSeconds: 30,
        snippetId: 'py-r1',
        createdAt: new Date('2026-09-10T14:00:00Z'),
      });
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'cpp',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 75,
        accuracy: 95,
        correctChars: 450,
        incorrectChars: 10,
        elapsedSeconds: 120,
        snippetId: 'cpp-p1',
        createdAt: new Date('2026-09-10T16:00:00Z'),
      });

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      // Owner requesting their own activity
      await getUserDailyActivity({
        params: { username: userA.username, date: '2026-09-10' },
        user: { id: userA._id.toString() },
      }, res);

      assert.equal(resCode, 200);
      assert.equal(resBody.data.isOwner, true);
      assert.equal(resBody.data.totalTests, 3);
      assert.equal(resBody.data.rankedCount, 2);
      assert.equal(resBody.data.practiceCount, 1);
    });

    test('public visitor can view Practice attempts when user has practiceStatsVisibility public', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      // User B has practiceStatsVisibility = public
      await Performance.create({
        userId: userB._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 70,
        accuracy: 97,
        correctChars: 280,
        incorrectChars: 3,
        elapsedSeconds: 60,
        snippetId: 'py-p2',
        createdAt: new Date('2026-09-10T11:00:00Z'),
      });

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      // User A visits User B
      await getUserDailyActivity({
        params: { username: userB.username, date: '2026-09-10' },
        user: { id: userA._id.toString() },
      }, res);

      assert.equal(resCode, 200);
      assert.equal(resBody.data.isOwner, false);
      assert.equal(resBody.data.totalTests, 1);
      assert.equal(resBody.data.practiceCount, 1);
      assert.equal(resBody.data.tests[0].mode, 'practice');
    });

    test('accurately filters attempts by calendar date according to user timezone', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      // Set userA timezone to Asia/Tokyo (UTC+9)
      await User.updateOne({ _id: userA._id }, { timezone: 'Asia/Tokyo' });

      // 2026-09-08 16:00:00 UTC is 2026-09-09 01:00:00 in Tokyo
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 90,
        accuracy: 99,
        correctChars: 360,
        incorrectChars: 1,
        elapsedSeconds: 60,
        snippetId: 'js-tz',
        createdAt: new Date('2026-09-08T16:00:00.000Z'),
      });

      let resCode = null;
      let resBody = null;
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
      };

      // Querying 2026-09-09 Tokyo calendar day
      await getUserDailyActivity({ params: { username: userA.username, date: '2026-09-09' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resBody.data.totalTests, 1);
      assert.equal(resBody.data.tests[0].snippetId, 'js-tz');

      // Querying 2026-09-08 Tokyo calendar day -> 0 tests
      await getUserDailyActivity({ params: { username: userA.username, date: '2026-09-08' } }, res);
      assert.equal(resCode, 200);
      assert.equal(resBody.data.totalTests, 0);
    });
  });

  describe('Competition Mode Activity & Daily Streak Integration Tests (Practice + Ranked + Competition)', () => {
    test('first Competition race session creates streak = 1', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      await Performance.create({
        userId: userA._id,
        mode: 'competition',
        roomCode: 'COMP01',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 88,
        accuracy: 99,
        correctChars: 350,
        incorrectChars: 1,
        elapsedSeconds: 52,
        snippetId: 'js-comp-1',
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

    test('multi-day streak across Practice (Day 1) + Ranked (Day 2) + Competition (Day 3) creates streak = 3', async () => {
      const { getUserStreak } = await import('../src/controllers/performanceController.js');

      const now = Date.now();
      const day1 = new Date(now - 2 * 86400000);
      const day2 = new Date(now - 1 * 86400000);
      const day3 = new Date(now);

      // Day 1: Practice
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 60,
        wpm: 65,
        accuracy: 97,
        correctChars: 250,
        incorrectChars: 4,
        elapsedSeconds: 60,
        snippetId: 'p-1',
        createdAt: day1,
      });

      // Day 2: Ranked
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 75,
        accuracy: 98,
        correctChars: 300,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'r-1',
        createdAt: day2,
      });

      // Day 3: Competition
      await Performance.create({
        userId: userA._id,
        mode: 'competition',
        roomCode: 'RACE33',
        language: 'cpp',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 85,
        accuracy: 99,
        correctChars: 400,
        incorrectChars: 1,
        elapsedSeconds: 105,
        snippetId: 'c-1',
        createdAt: day3,
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
      assert.equal(resData.data.currentStreak, 3);
      assert.equal(resData.data.longestStreak, 3);
    });

    test('dailyActivity aggregates Practice, Ranked, and Competition sessions into total counts', async () => {
      const timestamps = [
        '2026-09-08T08:00:00Z', // Practice
        '2026-09-08T12:00:00Z', // Ranked
        '2026-09-08T18:00:00Z', // Competition
        '2026-09-09T09:00:00Z', // Competition 1
        '2026-09-09T15:00:00Z', // Competition 2
      ];

      const result = calculateDailyStreak(timestamps, {
        referenceDate: '2026-09-09T12:00:00Z',
        timeZone: 'UTC',
      });

      assert.equal(result.currentStreak, 2);
      assert.equal(result.longestStreak, 2);
      assert.equal(result.activeToday, true);
      assert.deepEqual(result.dailyActivity, [
        { date: '2026-09-08', testCount: 3 },
        { date: '2026-09-09', testCount: 2 },
      ]);
    });

    test('public profile includes Competition attempts in public visitor heatmap even when Practice is private', async () => {
      const { getPublicProfile } = await import('../src/controllers/authController.js');

      await User.updateOne({ _id: userA._id }, { practiceStatsVisibility: 'private' });

      const today = new Date();

      // User A completes 1 Private Practice + 1 Public Competition attempt today
      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 60,
        accuracy: 95,
        correctChars: 150,
        incorrectChars: 3,
        elapsedSeconds: 30,
        snippetId: 'p-priv',
        createdAt: today,
      });

      await Performance.create({
        userId: userA._id,
        mode: 'competition',
        roomCode: 'PUBLIC_RACE',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 82,
        accuracy: 99,
        correctChars: 320,
        incorrectChars: 1,
        elapsedSeconds: 55,
        snippetId: 'comp-pub',
        createdAt: today,
      });

      // 1. Public Visitor
      let visitorResCode = null;
      let visitorResData = null;
      const visitorRes = {
        status: (c) => {
          visitorResCode = c;
          return { json: (d) => { visitorResData = d; } };
        },
      };

      await getPublicProfile({ params: { username: userA.username } }, visitorRes);
      assert.equal(visitorResCode, 200);
      assert.equal(visitorResData.data.isOwner, false);
      assert.equal(visitorResData.data.practice, null); // Private
      assert.equal(visitorResData.data.streak.activeToday, true);
      assert.equal(visitorResData.data.streak.currentStreak, 1);
      // Visitor sees the 1 competition attempt in dailyActivity
      assert.equal(visitorResData.data.streak.dailyActivity.length, 1);
      assert.equal(visitorResData.data.streak.dailyActivity[0].testCount, 1);

      // 2. Profile Owner
      let ownerResCode = null;
      let ownerResData = null;
      const ownerRes = {
        status: (c) => {
          ownerResCode = c;
          return { json: (d) => { ownerResData = d; } };
        },
      };

      await getPublicProfile({ params: { username: userA.username }, user: { id: userA._id.toString() } }, ownerRes);
      assert.equal(ownerResCode, 200);
      assert.equal(ownerResData.data.isOwner, true);
      // Owner sees all 2 attempts (Practice + Competition) in dailyActivity
      assert.equal(ownerResData.data.streak.dailyActivity.length, 1);
      assert.equal(ownerResData.data.streak.dailyActivity[0].testCount, 2);
    });

    test('daily activity endpoint returns competitionCount and competition attempt details with roomCode', async () => {
      const { getUserDailyActivity } = await import('../src/controllers/authController.js');

      const targetDate = '2026-09-11';
      const createdDate = new Date('2026-09-11T12:00:00Z');

      // 1 Ranked, 1 Practice, 2 Competition attempts
      await Performance.create({
        userId: userA._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 75,
        accuracy: 98,
        correctChars: 300,
        incorrectChars: 2,
        elapsedSeconds: 60,
        snippetId: 'js-r',
        createdAt: createdDate,
      });

      await Performance.create({
        userId: userA._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'easy',
        timerSeconds: 30,
        wpm: 65,
        accuracy: 96,
        correctChars: 150,
        incorrectChars: 3,
        elapsedSeconds: 30,
        snippetId: 'py-p',
        createdAt: new Date('2026-09-11T13:00:00Z'),
      });

      await Performance.create({
        userId: userA._id,
        mode: 'competition',
        roomCode: 'ROOM01',
        language: 'cpp',
        difficulty: 'hard',
        timerSeconds: 120,
        wpm: 90,
        accuracy: 99.5,
        correctChars: 450,
        incorrectChars: 1,
        elapsedSeconds: 98,
        snippetId: 'cpp-c1',
        createdAt: new Date('2026-09-11T14:00:00Z'),
      });

      await Performance.create({
        userId: userA._id,
        mode: 'competition',
        roomCode: 'ROOM02',
        language: 'java',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 85,
        accuracy: 98.2,
        correctChars: 340,
        incorrectChars: 2,
        elapsedSeconds: 58,
        snippetId: 'java-c2',
        createdAt: new Date('2026-09-11T15:00:00Z'),
      });

      // 1. Profile Owner request
      let ownerResCode = null;
      let ownerResBody = null;
      const ownerRes = {
        status: (c) => {
          ownerResCode = c;
          return { json: (d) => { ownerResBody = d; } };
        },
      };

      await getUserDailyActivity({
        params: { username: userA.username, date: targetDate },
        user: { id: userA._id.toString() },
      }, ownerRes);

      assert.equal(ownerResCode, 200);
      assert.equal(ownerResBody.data.totalTests, 4);
      assert.equal(ownerResBody.data.rankedCount, 1);
      assert.equal(ownerResBody.data.practiceCount, 1);
      assert.equal(ownerResBody.data.competitionCount, 2);

      const compTests = ownerResBody.data.tests.filter((t) => t.mode === 'competition');
      assert.equal(compTests.length, 2);
      assert.ok(compTests.some((t) => t.roomCode === 'ROOM01'));
      assert.ok(compTests.some((t) => t.roomCode === 'ROOM02'));

      // 2. Public Visitor request (userA practice is private)
      let visitorResCode = null;
      let visitorResBody = null;
      const visitorRes = {
        status: (c) => {
          visitorResCode = c;
          return { json: (d) => { visitorResBody = d; } };
        },
      };

      await getUserDailyActivity({
        params: { username: userA.username, date: targetDate },
      }, visitorRes);

      assert.equal(visitorResCode, 200);
      assert.equal(visitorResBody.data.isOwner, false);
      // Practice excluded, Ranked (1) + Competition (2) included
      assert.equal(visitorResBody.data.totalTests, 3);
      assert.equal(visitorResBody.data.rankedCount, 1);
      assert.equal(visitorResBody.data.practiceCount, 0);
      assert.equal(visitorResBody.data.competitionCount, 2);
    });
  });
});

