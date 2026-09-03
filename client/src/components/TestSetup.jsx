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
    <div className={`setup-panel ${isRanked ? 'ranked-setup' : ''}`}>
      {/* Mode Selection Control */}
      <div className="setup-block">
        <div className="setup-block-header">
          <span className="setup-label">Mode</span>
          <span className="setup-hint">
            {isRanked ? 'Competitive ranked test (earns badges)' : 'Casual unranked practice'}
          </span>
        </div>
        <div className="setup-pill-group">
          <button
            type="button"
            className={`setup-pill ${selectedMode === 'practice' ? 'active' : ''}`}
            onClick={() => setSelectedMode && setSelectedMode('practice')}
          >
            Practice
          </button>
          <button
            type="button"
            className={`setup-pill ranked-pill ${selectedMode === 'ranked' ? 'active' : ''}`}
            onClick={() => setSelectedMode && setSelectedMode('ranked')}
          >
            Ranked
          </button>
        </div>
      </div>

      {/* Language Selection */}
      <div className="setup-block">
        <div className="setup-block-header">
          <span className="setup-label">Language</span>
        </div>
        <div className="setup-pill-group language-pill-group">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={`setup-pill ${selectedLanguage === lang.id ? 'active' : ''}`}
              onClick={() => setSelectedLanguage(lang.id)}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty Selection */}
      <div className="setup-block">
        <div className="setup-block-header">
          <span className="setup-label">Difficulty</span>
        </div>
        <div className="setup-pill-group">
          {DIFFICULTY_LEVELS.map((diff) => (
            <button
              key={diff.id}
              type="button"
              className={`setup-pill diff-${diff.id} ${selectedDifficulty === diff.id ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty(diff.id)}
            >
              <span className="diff-indicator"></span>
              {diff.name}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selection */}
      <div className="setup-block">
        <div className="setup-block-header">
          <span className="setup-label">Duration</span>
        </div>
        <div className="setup-pill-group">
          {TIMER_OPTIONS.map((timer) => (
            <button
              key={timer.seconds}
              type="button"
              className={`setup-pill ${selectedDuration === timer.seconds ? 'active' : ''}`}
              onClick={() => setSelectedDuration(timer.seconds)}
            >
              {timer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action CTA */}
      <div className="setup-footer">
        <button
          type="button"
          className={`btn ${isRanked ? 'btn-amber' : 'btn-primary'} btn-lg`}
          onClick={onStartTest}
        >
          {isRanked ? 'Start Ranked Test' : 'Start Practice Test'}
        </button>
      </div>
    </div>
  );
}

export default TestSetup;
