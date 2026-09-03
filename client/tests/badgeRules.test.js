import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBadges, BADGE_DEFINITIONS } from '../src/utils/badgeData.js';

describe('Ranked Badges & Streak Engine Client Tests', () => {
  test('badge catalog contains exactly 14 defined ranked badges', () => {
    assert.equal(BADGE_DEFINITIONS.length, 14);
  });

  test('returns 0 earned badges for empty ranked attempts', () => {
    const badges = evaluateBadges([]);
    assert.equal(badges.length, 14);
    assert.ok(badges.every((b) => !b.earned));
  });

  test('single attempt >= 50 WPM unlocks Bronze Speed and Ranked Debut', () => {
    const attempts = [
      { wpm: 52, accuracy: 96, createdAt: new Date() },
    ];
    const badges = evaluateBadges(attempts);
    const bDebut = badges.find((b) => b.id === 'first_ranked');
    const bWpm50 = badges.find((b) => b.id === 'wpm_50');
    const bWpm75 = badges.find((b) => b.id === 'wpm_75');

    assert.equal(bDebut.earned, true);
    assert.equal(bWpm50.earned, true);
    assert.equal(bWpm75.earned, false);
  });

  test('5-consecutive attempts >= 75 WPM unlocks Silver Streak', () => {
    const attempts = [
      { wpm: 75, accuracy: 98, createdAt: new Date(1000) },
      { wpm: 80, accuracy: 97, createdAt: new Date(2000) },
      { wpm: 78, accuracy: 99, createdAt: new Date(3000) },
      { wpm: 82, accuracy: 96, createdAt: new Date(4000) },
      { wpm: 76, accuracy: 98, createdAt: new Date(5000) },
    ];
    const badges = evaluateBadges(attempts);
    const bStreak75 = badges.find((b) => b.id === 'streak_75_5');
    assert.equal(bStreak75.earned, true);
  });

  test('streak breaks when an attempt falls below threshold', () => {
    const attempts = [
      { wpm: 75, accuracy: 98, createdAt: new Date(1000) },
      { wpm: 80, accuracy: 97, createdAt: new Date(2000) },
      { wpm: 78, accuracy: 99, createdAt: new Date(3000) },
      { wpm: 82, accuracy: 96, createdAt: new Date(4000) },
      { wpm: 60, accuracy: 98, createdAt: new Date(5000) }, // Drops below 75
    ];
    const badges = evaluateBadges(attempts);
    const bStreak75 = badges.find((b) => b.id === 'streak_75_5');
    assert.equal(bStreak75.earned, false);
    assert.equal(bStreak75.progress.activeStreak, 0);
  });

  test('volume badges unlock at 1, 10, 50, 100 attempts', () => {
    const attempts10 = Array.from({ length: 10 }, (_, i) => ({
      wpm: 40,
      accuracy: 90,
      createdAt: new Date(i * 1000),
    }));
    const badges = evaluateBadges(attempts10);
    const bRanked10 = badges.find((b) => b.id === 'ranked_10');
    const bRanked50 = badges.find((b) => b.id === 'ranked_50');

    assert.equal(bRanked10.earned, true);
    assert.equal(bRanked50.earned, false);
    assert.equal(bRanked50.progress.current, 10);
  });
});
