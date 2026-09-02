import React from 'react';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, TIMER_OPTIONS } from '../data/snippets';

export function TestSetup({
  selectedLanguage,
  setSelectedLanguage,
  selectedDifficulty,
  setSelectedDifficulty,
  selectedDuration,
  setSelectedDuration,
  onStartTest,
}) {
  return (
    <div className="test-setup-card">
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
        <button type="button" className="start-test-btn" onClick={onStartTest}>
          Start Coding Test
        </button>
      </div>
    </div>
  );
}

export default TestSetup;
