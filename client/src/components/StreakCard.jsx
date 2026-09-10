import React, { useMemo } from 'react';

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
 * Maps completed test count to a GitHub-style heatmap intensity level (0–5).
 * Strictly based on test count per calendar day.
 *
 * 0 tests: Level 0
 * 1 test: Level 1
 * 2–3 tests: Level 2
 * 4–7 tests: Level 3
 * 8–15 tests: Level 4
 * 16+ tests: Level 5
 *
 * @param {number} count
 * @returns {number} 0 to 5
 */
export function getIntensityLevel(count) {
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  if (count <= 15) return 4;
  return 5;
}

/**
 * Format YYYY-MM-DD date string to a human-readable format for tooltips (e.g. "Sep 10, 2026").
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatHeatmapDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;
}

/**
 * Offset YYYY-MM-DD date string by N calendar days.
 */
function addDaysToYMD(dateStr, offsetDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + offsetDays * 86400000;
  const target = new Date(utc);
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const td = String(target.getUTCDate()).padStart(2, '0');
  return `${ty}-${tm}-${td}`;
}

/**
 * Get weekday index 0 (Sunday) to 6 (Saturday) for YYYY-MM-DD.
 */
function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.getUTCDay();
}

/**
 * GitHub / LeetCode style Contribution Activity Heatmap Component.
 * Displays a 52-week calendar grid (Sun–Sat) with month headers, weekday labels,
 * intensity level squares based on test count, and streak summaries.
 */
export function ActivityHeatmap({ streak, username, onSelectDate, loading = false }) {
  const {
    currentStreak = 0,
    longestStreak = 0,
  } = streak || {};

  const isActiveToday = Boolean(
    streak?.activeToday ?? streak?.practicedToday ?? streak?.completedToday ?? false
  );

  const referenceToday = streak?.today || new Date().toISOString().slice(0, 10);

  // Build grid calendar data (52 weeks = 364 days ending on current week)
  const { weeks, monthLabels, totalTestsInYear } = useMemo(() => {
    const todayDayOfWeek = getDayOfWeek(referenceToday);
    const currentWeekSunday = addDaysToYMD(referenceToday, -todayDayOfWeek);
    const startSunday = addDaysToYMD(currentWeekSunday, -51 * 7);

    // Map date -> testCount
    const countMap = new Map();
    if (streak?.dailyActivity && Array.isArray(streak.dailyActivity)) {
      for (const item of streak.dailyActivity) {
        if (item && item.date) {
          countMap.set(item.date, Number(item.testCount) || 0);
        }
      }
    } else if (streak?.activeDates && Array.isArray(streak.activeDates)) {
      for (const d of streak.activeDates) {
        countMap.set(d, (countMap.get(d) || 0) + 1);
      }
    } else if (streak?.recentDays && Array.isArray(streak.recentDays)) {
      for (const d of streak.recentDays) {
        if (d.active || d.practiced) {
          countMap.set(d.date, 1);
        }
      }
    }

    const calculatedWeeks = [];
    const calculatedMonths = [];
    let totalTests = 0;
    let lastMonth = -1;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let w = 0; w < 52; w++) {
      const weekStart = addDaysToYMD(startSunday, w * 7);
      const [, wm] = weekStart.split('-').map(Number);
      const mIdx = wm - 1;

      if (mIdx !== lastMonth) {
        calculatedMonths.push({
          colIndex: w,
          label: monthNames[mIdx],
        });
        lastMonth = mIdx;
      }

      const days = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = addDaysToYMD(weekStart, d);
        const isFuture = dateStr > referenceToday;
        const isToday = dateStr === referenceToday;
        const testCount = isFuture ? 0 : (countMap.get(dateStr) || 0);
        const level = isFuture ? 0 : getIntensityLevel(testCount);

        if (!isFuture) {
          totalTests += testCount;
        }

        days.push({
          date: dateStr,
          dayOfWeek: d,
          testCount,
          level,
          isToday,
          isFuture,
        });
      }

      calculatedWeeks.push({
        weekIndex: w,
        weekStart,
        days,
      });
    }

    return {
      weeks: calculatedWeeks,
      monthLabels: calculatedMonths,
      totalTestsInYear: totalTests,
    };
  }, [streak, referenceToday]);

  const handleDateClick = (dateStr) => {
    if (onSelectDate) {
      onSelectDate(dateStr);
    } else if (username) {
      window.location.hash = `/user/${encodeURIComponent(username)}/activity/${dateStr}`;
    }
  };

  return (
    <div className="activity-heatmap-card">
      {/* Header with Title, Active Status, and Metrics */}
      <div className="heatmap-header">
        <div className="heatmap-title-group">
          <div className="heatmap-title-badge">
            <FlameIcon lit={isActiveToday} size={18} />
            <h3 className="heatmap-title">Daily Streak</h3>
          </div>
          <span className="heatmap-subtitle">
            {totalTestsInYear} {totalTestsInYear === 1 ? 'test' : 'tests'} completed in the last year
          </span>
        </div>

        <div className="heatmap-stats-group">
          <div className="heatmap-stat-pill current-streak-pill">
            <span className="stat-pill-label">Current Streak</span>
            <div className="stat-pill-value-row">
              <span className={`stat-pill-number ${isActiveToday ? 'text-amber' : 'text-dim'}`}>
                {currentStreak}
              </span>
              <span className="stat-pill-unit">{currentStreak === 1 ? 'day' : 'days'}</span>
              <FlameIcon lit={isActiveToday} size={15} />
            </div>
          </div>

          <div className="heatmap-stat-pill longest-streak-pill">
            <span className="stat-pill-label">Longest Streak</span>
            <div className="stat-pill-value-row">
              <span className="stat-pill-number text-primary">{longestStreak}</span>
              <span className="stat-pill-unit">{longestStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>

          <div className={`streak-status-pill ${isActiveToday ? 'status-active' : 'status-pending'}`}>
            <FlameIcon lit={isActiveToday} size={13} />
            <span>{isActiveToday ? 'Active Today' : 'Not Active Today'}</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Section */}
      <div className="heatmap-scroll-container">
        <div className="heatmap-inner-wrapper">
          {/* Month Labels Header Row */}
          <div className="heatmap-months-row">
            <div className="heatmap-weekday-spacer" aria-hidden="true" />
            <div className="heatmap-months-track">
              {weeks.map((week, idx) => {
                const labelObj = monthLabels.find((m) => m.colIndex === idx);
                return (
                  <div key={idx} className="heatmap-month-col">
                    {labelObj ? <span className="heatmap-month-label">{labelObj.label}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid: Weekday Labels + 52 Week Columns */}
          <div className="heatmap-grid-row">
            {/* Weekday Labels Column */}
            <div className="heatmap-weekdays-col" aria-hidden="true">
              <span className="heatmap-weekday-label"></span>
              <span className="heatmap-weekday-label">Mon</span>
              <span className="heatmap-weekday-label"></span>
              <span className="heatmap-weekday-label">Wed</span>
              <span className="heatmap-weekday-label"></span>
              <span className="heatmap-weekday-label">Fri</span>
              <span className="heatmap-weekday-label"></span>
            </div>

            {/* 52 Columns Grid */}
            <div className="heatmap-weeks-grid" role="grid" aria-label="Contribution activity calendar">
              {weeks.map((week) => (
                <div key={week.weekIndex} className="heatmap-week-col" role="row">
                  {week.days.map((day) => {
                    const countText = `${day.testCount} ${day.testCount === 1 ? 'test' : 'tests'}`;
                    const dateLabel = formatHeatmapDate(day.date);
                    const tooltip = `${dateLabel} — ${countText}`;

                    return (
                      <div
                        key={day.date}
                        className={`heatmap-cell level-${day.level} ${
                          day.isFuture ? 'cell-future' : 'cell-clickable'
                        }`}
                        title={day.isFuture ? undefined : tooltip}
                        aria-label={day.isFuture ? undefined : tooltip}
                        role="gridcell"
                        tabIndex={day.isFuture ? -1 : 0}
                        onClick={() => !day.isFuture && handleDateClick(day.date)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !day.isFuture) {
                            e.preventDefault();
                            handleDateClick(day.date);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Legend */}
      <div className="heatmap-footer">
        <span className="heatmap-hint">
          Click any day to view detailed typing activity.
        </span>
        <div className="heatmap-legend" aria-label="Activity intensity level legend">
          <span className="legend-label">Less</span>
          <span className="heatmap-cell level-0" title="0 tests" />
          <span className="heatmap-cell level-1" title="1 test" />
          <span className="heatmap-cell level-2" title="2–3 tests" />
          <span className="heatmap-cell level-3" title="4–7 tests" />
          <span className="heatmap-cell level-4" title="8–15 tests" />
          <span className="heatmap-cell level-5" title="16+ tests" />
          <span className="legend-label">More</span>
        </div>
      </div>
    </div>
  );
}

/**
 * StreakCard Component: Alias for ActivityHeatmap for backward compatibility with existing views and tests.
 */
export function StreakCard(props) {
  return <ActivityHeatmap {...props} />;
}

export default StreakCard;


