import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function DailyActivity({ username, date, onNavigateBack, onNavigateHome }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivity = useCallback(async () => {
    if (!username || !date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUserDailyActivity(username, date);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('[DailyActivity] Failed to load activity:', err.message);
      setError(err.message || `Unable to load activity for ${date}.`);
    } finally {
      setLoading(false);
    }
  }, [username, date]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const formatTimeOfDay = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getLanguageLabel = (lang) => {
    if (!lang) return '—';
    const map = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      cpp: 'C++',
      c: 'C',
      java: 'Java',
      html: 'HTML',
      css: 'CSS',
      rust: 'Rust',
      go: 'Go',
    };
    return map[lang.toLowerCase()] || lang;
  };

  const tests = data?.tests || [];
  const totalCount = data?.totalTests ?? 0;
  const formattedDate = data?.formattedDate || date;

  return (
    <div className="daily-activity-view">
      {/* Navigation & Header */}
      <div className="view-header">
        <div className="view-header-left">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateBack || onNavigateHome}
          >
            &larr; Back to Profile
          </button>
        </div>
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={fetchActivity}
          title="Refresh activity"
        >
          &#x21BB;
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="panel state-panel loading">
          <div className="loading-spinner"></div>
          <p>Loading activity for @{username} on {date}...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="panel state-panel error">
          <h3>Activity Unavailable</h3>
          <p className="error-text">{error}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateBack || onNavigateHome}
          >
            Return
          </button>
        </div>
      )}

      {/* Loaded Daily Activity */}
      {!loading && !error && data && (
        <div className="daily-activity-content">
          {/* Header Panel */}
          <div className="panel activity-header-panel">
            <div className="activity-header-info">
              <div className="activity-title-row">
                <h1 className="activity-heading">
                  Activity &mdash; {formattedDate}
                </h1>
                <span className="badge-tag user-tag">@{data.username}</span>
                {data.isOwner && <span className="badge-owner">You</span>}
              </div>
              <p className="activity-subheading">
                {totalCount === 0
                  ? 'No tests completed on this day'
                  : `${totalCount} ${totalCount === 1 ? 'test' : 'tests'} completed`}
              </p>
            </div>

            {totalCount > 0 && (
              <div className="activity-quick-stats">
                <div className="quick-stat-pill">
                  <span className="quick-stat-label">Ranked:</span>
                  <span className="quick-stat-val text-amber">{data.rankedCount || 0}</span>
                </div>
                <div className="quick-stat-pill">
                  <span className="quick-stat-label">Practice:</span>
                  <span className="quick-stat-val text-blue">{data.practiceCount || 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* Attempts Table or Empty State */}
          {totalCount === 0 ? (
            <div className="panel state-panel empty activity-empty">
              <div className="empty-glyph">&gt;_</div>
              <h3>No Tests Completed on This Day</h3>
              <p>
                No typing tests were recorded for @{data.username} on {formattedDate}.
              </p>
            </div>
          ) : (
            <div className="panel activity-table-panel">
              <div className="activity-table-wrapper">
                <table className="activity-table" aria-label={`Typing tests on ${formattedDate}`}>
                  <thead>
                    <tr>
                      <th scope="col" className="col-num">#</th>
                      <th scope="col" className="col-mode">Mode</th>
                      <th scope="col" className="col-lang">Language</th>
                      <th scope="col" className="col-diff">Difficulty</th>
                      <th scope="col" className="col-timer">Duration</th>
                      <th scope="col" className="col-wpm">Speed</th>
                      <th scope="col" className="col-acc">Accuracy</th>
                      <th scope="col" className="col-time">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((test, index) => {
                      const isRanked = test.mode === 'ranked';
                      return (
                        <tr key={test.id || index} className={`activity-attempt-row ${isRanked ? 'row-ranked' : 'row-practice'}`}>
                          <td className="col-num">{tests.length - index}</td>
                          <td className="col-mode">
                            <span className={`badge-mode ${isRanked ? 'badge-ranked' : 'badge-practice'}`}>
                              {isRanked ? 'Ranked' : 'Practice'}
                            </span>
                          </td>
                          <td className="col-lang">
                            <span className="badge-tag">{getLanguageLabel(test.language)}</span>
                          </td>
                          <td className="col-diff">
                            <span className={`badge-diff diff-${test.difficulty}`}>
                              {test.difficulty}
                            </span>
                          </td>
                          <td className="col-timer">{test.timerSeconds}s</td>
                          <td className="col-wpm">
                            <span className={`wpm-mono ${isRanked ? 'text-amber' : 'text-primary'}`}>
                              {test.wpm}
                            </span>
                            <span className="wpm-unit"> WPM</span>
                          </td>
                          <td className="col-acc">
                            <span className="acc-val">{test.accuracy}%</span>
                          </td>
                          <td className="col-time text-dim font-mono">
                            {formatTimeOfDay(test.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DailyActivity;
