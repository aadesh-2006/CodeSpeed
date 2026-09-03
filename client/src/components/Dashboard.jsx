import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { SUPPORTED_LANGUAGES, TIMER_OPTIONS } from '../data/snippets';
import { formatTime } from '../utils/typingMetrics';

export function Dashboard({ user, onNavigateToPractice, onNavigateToHistory }) {
  const [summary, setSummary] = useState({
    totalTests: 0,
    totalTimeTypedSeconds: 0,
    averageWpm: 0,
    averageAccuracy: 0,
    personalBest: null,
    languageBreakdown: [],
    recentAttempts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPerformanceSummary();
      if (res && res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load performance summary:', err.message);
      setError(err.message || 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const getLanguageName = (langId) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.id.toLowerCase() === (langId || '').toLowerCase());
    return found ? found.name : langId;
  };

  const getTimerLabel = (seconds) => {
    const found = TIMER_OPTIONS.find((t) => t.seconds === Number(seconds));
    return found ? found.label : `${seconds}s`;
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(dateString);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Greeting & CTA Bar */}
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">
            Welcome back, <span className="text-cyan">{user?.username || 'Coder'}</span>
          </h2>
          <p className="dashboard-subtitle">Here is your typing speed and coding practice overview.</p>
        </div>

        <div className="dashboard-header-actions">
          <button type="button" className="action-btn primary-btn compact" onClick={onNavigateToPractice}>
            &gt;_ Start Practice
          </button>
          <button type="button" className="action-btn secondary-btn compact" onClick={onNavigateToHistory}>
            History &amp; Graph &rarr;
          </button>
          <button type="button" className="refresh-btn" onClick={fetchSummary} title="Refresh dashboard">
            &#x21BB;
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="dashboard-state-card loading">
          <div className="skeleton-loader">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
            <div className="skeleton-line row"></div>
          </div>
          <p>Loading your dashboard summary...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="dashboard-state-card error">
          <span className="error-icon">&#x26A0;</span>
          <p className="error-text">{error}</p>
          <button type="button" className="action-btn secondary-btn compact" onClick={fetchSummary}>
            Try Again
          </button>
        </div>
      )}

      {/* Fresh Account Empty State */}
      {!loading && !error && summary.totalTests === 0 && (
        <div className="dashboard-state-card empty">
          <div className="empty-symbol">&gt;_</div>
          <h3>Welcome to CodeSpeed!</h3>
          <p>You haven't completed any typing tests yet. Take your first test to unlock your stats dashboard!</p>
          <button type="button" className="action-btn primary-btn" onClick={onNavigateToPractice}>
            Start Your First Test
          </button>
        </div>
      )}

      {/* Populated Dashboard Content */}
      {!loading && !error && summary.totalTests > 0 && (
        <div className="dashboard-content">
          {/* Key Metrics Grid */}
          <div className="metrics-grid">
            {/* Personal Best Card */}
            <div className="metric-card pb-card">
              <div className="metric-card-top">
                <span className="metric-icon">&#x1F3C6;</span>
                <span className="metric-label">Personal Best</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value text-cyan">{summary.personalBest?.wpm || 0}</span>
                <span className="metric-unit">WPM</span>
              </div>
              {summary.personalBest && (
                <div className="metric-detail">
                  <span className="lang-tag">{getLanguageName(summary.personalBest.language)}</span>
                  <span className="diff-tag">{summary.personalBest.accuracy}% acc</span>
                  <span className="metric-date">{formatTimestamp(summary.personalBest.createdAt)}</span>
                </div>
              )}
            </div>

            {/* Average Speed Card */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-icon">&#x26A1;</span>
                <span className="metric-label">Average Speed</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{summary.averageWpm}</span>
                <span className="metric-unit">WPM</span>
              </div>
              <span className="metric-sub">Across all {summary.totalTests} tests</span>
            </div>

            {/* Average Accuracy Card */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-icon">&#x25CE;</span>
                <span className="metric-label">Avg Accuracy</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value text-green">{summary.averageAccuracy}%</span>
              </div>
              <span className="metric-sub">Precision score</span>
            </div>

            {/* Total Tests Card */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-icon">&#x2714;</span>
                <span className="metric-label">Tests Completed</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{summary.totalTests}</span>
                <span className="metric-unit">sessions</span>
              </div>
              <span className="metric-sub">Recorded attempts</span>
            </div>

            {/* Total Time Card */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-icon">&#x23F1;</span>
                <span className="metric-label">Time Typed</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value text-purple">
                  {formatTime(summary.totalTimeTypedSeconds)}
                </span>
              </div>
              <span className="metric-sub">Total coding time</span>
            </div>
          </div>

          {/* Section: Language Breakdown & Recent Attempts */}
          <div className="dashboard-two-col">
            {/* Language Breakdown */}
            <div className="dashboard-section-card">
              <div className="section-card-header">
                <h3 className="section-title">Language Breakdown</h3>
                <span className="section-sub">{summary.languageBreakdown.length} languages practiced</span>
              </div>

              <div className="lang-breakdown-list">
                {summary.languageBreakdown.map((item) => (
                  <div key={item.language} className="lang-breakdown-row">
                    <div className="lang-breakdown-info">
                      <span className="lang-tag">{getLanguageName(item.language)}</span>
                      <span className="lang-count">{item.testCount} {item.testCount === 1 ? 'test' : 'tests'}</span>
                    </div>
                    <div className="lang-breakdown-stats">
                      <div className="lang-stat-chip">
                        <span className="chip-lbl">Best:</span>
                        <strong className="chip-val text-cyan">{item.bestWpm} WPM</strong>
                      </div>
                      <div className="lang-stat-chip">
                        <span className="chip-lbl">Avg:</span>
                        <strong className="chip-val">{item.averageWpm} WPM</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attempts Feed */}
            <div className="dashboard-section-card">
              <div className="section-card-header">
                <h3 className="section-title">Recent Activity</h3>
                <button type="button" className="link-action-btn" onClick={onNavigateToHistory}>
                  View All &rarr;
                </button>
              </div>

              <div className="recent-attempts-list">
                {summary.recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="recent-attempt-row">
                    <div className="recent-attempt-left">
                      <span className="lang-tag">{getLanguageName(attempt.language)}</span>
                      <span className="recent-timer">{getTimerLabel(attempt.timerSeconds)}</span>
                      <span className="recent-date">{formatTimestamp(attempt.createdAt)}</span>
                    </div>
                    <div className="recent-attempt-right">
                      <span className="recent-wpm text-cyan">{attempt.wpm} WPM</span>
                      <span className="recent-acc text-green">{attempt.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
