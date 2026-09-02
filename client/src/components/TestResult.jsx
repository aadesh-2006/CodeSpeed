import React from 'react';

export function TestResult({ results, onTryAgain, onChangeSettings }) {
  const {
    wpm = 0,
    accuracy = 0,
    correctChars = 0,
    incorrectChars = 0,
    totalTyped = 0,
    timeElapsedFormatted = '00:00',
    languageName = '',
  } = results || {};

  return (
    <div className="test-result-card">
      <div className="result-header">
        <span className="result-badge">Test Complete</span>
        <h2 className="result-title">Performance Summary</h2>
        {languageName && <p className="result-subtitle">{languageName} Coding Test</p>}
      </div>

      <div className="result-hero-stats">
        <div className="hero-stat-box primary">
          <div className="stat-value">{wpm}</div>
          <div className="stat-label">Words Per Minute</div>
        </div>
        <div className="hero-stat-box secondary">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

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
        <button type="button" className="action-btn primary-btn" onClick={onTryAgain}>
          Try Again
        </button>
        <button type="button" className="action-btn secondary-btn" onClick={onChangeSettings}>
          Change Settings
        </button>
      </div>
    </div>
  );
}

export default TestResult;
