import React from 'react';

export function TestResult({
  mode = 'practice',
  results,
  saveStatus,
  onTryAgain,
  onChangeSettings,
  onViewHistory,
  onViewDashboard,
}) {
  const {
    wpm = 0,
    accuracy = 0,
    correctChars = 0,
    incorrectChars = 0,
    totalTyped = 0,
    timeElapsedFormatted = '00:00',
    languageName = '',
    difficulty = '',
  } = results || {};

  const isRanked = mode === 'ranked';
  const displayDiff = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : '';

  return (
    <div className={`result-panel ${isRanked ? 'ranked-result' : ''}`}>
      {/* Header */}
      <div className="result-header">
        <div className="result-status-row">
          <span className={`status-pill ${isRanked ? 'ranked' : 'practice'}`}>
            {isRanked ? 'Ranked Test Complete' : 'Practice Test Complete'}
          </span>
          {saveStatus === 'saving' && (
            <span className="save-indicator saving">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="save-indicator saved">&#x2714; Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="save-indicator error">Local only</span>
          )}
        </div>

        <h2 className="result-title">Performance Summary</h2>
        {languageName && (
          <p className="result-subtitle">
            {languageName} {displayDiff ? `\u2022 ${displayDiff}` : ''}
          </p>
        )}
      </div>

      {/* Hero Stats */}
      <div className="result-hero-row">
        <div className={`hero-stat-card ${isRanked ? 'ranked-accent' : 'primary-accent'}`}>
          <span className="hero-stat-value">{wpm}</span>
          <span className="hero-stat-label">Words Per Minute</span>
        </div>
        <div className="hero-stat-card">
          <span className="hero-stat-value text-green">{accuracy}%</span>
          <span className="hero-stat-label">Accuracy</span>
        </div>
      </div>

      {isRanked && (
        <div className="ranked-notice-bar">
          <span>Ranked performance recorded. Check Dashboard for updated milestones and badges.</span>
        </div>
      )}

      {/* Breakdown Grid */}
      <div className="result-breakdown-grid">
        <div className="breakdown-item">
          <span className="breakdown-label">Correct</span>
          <span className="breakdown-val text-green">{correctChars}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Errors</span>
          <span className="breakdown-val text-red">{incorrectChars}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Total Typed</span>
          <span className="breakdown-val">{totalTyped}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Time Elapsed</span>
          <span className="breakdown-val">{timeElapsedFormatted}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="result-actions">
        <button
          type="button"
          className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'}`}
          onClick={onTryAgain}
        >
          Try Again
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onChangeSettings}
        >
          Settings
        </button>
        {onViewDashboard && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onViewDashboard}
          >
            Dashboard
          </button>
        )}
        {onViewHistory && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onViewHistory}
          >
            History &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

export default TestResult;
