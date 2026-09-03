import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { SUPPORTED_LANGUAGES, TIMER_OPTIONS } from '../data/snippets';
import { formatTime } from '../utils/typingMetrics';
import WpmProgressionGraph from './WpmProgressionGraph';

export const SORT_MODES = [
  { id: 'newest', label: 'Newest' },
  { id: 'wpm_desc', label: 'WPM: High \u2192 Low' },
  { id: 'wpm_asc', label: 'WPM: Low \u2192 High' },
];

export function PerformanceHistory({ initialMode = 'practice', onNavigateToPractice }) {
  const [selectedMode, setSelectedMode] = useState(initialMode); // 'practice' | 'ranked'
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedTimer, setSelectedTimer] = useState('all');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performances, setPerformances] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  // Graph data states (always complete chronological series for the active filters and mode)
  const [graphData, setGraphData] = useState([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphTotal, setGraphTotal] = useState(0);
  const [graphTruncated, setGraphTruncated] = useState(false);

  // Fetch paginated tabular history
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPerformances({
        mode: selectedMode,
        language: selectedLanguage,
        timerSeconds: selectedTimer,
        sort: selectedSort,
        page,
        limit: 20,
      });

      if (res && res.data) {
        setPerformances(res.data.performances || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      }
    } catch (err) {
      console.error('[PerformanceHistory] Failed to load history:', err.message);
      setError(err.message || 'Unable to load performance history.');
    } finally {
      setLoading(false);
    }
  }, [selectedMode, selectedLanguage, selectedTimer, selectedSort, page]);

  // Fetch chronological graph series (independent of table sort and pagination)
  const fetchGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const res = await api.getPerformanceGraph({
        mode: selectedMode,
        language: selectedLanguage,
        timerSeconds: selectedTimer,
      });

      if (res && res.data) {
        setGraphData(res.data.graphData || []);
        setGraphTotal(res.data.totalCount || 0);
        setGraphTruncated(Boolean(res.data.truncated));
      }
    } catch (err) {
      console.error('[PerformanceHistory] Failed to load graph data:', err.message);
    } finally {
      setGraphLoading(false);
    }
  }, [selectedMode, selectedLanguage, selectedTimer]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleModeChange = (mode) => {
    setSelectedMode(mode);
    setPage(1);
  };

  const handleLanguageChange = (langId) => {
    setSelectedLanguage(langId);
    setPage(1);
  };

  const handleTimerChange = (timerSec) => {
    setSelectedTimer(timerSec);
    setPage(1);
  };

  const handleSortChange = (sortId) => {
    setSelectedSort(sortId);
    setPage(1);
  };

  const handleRefreshAll = () => {
    fetchHistory();
    fetchGraph();
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateString);
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

  const isRanked = selectedMode === 'ranked';

  return (
    <div className={`history-container ${isRanked ? 'history-ranked-theme' : ''}`}>
      {/* History Header & Practice CTA */}
      <div className="history-header">
        <div>
          <h2 className="history-title">Performance History</h2>
          <p className="history-subtitle">
            {isRanked
              ? 'Review verified competitive ranked attempts and WPM progression.'
              : 'Review casual practice sessions and training history.'}
          </p>
        </div>
        <button type="button" className={`action-btn ${isRanked ? 'start-ranked-btn' : 'primary-btn'} compact`} onClick={onNavigateToPractice}>
          {isRanked ? '🏆 Take Ranked Test' : '>_ Take Practice Test'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="history-filter-card">
        {/* Mode Selector */}
        <div className="filter-group">
          <label className="filter-label">Mode</label>
          <div className="filter-pill-row">
            <button
              type="button"
              className={`filter-pill practice ${selectedMode === 'practice' ? 'active' : ''}`}
              onClick={() => handleModeChange('practice')}
            >
              ⌨️ Practice History
            </button>
            <button
              type="button"
              className={`filter-pill ranked ${selectedMode === 'ranked' ? 'active' : ''}`}
              onClick={() => handleModeChange('ranked')}
            >
              🏆 Ranked History
            </button>
          </div>
        </div>

        {/* Sort Order Control */}
        <div className="filter-group">
          <label className="filter-label">Sort By</label>
          <div className="filter-pill-row">
            {SORT_MODES.map((sortMode) => (
              <button
                key={sortMode.id}
                type="button"
                className={`filter-pill ${selectedSort === sortMode.id ? 'active' : ''}`}
                onClick={() => handleSortChange(sortMode.id)}
              >
                {sortMode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language Filter */}
        <div className="filter-group">
          <label className="filter-label">Filter by Language</label>
          <div className="filter-pill-row">
            <button
              type="button"
              className={`filter-pill ${selectedLanguage === 'all' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('all')}
            >
              All Languages
            </button>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`filter-pill ${selectedLanguage === lang.id ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.id)}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        {/* Timer Filter */}
        <div className="filter-group">
          <label className="filter-label">Filter by Duration</label>
          <div className="filter-pill-row">
            <button
              type="button"
              className={`filter-pill ${selectedTimer === 'all' ? 'active' : ''}`}
              onClick={() => handleTimerChange('all')}
            >
              All Durations
            </button>
            {TIMER_OPTIONS.map((timer) => (
              <button
                key={timer.seconds}
                type="button"
                className={`filter-pill ${selectedTimer === String(timer.seconds) || selectedTimer === timer.seconds ? 'active' : ''}`}
                onClick={() => handleTimerChange(timer.seconds)}
              >
                {timer.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* WPM Progression Graph Section */}
      <WpmProgressionGraph
        graphData={graphData}
        loading={graphLoading}
        totalCount={graphTotal}
        truncated={graphTruncated}
      />

      {/* Summary / Refresh Bar */}
      <div className="history-summary-bar">
        <span className="summary-text">
          {loading ? 'Refreshing records...' : `Showing ${performances.length} of ${pagination.total} ${isRanked ? 'ranked' : 'practice'} attempt${pagination.total === 1 ? '' : 's'}`}
        </span>
        <button type="button" className="refresh-btn" onClick={handleRefreshAll} title="Refresh history and graph">
          &#x21BB; Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="history-state-card loading">
          <div className="skeleton-loader">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
            <div className="skeleton-line row"></div>
          </div>
          <p>Loading your {isRanked ? 'ranked' : 'practice'} records...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="history-state-card error">
          <span className="error-icon">&#x26A0;</span>
          <p className="error-text">{error}</p>
          <button type="button" className="action-btn secondary-btn compact" onClick={handleRefreshAll}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && performances.length === 0 && (
        <div className="history-state-card empty">
          <div className="empty-symbol">{isRanked ? '🏆' : '>_'}</div>
          <h3>No {isRanked ? 'Ranked' : 'Practice'} Records Found</h3>
          <p>
            {selectedLanguage !== 'all' || selectedTimer !== 'all'
              ? `No ${isRanked ? 'ranked' : 'practice'} tests match your selected filters.`
              : `You have not completed any ${isRanked ? 'ranked' : 'practice'} tests yet.`}
          </p>
          <button
            type="button"
            className={`action-btn ${isRanked ? 'start-ranked-btn' : 'primary-btn'}`}
            onClick={onNavigateToPractice}
          >
            {isRanked ? 'Start a Ranked Test' : 'Start Your First Test'}
          </button>
        </div>
      )}

      {/* Records List */}
      {!loading && !error && performances.length > 0 && (
        <div className="history-list">
          {performances.map((perf) => {
            const diffClass = (perf.difficulty || 'medium').toLowerCase();
            const diffDisplay = perf.difficulty ? perf.difficulty.charAt(0).toUpperCase() + perf.difficulty.slice(1) : 'Medium';
            const langName = getLanguageName(perf.language);
            const timerLabel = getTimerLabel(perf.timerSeconds);
            const formattedElapsed = formatTime(perf.elapsedSeconds);
            const isPerfRanked = perf.mode === 'ranked';

            return (
              <div key={perf.id || perf._id} className={`history-card ${isPerfRanked ? 'ranked-card' : ''}`}>
                <div className="card-top">
                  <div className="badge-group">
                    <span className={`mode-badge-tag ${isPerfRanked ? 'ranked' : 'practice'}`}>
                      {isPerfRanked ? '🏆 Ranked' : '⌨️ Practice'}
                    </span>
                    <span className="lang-tag">{langName}</span>
                    <span className={`diff-tag ${diffClass}`}>{diffDisplay}</span>
                    <span className="timer-badge">&#x23F1; {timerLabel}</span>
                  </div>
                  <div className="attempt-date">{formatTimestamp(perf.createdAt)}</div>
                </div>

                <div className="card-stats-grid">
                  <div className="stat-block wpm-block">
                    <span className={`stat-num ${isPerfRanked ? 'text-amber' : 'text-cyan'}`}>{perf.wpm}</span>
                    <span className="stat-lbl">WPM</span>
                  </div>
                  <div className="stat-block accuracy-block">
                    <span className="stat-num">{perf.accuracy}%</span>
                    <span className="stat-lbl">Accuracy</span>
                  </div>
                  <div className="stat-block">
                    <span className="stat-num text-green">{perf.correctChars}</span>
                    <span className="stat-lbl">Correct</span>
                  </div>
                  <div className="stat-block">
                    <span className="stat-num text-red">{perf.incorrectChars}</span>
                    <span className="stat-lbl">Errors</span>
                  </div>
                  <div className="stat-block">
                    <span className="stat-num">{formattedElapsed}</span>
                    <span className="stat-lbl">Time</span>
                  </div>
                </div>

                {perf.snippetId && (
                  <div className="card-bottom">
                    <span className="snippet-ref">Snippet: <code>{perf.snippetId}</code></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="page-btn"
            disabled={pagination.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </button>
          <span className="page-indicator">
            Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
          </span>
          <button
            type="button"
            className="page-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

export default PerformanceHistory;
