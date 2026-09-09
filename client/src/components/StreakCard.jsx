import React from 'react';

/**
 * Clean SVG Fire/Flame Icon for developer-tool UI.
 *
 * @param {object} props
 * @param {boolean} props.lit - Whether the flame is active/lit
 * @param {number} props.size - Pixel size of icon (default 18)
 * @param {string} props.className - Additional class names
 */
export function FlameIcon({ lit = false, size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={lit ? 'url(#flameGradient)' : 'none'}
      stroke={lit ? '#f59e0b' : 'currentColor'}
      strokeWidth={lit ? '1.5' : '1.75'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`streak-flame-icon ${lit ? 'flame-lit' : 'flame-unlit'} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="flameGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

/**
 * StreakCard Component: displays daily practice streak, longest streak, and 7-day indicator.
 */
export function StreakCard({ streak, loading = false }) {
  const {
    currentStreak = 0,
    longestStreak = 0,
    practicedToday = false,
    recentDays = [],
  } = streak || {};

  return (
    <div className="streak-card">
      <div className="streak-card-header">
        <div className="streak-title-group">
          <div className="streak-title-badge">
            <FlameIcon lit={practicedToday} size={18} />
            <span className="streak-title">Daily Practice Streak</span>
          </div>
          <span className="streak-subtitle">
            Complete at least 1 practice session each calendar day to build your streak.
          </span>
        </div>

        <div className={`streak-status-pill ${practicedToday ? 'status-active' : 'status-pending'}`}>
          <FlameIcon lit={practicedToday} size={14} />
          <span>{practicedToday ? 'Practiced Today' : 'Not Practiced Today'}</span>
        </div>
      </div>

      <div className="streak-card-body">
        {/* Metric Counters */}
        <div className="streak-metrics-col">
          <div className="streak-metric-item">
            <span className="streak-metric-label">Current Streak</span>
            <div className="streak-metric-value-row">
              <span className={`streak-metric-number ${practicedToday ? 'text-amber' : 'text-dim'}`}>
                {currentStreak}
              </span>
              <span className="streak-metric-unit">{currentStreak === 1 ? 'day' : 'days'}</span>
              <FlameIcon lit={practicedToday} size={20} />
            </div>
          </div>

          <div className="streak-metric-item">
            <span className="streak-metric-label">Longest Streak</span>
            <div className="streak-metric-value-row">
              <span className="streak-metric-number text-primary">
                {longestStreak}
              </span>
              <span className="streak-metric-unit">{longestStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        </div>

        {/* 7-Day Recent Calendar Row */}
        <div className="streak-calendar-col">
          <span className="streak-calendar-label">Recent Activity (Last 7 Days)</span>
          <div className="recent-days-row" role="list" aria-label="Last 7 days practice status">
            {recentDays && recentDays.length > 0 ? (
              recentDays.map((day) => (
                <div
                  key={day.date}
                  className={`day-cell ${day.practiced ? 'day-practiced' : 'day-missed'} ${day.isToday ? 'day-today' : ''}`}
                  role="listitem"
                  title={`${day.date}: ${day.practiced ? 'Practiced' : 'Missed'}${day.isToday ? ' (Today)' : ''}`}
                >
                  <span className="day-label">{day.isToday ? 'Today' : day.dayLabel}</span>
                  <div className="day-flame-container">
                    <FlameIcon lit={day.practiced} size={18} />
                  </div>
                  <span className="day-status-dot"></span>
                </div>
              ))
            ) : (
              <div className="recent-days-empty">Loading recent days...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreakCard;
