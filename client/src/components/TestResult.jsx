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
    <div className={`test-result-card ${isRanked ? 'ranked-result-card' : ''}`}>
      <div className="result-header">
        <div className="result-badges-row">
          <span className={`result-badge ${isRanked ? 'ranked-badge-pill' : 'practice-badge-pill'}`}>
            {isRanked ? '🏆 Ranked Test Complete' : '⌨️ Practice Test Complete'}
          </span>
          {saveStatus === 'saving' && (
            <span className="save-badge saving">Saving performance...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="save-badge saved">&#x2714; Saved to account</span>
          )}
          {saveStatus === 'error' && (
            <span className="save-badge error">Local result only</span>
          )}
        </div>
        <h2 className="result-title">Performance Summary</h2>
        {languageName && (
          <p className="result-subtitle">
            {languageName} {displayDiff ? `• ${displayDiff}` : ''} Coding Test
          </p>
        )}
      </div>

      <div className="result-hero-stats">
        <div className={`hero-stat-box ${isRanked ? 'ranked-hero' : 'primary'}`}>
          <div className="stat-value">{wpm}</div>
          <div className="stat-label">Words Per Minute</div>
        </div>
        <div className="hero-stat-box secondary">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      {isRanked && (
        <div className="ranked-congrats-banner">
          <span>⚡ Ranked test recorded! Check your Dashboard for updated ranked stats &amp; badges.</span>
        </div>
      )}

      <div className="result-details-grid">
        <div className="detail-item">
          <span className="detail-label">Correct Characters</span>
          <span className="detail-value text-green">{correctChars}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Incorrect Characters</span>
          <span className="detail-value text-red">{incorrectChars}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Total Typed</span>
          <span className="detail-value">{totalTyped}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Time Elapsed</span>
          <span className="detail-value">{timeElapsedFormatted}</span>
        </div>
      </div>

      <div className="result-actions">
        <button type="button" className={`action-btn ${isRanked ? 'start-ranked-btn' : 'primary-btn'}`} onClick={onTryAgain}>
          Try Again
        </button>
        <button type="button" className="action-btn secondary-btn" onClick={onChangeSettings}>
          Change Settings
        </button>
        {onViewDashboard && (
          <button type="button" className="action-btn secondary-btn" onClick={onViewDashboard}>
            Dashboard
          </button>
        )}
        {onViewHistory && (
          <button type="button" className="action-btn history-btn" onClick={onViewHistory}>
            History &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

export default TestResult;
