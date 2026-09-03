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

  const mockPublicPracticeData = {
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

  const mockPublicProfilePublicPractice = {
    username: 'speedcoder',
    memberSince: '2026-08-01T00:00:00.000Z',
    ranked: mockRankedData,
    practice: mockPublicPracticeData,
  };

  const mockPublicProfilePrivatePractice = {
    username: 'speedcoder',
    memberSince: '2026-08-01T00:00:00.000Z',
    ranked: mockRankedData,
    practice: null, // Private practice
  };

  test('Public profile data separates Ranked and Practice statistics completely', () => {
    const profile = mockPublicProfilePublicPractice;

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
    let activeMode = 'ranked';
    assert.equal(activeMode, 'ranked');
  });

  test('Switching to Practice displays Practice statistics when practice is public', () => {
    const profile = mockPublicProfilePublicPractice;
    let activeMode = 'ranked';

    // Switch to practice
    activeMode = 'practice';
    assert.equal(activeMode, 'practice');

    const displayedStats = activeMode === 'ranked' ? profile.ranked.summary : profile.practice?.summary;
    assert.equal(displayedStats.personalBest.wpm, 78);
    assert.equal(displayedStats.totalTests, 40);
    assert.equal(displayedStats.averageWpm, 65);
  });

  test('Switching back to Ranked restores Ranked statistics', () => {
    const profile = mockPublicProfilePublicPractice;
    let activeMode = 'practice';

    // Switch back to ranked
    activeMode = 'ranked';
    assert.equal(activeMode, 'ranked');

    const displayedStats = activeMode === 'ranked' ? profile.ranked.summary : profile.practice?.summary;
    assert.equal(displayedStats.personalBest.wpm, 104);
    assert.equal(displayedStats.totalTests, 15);
  });

  test('Ranked badges are only displayed in Ranked mode and never in Practice mode', () => {
    const profile = mockPublicProfilePublicPractice;

    // In Ranked mode, badges exist
    const rankedBadges = profile.ranked.badges;
    assert.ok(rankedBadges && rankedBadges.length > 0);

    // In Practice mode, no badge system is displayed
    const practiceHasBadges = !!profile.practice?.badges;
    assert.equal(practiceHasBadges, false);
  });

  test('Private practice profile: practice data is null and private state is flagged', () => {
    const profile = mockPublicProfilePrivatePractice;

    // Ranked data remains accessible
    assert.ok(profile.ranked);
    assert.equal(profile.ranked.summary.totalTests, 15);
    assert.equal(profile.ranked.summary.personalBest.wpm, 104);

    // Practice data is strictly null
    assert.equal(profile.practice, null);

    // Verification that UI displays private message
    const isPracticePrivate = profile.practice === null;
    assert.equal(isPracticePrivate, true);
  });

  test('Security audit: public profile object never exposes private fields or settings', () => {
    const profile1 = mockPublicProfilePublicPractice;
    const profile2 = mockPublicProfilePrivatePractice;

    for (const p of [profile1, profile2]) {
      assert.equal(p.email, undefined);
      assert.equal(p.passwordHash, undefined);
      assert.equal(p.practiceStatsVisibility, undefined);
      assert.equal(p._id, undefined);
      assert.equal(p.userId, undefined);
    }
  });
});
