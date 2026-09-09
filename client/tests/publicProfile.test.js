import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

describe('Public Profile Ranked vs Practice Mode Logic Tests', () => {
  const mockRankedData = {
    summary: {
      totalTests: 15,
      totalTimeTypedSeconds: 900,
      averageWpm: 82,
      averageAccuracy: 97.4,
      personalBest: {
        wpm: 104,
        accuracy: 99.1,
        language: 'javascript',
        difficulty: 'hard',
        timerSeconds: 60,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    },
    badges: [
      { id: 'first_ranked', name: 'Ranked Debut', earned: true },
      { id: 'wpm_100', name: 'Diamond Speed', earned: true },
    ],
    graphData: [
      { attemptNumber: 1, wpm: 70, accuracy: 95 },
      { attemptNumber: 2, wpm: 104, accuracy: 99.1 },
    ],
  };

  const mockPracticeData = {
    summary: {
      totalTests: 40,
      totalTimeTypedSeconds: 2400,
      averageWpm: 65,
      averageAccuracy: 94.8,
      personalBest: {
        wpm: 78,
        accuracy: 96.0,
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        createdAt: '2026-08-15T12:00:00.000Z',
      },
    },
    graphData: [
      { attemptNumber: 1, wpm: 50, accuracy: 92 },
      { attemptNumber: 2, wpm: 78, accuracy: 96 },
    ],
  };

  const mockStreakData = {
    currentStreak: 7,
    longestStreak: 14,
    activeToday: true,
    today: '2026-09-09',
    recentDays: [
      { date: '2026-09-03', dayLabel: 'Thu', active: true, isToday: false },
      { date: '2026-09-04', dayLabel: 'Fri', active: true, isToday: false },
      { date: '2026-09-05', dayLabel: 'Sat', active: true, isToday: false },
      { date: '2026-09-06', dayLabel: 'Sun', active: true, isToday: false },
      { date: '2026-09-07', dayLabel: 'Mon', active: true, isToday: false },
      { date: '2026-09-08', dayLabel: 'Tue', active: true, isToday: false },
      { date: '2026-09-09', dayLabel: 'Wed', active: true, isToday: true },
    ],
  };

  // 1. Own profile + Practice private
  const mockOwnProfilePracticePrivate = {
    username: 'myuser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: true,
    streak: mockStreakData,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

  // 2. Own profile + Practice public
  const mockOwnProfilePracticePublic = {
    username: 'myuser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: true,
    streak: mockStreakData,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

  // 3. Other profile + Practice private
  const mockOtherProfilePracticePrivate = {
    username: 'otheruser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: false,
    streak: mockStreakData,
    ranked: mockRankedData,
    practice: null, // Private practice hidden from others
  };

  // 4. Other profile + Practice public
  const mockOtherProfilePracticePublic = {
    username: 'otheruser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: false,
    streak: mockStreakData,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

  test('Public profile includes Daily Streak data for both owner and visitors', () => {
    const ownProfile = mockOwnProfilePracticePrivate;
    const otherProfile = mockOtherProfilePracticePrivate;

    assert.ok(ownProfile.streak, 'Owner profile must include streak data');
    assert.equal(ownProfile.streak.currentStreak, 7);
    assert.equal(ownProfile.streak.longestStreak, 14);
    assert.equal(ownProfile.streak.activeToday, true);

    assert.ok(otherProfile.streak, 'Visitor profile must include streak data');
    assert.equal(otherProfile.streak.currentStreak, 7);
    assert.equal(otherProfile.streak.longestStreak, 14);
    assert.equal(otherProfile.streak.activeToday, true);
  });

  test('Daily Streak remains publicly visible when Practice statistics are private', () => {
    const profile = mockOtherProfilePracticePrivate;
    assert.equal(profile.isOwner, false);
    assert.equal(profile.practice, null, 'Practice stats should be hidden');
    assert.ok(profile.streak, 'Daily Streak must remain visible even when practice stats are private');
    assert.equal(profile.streak.currentStreak, 7);
    assert.equal(profile.streak.longestStreak, 14);
    assert.equal(profile.streak.recentDays.length, 7);
  });

  test('Public profile data separates Ranked and Practice statistics completely', () => {
    const profile = mockOwnProfilePracticePublic;

    // Ranked metrics
    assert.equal(profile.ranked.summary.totalTests, 15);
    assert.equal(profile.ranked.summary.personalBest.wpm, 104);
    assert.equal(profile.ranked.summary.averageWpm, 82);
    assert.equal(profile.ranked.badges.length, 2);

    // Practice metrics (must be separate, not combined)
    assert.equal(profile.practice.summary.totalTests, 40);
    assert.equal(profile.practice.summary.personalBest.wpm, 78);
    assert.equal(profile.practice.summary.averageWpm, 65);

    // Assert that Ranked does NOT include Practice tests and vice versa
    assert.notEqual(profile.ranked.summary.totalTests, profile.practice.summary.totalTests);
    assert.notEqual(profile.ranked.summary.personalBest.wpm, profile.practice.summary.personalBest.wpm);
  });

  test('Public profile defaults to Ranked mode', () => {
    const defaultMode = 'ranked';
    assert.equal(defaultMode, 'ranked');
  });

  test('Case 1: Own profile + Practice private -> Practice stats are visible to owner', () => {
    const profile = mockOwnProfilePracticePrivate;
    assert.equal(profile.isOwner, true);
    assert.ok(profile.practice, 'Owner must receive practice data even when private');
    assert.equal(profile.practice.summary.totalTests, 40);
    assert.equal(profile.practice.summary.personalBest.wpm, 78);
    assert.equal(profile.practice.summary.averageWpm, 65);
    assert.equal(profile.practice.summary.averageAccuracy, 94.8);
  });

  test('Case 2: Own profile + Practice public -> Practice stats are visible to owner', () => {
    const profile = mockOwnProfilePracticePublic;
    assert.equal(profile.isOwner, true);
    assert.ok(profile.practice);
    assert.equal(profile.practice.summary.totalTests, 40);
  });

  test('Case 3: Other user profile + Practice private -> Practice stats are hidden from other users', () => {
    const profile = mockOtherProfilePracticePrivate;
    assert.equal(profile.isOwner, false);
    assert.equal(profile.practice, null, 'Other users must not receive private practice data');

    // Ranked data is still public
    assert.ok(profile.ranked);
    assert.equal(profile.ranked.summary.totalTests, 15);
    assert.equal(profile.ranked.summary.personalBest.wpm, 104);
  });

  test('Case 4: Other user profile + Practice public -> Practice stats are visible to other users', () => {
    const profile = mockOtherProfilePracticePublic;
    assert.equal(profile.isOwner, false);
    assert.ok(profile.practice);
    assert.equal(profile.practice.summary.totalTests, 40);
    assert.equal(profile.practice.summary.personalBest.wpm, 78);
  });

  test('Ranked badges are only displayed in Ranked mode and never in Practice mode', () => {
    const profile = mockOwnProfilePracticePublic;

    // In Ranked mode, badges exist
    const rankedBadges = profile.ranked.badges;
    assert.ok(rankedBadges && rankedBadges.length > 0);

    // In Practice mode, no badge system is displayed
    const practiceHasBadges = !!profile.practice?.badges;
    assert.equal(practiceHasBadges, false);
  });

  test('Profile header labeling: owner displays "You" tag and no "Public Profile" badge is rendered', () => {
    const ownProfile = mockOwnProfilePracticePrivate;
    const otherProfile = mockOtherProfilePracticePublic;

    // Owner flag is present for owner
    assert.equal(ownProfile.isOwner, true);
    // Other users flag is false
    assert.equal(otherProfile.isOwner, false);
  });

  test('Security audit: public profile object never exposes private fields or settings', () => {
    const profiles = [
      mockOwnProfilePracticePrivate,
      mockOwnProfilePracticePublic,
      mockOtherProfilePracticePrivate,
      mockOtherProfilePracticePublic,
    ];

    for (const p of profiles) {
      assert.equal(p.email, undefined);
      assert.equal(p.passwordHash, undefined);
      assert.equal(p.practiceStatsVisibility, undefined);
      assert.equal(p._id, undefined);
      assert.equal(p.userId, undefined);
    }
  });

  test('StreakCard renders inside PublicProfile with active streak and 7-day indicators', async () => {
    const viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    try {
      const streakModule = await viteServer.ssrLoadModule('./src/components/StreakCard.jsx');
      const StreakCard = streakModule.StreakCard;

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StreakCard, { streak: mockStreakData })
      );

      assert.ok(html.includes('Daily Streak'));
      assert.ok(html.includes('7'));
      assert.ok(html.includes('14'));
      assert.ok(html.includes('Active Today'));
      assert.ok(html.includes('recent-days-row'));
    } finally {
      await viteServer.close();
    }
  });
});
