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
    <div className={`history-view ${isRanked ? 'ranked-theme' : ''}`}>
      {/* Header */}
      <div className="view-header">
        <div className="view-title-group">
          <h1 className="view-title">Performance History</h1>
          <p className="view-subtitle">
            {isRanked
              ? 'Verified competitive ranked attempts and progression.'
              : 'Casual practice history and typing speed progression.'}
          </p>
        </div>

        <div className="view-actions">
          {/* Mode Switcher */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segment-btn ${!isRanked ? 'active' : ''}`}
              onClick={() => handleModeChange('practice')}
            >
              Practice
            </button>
            <button
              type="button"
              className={`segment-btn ${isRanked ? 'active ranked' : ''}`}
              onClick={() => handleModeChange('ranked')}
            >
              Ranked
            </button>
          </div>

          <button
            type="button"
            className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'} btn-sm`}
            onClick={onNavigateToPractice}
          >
            {isRanked ? 'Take Ranked Test' : 'Take Practice Test'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        {/* Sort Filter */}
        <div className="filter-field">
          <span className="filter-label">Sort:</span>
          <div className="filter-pill-group">
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
        <div className="filter-field">
          <span className="filter-label">Language:</span>
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${selectedLanguage === 'all' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('all')}
            >
              All
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

        {/* Duration Filter */}
        <div className="filter-field">
          <span className="filter-label">Duration:</span>
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${selectedTimer === 'all' ? 'active' : ''}`}
              onClick={() => handleTimerChange('all')}
            >
              All
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

      {/* Summary / Counter Bar */}
      <div className="history-count-bar">
        <span className="history-count-text">
          {loading ? 'Refreshing records...' : `Showing ${performances.length} of ${pagination.total} ${isRanked ? 'ranked' : 'practice'} attempt${pagination.total === 1 ? '' : 's'}`}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleRefreshAll} title="Refresh records">
          &#x21BB; Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="panel state-panel loading">
          <div className="loading-spinner"></div>
          <p>Loading {isRanked ? 'ranked' : 'practice'} records...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="panel state-panel error">
          <p className="error-text">{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleRefreshAll}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && performances.length === 0 && (
        <div className="panel state-panel empty">
          <div className="empty-glyph">&gt;_</div>
          <h3>No {isRanked ? 'Ranked' : 'Practice'} Records Found</h3>
          <p>
            {selectedLanguage !== 'all' || selectedTimer !== 'all'
              ? `No ${isRanked ? 'ranked' : 'practice'} tests match the selected filters.`
              : `You have not completed any ${isRanked ? 'ranked' : 'practice'} tests yet.`}
          </p>
          <button
            type="button"
            className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'}`}
            onClick={onNavigateToPractice}
          >
            {isRanked ? 'Start a Ranked Test' : 'Start a Practice Test'}
          </button>
        </div>
      )}

      {/* Records Table */}
      {!loading && !error && performances.length > 0 && (
        <div className="panel history-table-panel">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Language</th>
                  <th>Difficulty</th>
                  <th>Duration</th>
                  <th>WPM</th>
                  <th>Accuracy</th>
                  <th>Correct / Errors</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {performances.map((perf) => {
                  const isPerfRanked = perf.mode === 'ranked';
                  const diffClass = (perf.difficulty || 'medium').toLowerCase();
                  const diffDisplay = perf.difficulty ? perf.difficulty.charAt(0).toUpperCase() + perf.difficulty.slice(1) : 'Medium';
                  const langName = getLanguageName(perf.language);
                  const timerLabel = getTimerLabel(perf.timerSeconds);
                  const formattedElapsed = formatTime(perf.elapsedSeconds);

                  return (
                    <tr key={perf.id || perf._id} className={isPerfRanked ? 'row-ranked' : ''}>
                      <td>
                        <span className={`badge-mode ${isPerfRanked ? 'ranked' : 'practice'}`}>
                          {isPerfRanked ? 'Ranked' : 'Practice'}
                        </span>
                      </td>
                      <td>
                        <span className="badge-tag">{langName}</span>
                      </td>
                      <td>
                        <span className={`diff-tag ${diffClass}`}>{diffDisplay}</span>
                      </td>
                      <td className="text-muted">{timerLabel}</td>
                      <td>
                        <strong className={isPerfRanked ? 'text-amber' : 'text-cyan'}>{perf.wpm} WPM</strong>
                      </td>
                      <td className="text-green">{perf.accuracy}%</td>
                      <td className="text-muted font-mono">
                        <span className="text-green">{perf.correctChars}</span> / <span className="text-red">{perf.incorrectChars}</span>
                      </td>
                      <td className="text-muted font-mono">{formattedElapsed}</td>
                      <td className="text-muted">{formatTimestamp(perf.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </button>
          <span className="pagination-info">
            Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
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
