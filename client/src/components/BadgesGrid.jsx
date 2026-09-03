import React from 'react';
import { BADGE_TIER_COLORS } from '../utils/badgeData';

export function BadgesGrid({ badges = [], loading = false }) {
  if (loading) {
    return (
      <div className="badges-grid-loading">
        <div className="skeleton-loader">
          <div className="skeleton-line row"></div>
          <div className="skeleton-line row"></div>
        </div>
        <p>Loading your ranked badges...</p>
      </div>
    );
  }

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="badges-section">
      <div className="badges-header">
        <div>
          <h4 className="badges-title">Ranked Badges &amp; Milestones</h4>
          <p className="badges-subtitle">
            Derived from validated competitive ranked tests.
          </p>
        </div>
        <div className="badges-counter-badge">
          <span className="counter-val">{earnedCount}</span>
          <span className="counter-max">/ {badges.length} Unlocked</span>
        </div>
      </div>

      <div className="badges-grid">
        {badges.map((badge) => {
          const tierColor = BADGE_TIER_COLORS[badge.tier] || '#eab308';
          const isEarned = badge.earned;

          return (
            <div
              key={badge.id}
              className={`badge-card ${isEarned ? 'earned' : 'locked'} tier-${badge.tier}`}
              style={{ '--tier-color': tierColor }}
              title={`${badge.name}: ${badge.description}`}
            >
              <div className="badge-icon-box">
                <span className="badge-icon">{badge.icon}</span>
                {isEarned && <span className="badge-check-dot">&#x2714;</span>}
              </div>

              <div className="badge-content">
                <div className="badge-name-row">
                  <span className="badge-name">{badge.name}</span>
                  <span className="badge-tier-tag">{badge.tier}</span>
                </div>
                <p className="badge-desc">{badge.description}</p>

                {/* Progress indicator for locked streak or volume badges */}
                {!isEarned && badge.progress && badge.progress.target > 1 && (
                  <div className="badge-progress-bar-container">
                    <div
                      className="badge-progress-bar"
                      style={{
                        width: `${Math.min(100, Math.round((badge.progress.current / badge.progress.target) * 100))}%`,
                      }}
                    ></div>
                    <span className="badge-progress-text">
                      {badge.progress.current} / {badge.progress.target}
                    </span>
                  </div>
                )}

                {isEarned && badge.earnedAt && (
                  <span className="badge-earned-date">
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
