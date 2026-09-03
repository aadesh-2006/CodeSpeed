/**
 * Badge Definitions and Server-Side Evaluation Engine.
 * Badges are derived purely from validated ranked attempts sorted chronologically (createdAt ASC).
 */

export const BADGE_DEFINITIONS = [
  // Speed Thresholds
  {
    id: 'wpm_50',
    name: 'Bronze Speed',
    description: 'Achieve 50+ WPM in a ranked typing test.',
    category: 'speed',
    tier: 'bronze',
    icon: '⚡',
    type: 'threshold',
    threshold: 50,
  },
  {
    id: 'wpm_75',
    name: 'Silver Speed',
    description: 'Achieve 75+ WPM in a ranked typing test.',
    category: 'speed',
    tier: 'silver',
    icon: '🚀',
    type: 'threshold',
    threshold: 75,
  },
  {
    id: 'wpm_100',
    name: 'Gold Speed',
    description: 'Achieve 100+ WPM in a ranked typing test.',
    category: 'speed',
    tier: 'gold',
    icon: '🔥',
    type: 'threshold',
    threshold: 100,
  },
  {
    id: 'wpm_125',
    name: 'Platinum Speed',
    description: 'Achieve 125+ WPM in a ranked typing test.',
    category: 'speed',
    tier: 'platinum',
    icon: '💎',
    type: 'threshold',
    threshold: 125,
  },
  {
    id: 'wpm_150',
    name: 'Diamond Speed',
    description: 'Achieve 150+ WPM in a ranked typing test.',
    category: 'speed',
    tier: 'diamond',
    icon: '👑',
    type: 'threshold',
    threshold: 150,
  },

  // Speed Streaks (5 Consecutive Attempts)
  {
    id: 'streak_50_5',
    name: 'Bronze Streak',
    description: 'Achieve 50+ WPM in 5 consecutive ranked attempts.',
    category: 'streak',
    tier: 'bronze',
    icon: '🥉',
    type: 'streak',
    threshold: 50,
    targetCount: 5,
  },
  {
    id: 'streak_75_5',
    name: 'Silver Streak',
    description: 'Achieve 75+ WPM in 5 consecutive ranked attempts.',
    category: 'streak',
    tier: 'silver',
    icon: '🥈',
    type: 'streak',
    threshold: 75,
    targetCount: 5,
  },
  {
    id: 'streak_100_5',
    name: 'Gold Streak',
    description: 'Achieve 100+ WPM in 5 consecutive ranked attempts.',
    category: 'streak',
    tier: 'gold',
    icon: '🥇',
    type: 'streak',
    threshold: 100,
    targetCount: 5,
  },
  {
    id: 'streak_125_5',
    name: 'Platinum Streak',
    description: 'Achieve 125+ WPM in 5 consecutive ranked attempts.',
    category: 'streak',
    tier: 'platinum',
    icon: '💠',
    type: 'streak',
    threshold: 125,
    targetCount: 5,
  },

  // Volume / Dedication
  {
    id: 'first_ranked',
    name: 'Ranked Debut',
    description: 'Complete your first ranked typing test.',
    category: 'volume',
    tier: 'bronze',
    icon: '🎯',
    type: 'volume',
    targetCount: 1,
  },
  {
    id: 'ranked_10',
    name: 'Ranked Veteran 10',
    description: 'Complete 10 ranked typing tests.',
    category: 'volume',
    tier: 'silver',
    icon: '🛡️',
    type: 'volume',
    targetCount: 10,
  },
  {
    id: 'ranked_50',
    name: 'Ranked Veteran 50',
    description: 'Complete 50 ranked typing tests.',
    category: 'volume',
    tier: 'gold',
    icon: '⚔️',
    type: 'volume',
    targetCount: 50,
  },
  {
    id: 'ranked_100',
    name: 'Ranked Centurion',
    description: 'Complete 100 ranked typing tests.',
    category: 'volume',
    tier: 'diamond',
    icon: '🏛️',
    type: 'volume',
    targetCount: 100,
  },

  // Precision Consistency
  {
    id: 'consistent_10',
    name: 'Precision Master',
    description: 'Complete 10 consecutive ranked tests with 95%+ accuracy.',
    category: 'precision',
    tier: 'gold',
    icon: '🎯',
    type: 'accuracy_streak',
    accuracyThreshold: 95,
    targetCount: 10,
  },
];

/**
 * Evaluates all badges for an authenticated user given their chronological ranked attempts.
 *
 * @param {Array<{ wpm: number, accuracy: number, createdAt: Date|string }>} rankedAttempts
 * @returns {Array<object>} Array of all badge statuses
 */
export function evaluateBadges(rankedAttempts = []) {
  const attempts = [...rankedAttempts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const total = attempts.length;

  return BADGE_DEFINITIONS.map((def) => {
    let earned = false;
    let earnedAt = null;
    let progress = { current: 0, target: 1 };

    switch (def.type) {
      case 'threshold': {
        const threshold = def.threshold;
        const matching = attempts.find((p) => (p.wpm || 0) >= threshold);
        if (matching) {
          earned = true;
          earnedAt = matching.createdAt;
          progress = { current: threshold, target: threshold };
        } else {
          const maxWpm = attempts.length ? Math.max(...attempts.map((p) => p.wpm || 0)) : 0;
          progress = { current: maxWpm, target: threshold };
        }
        break;
      }

      case 'streak': {
        const threshold = def.threshold;
        const target = def.targetCount;
        let curStreak = 0;
        let maxStreak = 0;

        for (const p of attempts) {
          if ((p.wpm || 0) >= threshold) {
            curStreak += 1;
            if (curStreak === target && !earnedAt) {
              earnedAt = p.createdAt;
            }
            maxStreak = Math.max(maxStreak, curStreak);
          } else {
            curStreak = 0; // Streak breaks on non-qualifying attempt
          }
        }

        earned = maxStreak >= target;
        progress = {
          current: Math.min(target, maxStreak),
          target,
          activeStreak: curStreak,
        };
        break;
      }

      case 'volume': {
        const target = def.targetCount;
        if (total >= target) {
          earned = true;
          earnedAt = attempts[target - 1]?.createdAt || null;
          progress = { current: target, target };
        } else {
          progress = { current: total, target };
        }
        break;
      }

      case 'accuracy_streak': {
        const target = def.targetCount;
        const minAcc = def.accuracyThreshold;
        let curStreak = 0;
        let maxStreak = 0;

        for (const p of attempts) {
          if ((p.accuracy || 0) >= minAcc) {
            curStreak += 1;
            if (curStreak === target && !earnedAt) {
              earnedAt = p.createdAt;
            }
            maxStreak = Math.max(maxStreak, curStreak);
          } else {
            curStreak = 0; // Accuracy streak breaks
          }
        }

        earned = maxStreak >= target;
        progress = {
          current: Math.min(target, maxStreak),
          target,
          activeStreak: curStreak,
        };
        break;
      }

      default:
        break;
    }

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      tier: def.tier,
      icon: def.icon,
      earned,
      earnedAt,
      progress,
    };
  });
}
