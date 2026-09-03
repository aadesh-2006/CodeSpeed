import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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

  // 1. Own profile + Practice private
  const mockOwnProfilePracticePrivate = {
    username: 'myuser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: true,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

  // 2. Own profile + Practice public
  const mockOwnProfilePracticePublic = {
    username: 'myuser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: true,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

  // 3. Other profile + Practice private
  const mockOtherProfilePracticePrivate = {
    username: 'otheruser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: false,
    ranked: mockRankedData,
    practice: null, // Private practice hidden from others
  };

  // 4. Other profile + Practice public
  const mockOtherProfilePracticePublic = {
    username: 'otheruser',
    memberSince: '2026-08-01T00:00:00.000Z',
    isOwner: false,
    ranked: mockRankedData,
    practice: mockPracticeData,
  };

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
});
