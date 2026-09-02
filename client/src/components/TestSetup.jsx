import React from 'react';
import { SUPPORTED_LANGUAGES, TIMER_OPTIONS } from '../data/snippets';

export function TestSetup({ selectedLanguage, setSelectedLanguage, selectedDuration, setSelectedDuration, onStartTest }) {
  return (
    <div className="test-setup-card">
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

      <div className="setup-action">
        <button type="button" className="start-test-btn" onClick={onStartTest}>
          Start Coding Test
        </button>
      </div>
    </div>
  );
}

export default TestSetup;
