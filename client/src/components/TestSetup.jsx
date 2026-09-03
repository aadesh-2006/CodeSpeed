import React from 'react';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, TIMER_OPTIONS } from '../data/snippets';

export function TestSetup({
  selectedMode = 'practice',
  setSelectedMode,
  selectedLanguage,
  setSelectedLanguage,
  selectedDifficulty,
  setSelectedDifficulty,
  selectedDuration,
  setSelectedDuration,
  onStartTest,
}) {
  const isRanked = selectedMode === 'ranked';

  return (
    <div className={`test-setup-card ${isRanked ? 'ranked-mode-card' : ''}`}>
      {/* 0. Mode Selection (Practice vs Ranked) */}
      <div className="setup-section mode-select-section">
        <label className="section-label">Select Mode</label>
        <div className="mode-toggle-pills">
          <button
            type="button"
            className={`mode-pill practice-pill ${selectedMode === 'practice' ? 'active' : ''}`}
            onClick={() => setSelectedMode && setSelectedMode('practice')}
          >
            <span className="mode-icon">⌨️</span>
            <div className="mode-pill-text">
              <strong>Practice</strong>
              <small>Casual, private practice</small>
            </div>
          </button>

          <button
            type="button"
            className={`mode-pill ranked-pill ${selectedMode === 'ranked' ? 'active' : ''}`}
            onClick={() => setSelectedMode && setSelectedMode('ranked')}
          >
            <span className="mode-icon">🏆</span>
            <div className="mode-pill-text">
              <strong>Ranked</strong>
              <small>Competitive, earns badges</small>
            </div>
          </button>
        </div>
      </div>

      {/* 1. Language Selection */}
      <div className="setup-section">
        <label className="section-label">Select Programming Language</label>
        <div className="language-grid">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={`lang-pill ${selectedLanguage === lang.id ? 'active' : ''}`}
              onClick={() => setSelectedLanguage(lang.id)}
            >
              <span className="lang-icon">&gt;</span>
              <span className="lang-name">{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Difficulty Selection */}
      <div className="setup-section">
        <label className="section-label">Select Difficulty</label>
        <div className="difficulty-grid">
          {DIFFICULTY_LEVELS.map((diff) => (
            <button
              key={diff.id}
              type="button"
              className={`diff-pill ${diff.id} ${selectedDifficulty === diff.id ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty(diff.id)}
            >
              <span className="diff-dot"></span>
              <span className="diff-name">{diff.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Duration Selection */}
      <div className="setup-section">
        <label className="section-label">Select Duration</label>
        <div className="timer-grid">
          {TIMER_OPTIONS.map((timer) => (
            <button
              key={timer.seconds}
              type="button"
              className={`timer-pill ${selectedDuration === timer.seconds ? 'active' : ''}`}
              onClick={() => setSelectedDuration(timer.seconds)}
            >
              {timer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start Action */}
      <div className="setup-action">
        <button
          type="button"
          className={`start-test-btn ${isRanked ? 'start-ranked-btn' : ''}`}
          onClick={onStartTest}
        >
          {isRanked ? '🏆 Start Ranked Coding Test' : '>_ Start Coding Test'}
        </button>
      </div>
    </div>
  );
}

export default TestSetup;
