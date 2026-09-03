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
    <div className={`dashboard-view ${isRanked ? 'ranked-theme' : ''}`}>
      {/* Top Header & Mode Toggle Bar */}
      <div className="view-header">
        <div className="view-title-group">
          <h1 className="view-title">
            Dashboard
          </h1>
          <p className="view-subtitle">
            {isRanked
              ? 'Competitive ranked progression, milestone achievements, and verified statistics.'
              : 'Casual practice statistics, language breakdown, and typing speed.'}
          </p>
        </div>

        <div className="view-actions">
          {/* Mode Switcher Segmented Control */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segment-btn ${!isRanked ? 'active' : ''}`}
              onClick={() => setDashboardMode('practice')}
            >
              Practice
            </button>
            <button
              type="button"
              className={`segment-btn ${isRanked ? 'active ranked' : ''}`}
              onClick={() => setDashboardMode('ranked')}
            >
              Ranked
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPrivacyModalOpen(true)}
            title="Configure practice visibility"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>{user?.practiceStatsVisibility === 'public' ? 'Public' : 'Private'}</span>
          </button>

          {onViewPublicProfile && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onViewPublicProfile(user?.username)}
            >
              Profile
            </button>
          )}

          <button
            type="button"
            className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'} btn-sm`}
            onClick={isRanked ? onNavigateToRanked : onNavigateToPractice}
          >
            {isRanked ? 'Start Ranked Test' : 'Start Practice Test'}
          </button>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={() => {
              fetchSummary();
              if (isRanked) fetchBadges();
            }}
            title="Refresh statistics"
          >
            &#x21BB;
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="panel state-panel loading">
          <div className="loading-spinner"></div>
          <p>Loading {isRanked ? 'ranked' : 'practice'} statistics...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="panel state-panel error">
          <p className="error-text">{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchSummary}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && summary.totalTests === 0 && (
        <div className="panel state-panel empty">
          <div className="empty-glyph">&gt;_</div>
          <h3>{isRanked ? 'No Ranked Attempts Recorded' : 'No Practice Attempts Yet'}</h3>
          <p>
            {isRanked
              ? 'Complete a ranked typing test to record verified performance records and unlock milestone badges.'
              : 'Complete your first coding typing test to generate your performance dashboard.'}
          </p>
          <button
            type="button"
            className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'}`}
            onClick={isRanked ? onNavigateToRanked : onNavigateToPractice}
          >
            {isRanked ? 'Start First Ranked Test' : 'Start Your First Test'}
          </button>
        </div>
      )}

      {/* Populated Dashboard Content */}
      {!loading && !error && summary.totalTests > 0 && (
        <div className="dashboard-grid">
          {/* Key Metrics Row */}
          <div className="stats-row">
            {/* Best WPM */}
            <div className={`stat-card ${isRanked ? 'stat-ranked' : ''}`}>
              <span className="stat-label">{isRanked ? 'Ranked Best' : 'Personal Best'}</span>
              <div className="stat-value-group">
                <span className={`stat-number ${isRanked ? 'text-amber' : 'text-cyan'}`}>
                  {summary.personalBest?.wpm || 0}
                </span>
                <span className="stat-unit">WPM</span>
              </div>
              {summary.personalBest && (
                <div className="stat-meta">
                  <span className="badge-tag">{getLanguageName(summary.personalBest.language)}</span>
                  <span className="stat-meta-text">{summary.personalBest.accuracy}% acc</span>
                </div>
              )}
            </div>

            {/* Average WPM */}
            <div className="stat-card">
              <span className="stat-label">Average Speed</span>
              <div className="stat-value-group">
                <span className="stat-number">{summary.averageWpm}</span>
                <span className="stat-unit">WPM</span>
              </div>
              <span className="stat-meta-text">{summary.totalTests} total sessions</span>
            </div>

            {/* Average Accuracy */}
            <div className="stat-card">
              <span className="stat-label">Average Accuracy</span>
              <div className="stat-value-group">
                <span className="stat-number text-green">{summary.averageAccuracy}%</span>
              </div>
              <span className="stat-meta-text">Typing precision</span>
            </div>

            {/* Tests Completed */}
            <div className="stat-card">
              <span className="stat-label">Tests Completed</span>
              <div className="stat-value-group">
                <span className="stat-number">{summary.totalTests}</span>
              </div>
              <span className="stat-meta-text">{isRanked ? 'Verified ranked' : 'Practice sessions'}</span>
            </div>

            {/* Total Time Typed */}
            <div className="stat-card">
              <span className="stat-label">Time Typed</span>
              <div className="stat-value-group">
                <span className="stat-number text-purple">{formatTime(summary.totalTimeTypedSeconds)}</span>
              </div>
              <span className="stat-meta-text">Active typing</span>
            </div>
          </div>

          {/* Badges Section (Ranked Mode) */}
          {isRanked && (
            <BadgesGrid badges={badges} loading={badgesLoading} />
          )}

          {/* 2-Column Section: Language Performance & Recent Activity */}
          <div className="dashboard-columns">
            {/* Language Breakdown Panel */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Language Breakdown</h3>
                <span className="panel-badge">{summary.languageBreakdown.length} languages</span>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Language</th>
                      <th>Tests</th>
                      <th>Best</th>
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.languageBreakdown.map((item) => (
                      <tr key={item.language}>
                        <td>
                          <span className="badge-tag">{getLanguageName(item.language)}</span>
                        </td>
                        <td className="text-muted">{item.testCount}</td>
                        <td className={isRanked ? 'text-amber' : 'text-cyan'}>
                          <strong>{item.bestWpm} WPM</strong>
                        </td>
                        <td>{item.averageWpm} WPM</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity Panel */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Recent Activity</h3>
                <button
                  type="button"
                  className="link-text"
                  onClick={() => onNavigateToHistory(dashboardMode)}
                >
                  View All &rarr;
                </button>
              </div>

              <div className="activity-list">
                {summary.recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="activity-row">
                    <div className="activity-left">
                      <span className="badge-tag">{getLanguageName(attempt.language)}</span>
                      <span className="activity-meta">{getTimerLabel(attempt.timerSeconds)}</span>
                      <span className="activity-date">{formatTimestamp(attempt.createdAt)}</span>
                    </div>
                    <div className="activity-right">
                      <span className={`activity-wpm ${isRanked ? 'text-amber' : 'text-cyan'}`}>
                        {attempt.wpm} WPM
                      </span>
                      <span className="activity-acc text-green">{attempt.accuracy}%</span>
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
