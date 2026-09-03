import React from 'react';
import { BADGE_TIER_COLORS } from '../utils/badgeData';

function BadgeIcon({ id, earned }) {
  if (id.startsWith('wpm_')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    );
  }
  if (id.startsWith('streak_')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  }
  if (id.startsWith('ranked_') || id === 'first_ranked') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    );
  }
  if (id === 'accuracy_master_10') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function BadgesGrid({ badges = [], loading = false }) {
  if (loading) {
    return (
      <div className="panel state-panel loading">
        <div className="loading-spinner"></div>
        <p>Loading ranked badges...</p>
      </div>
    );
  }

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="panel badges-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Ranked Badges &amp; Milestones</h3>
          <p className="panel-subtitle">
            Earned through verified competitive ranked attempts.
          </p>
        </div>
        <div className="badge-counter-pill">
          <span className="counter-current">{earnedCount}</span>
          <span className="counter-total">/ {badges.length} Unlocked</span>
        </div>
      </div>

      <div className="badges-grid">
        {badges.map((badge) => {
          const tierColor = BADGE_TIER_COLORS[badge.tier] || '#f59e0b';
          const isEarned = badge.earned;

          return (
            <div
              key={badge.id}
              className={`badge-item ${isEarned ? 'unlocked' : 'locked'}`}
              style={{ '--tier-color': tierColor }}
            >
              <div className="badge-item-icon">
                <BadgeIcon id={badge.id} earned={isEarned} />
                {isEarned && (
                  <span className="badge-check-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                )}
              </div>

              <div className="badge-item-info">
                <div className="badge-item-top">
                  <span className="badge-item-name">{badge.name}</span>
                  <span className="badge-item-tier">{badge.tier}</span>
                </div>
                <p className="badge-item-desc">{badge.description}</p>

                {/* Progress bar for locked streak/volume badges */}
                {!isEarned && badge.progress && badge.progress.target > 1 && (
                  <div className="badge-progress-track">
                    <div
                      className="badge-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.round((badge.progress.current / badge.progress.target) * 100))}%`,
                      }}
                    ></div>
                    <span className="badge-progress-label">
                      {badge.progress.current} / {badge.progress.target}
                    </span>
                  </div>
                )}

                {isEarned && badge.earnedAt && (
                  <span className="badge-unlocked-date">
                    Unlocked {new Date(badge.earnedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BadgesGrid;
