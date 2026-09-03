import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import BadgesGrid from './BadgesGrid';
import PrivacySettingsModal from './PrivacySettingsModal';
import { SUPPORTED_LANGUAGES, TIMER_OPTIONS } from '../data/snippets';
import { formatTime } from '../utils/typingMetrics';

export function Dashboard({
  user,
  onNavigateToPractice,
  onNavigateToRanked,
  onNavigateToHistory,
  onViewPublicProfile,
  onUserUpdate,
}) {
  const [dashboardMode, setDashboardMode] = useState('practice'); // 'practice' | 'ranked'
  const [summary, setSummary] = useState({
    totalTests: 0,
    totalTimeTypedSeconds: 0,
    averageWpm: 0,
    averageAccuracy: 0,
    personalBest: null,
    languageBreakdown: [],
    recentAttempts: [],
  });
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPerformanceSummary({ mode: dashboardMode });
      if (res && res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load performance summary:', err.message);
      setError(err.message || 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, [dashboardMode]);

  const fetchBadges = useCallback(async () => {
    if (dashboardMode !== 'ranked') return;
    setBadgesLoading(true);
    try {
      const res = await api.getBadges();
      if (res && res.data) {
        setBadges(res.data.badges || []);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load badges:', err.message);
    } finally {
      setBadgesLoading(false);
    }
  }, [dashboardMode]);

  useEffect(() => {
    fetchSummary();
    if (dashboardMode === 'ranked') {
      fetchBadges();
    }
  }, [fetchSummary, fetchBadges, dashboardMode]);

  const handleSavePrivacy = async (newVisibility) => {
    const res = await api.updatePrivacy({ practiceStatsVisibility: newVisibility });
    if (res && res.data && res.data.user && onUserUpdate) {
      onUserUpdate(res.data.user);
    }
  };

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

  const isRanked = dashboardMode === 'ranked';

  return (
    <div className={`dashboard-container ${isRanked ? 'dashboard-ranked-theme' : ''}`}>
      {/* Dashboard Top Greeting & CTA Bar */}
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">
            Welcome back, <span className={isRanked ? 'text-amber' : 'text-cyan'}>{user?.username || 'Coder'}</span>
          </h2>
          <p className="dashboard-subtitle">
            {isRanked
              ? 'Ranked competitive progression, personal bests, and unlocked badges.'
              : 'Casual practice statistics, language breakdown, and typing progress.'}
          </p>
        </div>

        <div className="dashboard-header-actions">
          {onViewPublicProfile && (
            <button
              type="button"
              className="action-btn secondary-btn compact"
              onClick={() => onViewPublicProfile(user?.username)}
            >
              🌐 Public Profile
            </button>
          )}

          <button
            type="button"
            className="action-btn secondary-btn compact"
            onClick={() => setPrivacyModalOpen(true)}
            title="Configure practice stats privacy"
          >
            {user?.practiceStatsVisibility === 'public' ? '🌐 Public Stats' : '🔒 Private Stats'}
          </button>

          <button
            type="button"
            className="action-btn primary-btn compact"
            onClick={isRanked ? onNavigateToRanked : onNavigateToPractice}
          >
            {isRanked ? '🏆 Start Ranked' : '>_ Start Practice'}
          </button>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => {
              fetchSummary();
              if (isRanked) fetchBadges();
            }}
            title="Refresh dashboard"
          >
            &#x21BB;
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="dashboard-mode-tabs">
        <button
          type="button"
          className={`dash-mode-tab ${!isRanked ? 'active practice' : ''}`}
          onClick={() => setDashboardMode('practice')}
        >
          <span className="tab-icon">⌨️</span>
          <span>Practice Overview</span>
        </button>

        <button
          type="button"
          className={`dash-mode-tab ${isRanked ? 'active ranked' : ''}`}
          onClick={() => setDashboardMode('ranked')}
        >
          <span className="tab-icon">🏆</span>
          <span>Ranked Overview &amp; Badges</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="dashboard-state-card loading">
          <div className="skeleton-loader">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
            <div className="skeleton-line row"></div>
          </div>
          <p>Loading {isRanked ? 'ranked' : 'practice'} summary...</p>
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
          <div className="empty-symbol">{isRanked ? '🏆' : '>_'}</div>
          <h3>{isRanked ? 'No Ranked Attempts Yet' : 'Welcome to CodeSpeed!'}</h3>
          <p>
            {isRanked
              ? 'Complete your first competitive ranked typing test to start earning badges and climb your WPM milestones!'
              : "You haven't completed any practice tests yet. Take your first test to unlock your stats dashboard!"}
          </p>
          <button
            type="button"
            className={`action-btn ${isRanked ? 'start-ranked-btn' : 'primary-btn'}`}
            onClick={isRanked ? onNavigateToRanked : onNavigateToPractice}
          >
            {isRanked ? 'Start First Ranked Test' : 'Start Your First Test'}
          </button>
        </div>
      )}

      {/* Populated Dashboard Content */}
      {!loading && !error && summary.totalTests > 0 && (
        <div className="dashboard-content">
          {/* Key Metrics Grid */}
          <div className="metrics-grid">
            {/* Personal Best Card */}
            <div className={`metric-card pb-card ${isRanked ? 'ranked' : ''}`}>
              <div className="metric-card-top">
                <span className="metric-icon">&#x1F3C6;</span>
                <span className="metric-label">{isRanked ? 'Ranked Best' : 'Practice Best'}</span>
              </div>
              <div className="metric-value-row">
                <span className={`metric-value ${isRanked ? 'text-amber' : 'text-cyan'}`}>
                  {summary.personalBest?.wpm || 0}
                </span>
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
              <span className="metric-sub">Recorded {isRanked ? 'ranked' : 'practice'} attempts</span>
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
              <span className="metric-sub">Total session time</span>
            </div>
          </div>

          {/* If in Ranked mode: Show Ranked Badges Grid */}
          {isRanked && (
            <BadgesGrid badges={badges} loading={badgesLoading} />
          )}

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
                        <strong className={`chip-val ${isRanked ? 'text-amber' : 'text-cyan'}`}>{item.bestWpm} WPM</strong>
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
                <h3 className="section-title">Recent {isRanked ? 'Ranked' : 'Practice'} Activity</h3>
                <button
                  type="button"
                  className="link-action-btn"
                  onClick={() => onNavigateToHistory(dashboardMode)}
                >
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
                      <span className={`recent-wpm ${isRanked ? 'text-amber' : 'text-cyan'}`}>
                        {attempt.wpm} WPM
                      </span>
                      <span className="recent-acc text-green">{attempt.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Settings Modal */}
      <PrivacySettingsModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        currentVisibility={user?.practiceStatsVisibility || 'private'}
        onSave={handleSavePrivacy}
      />
    </div>
  );
}

export default Dashboard;
