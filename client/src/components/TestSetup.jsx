import React from 'react';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, TIMER_OPTIONS } from '../data/snippets';

export function TestSetup({
  mode = 'practice',
  language = 'javascript',
  difficulty = 'medium',
  duration = 60,
  onModeChange,
  onLanguageChange,
  onDifficultyChange,
  onDurationChange,
  onStart,
}) {
  const isRanked = mode === 'ranked';

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
            className={`setup-pill ${mode === 'practice' ? 'active' : ''}`}
            onClick={() => onModeChange && onModeChange('practice')}
          >
            Practice
          </button>
          <button
            type="button"
            className={`setup-pill ranked-pill ${mode === 'ranked' ? 'active' : ''}`}
            onClick={() => onModeChange && onModeChange('ranked')}
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
              className={`setup-pill ${language === lang.id ? 'active' : ''}`}
              onClick={() => onLanguageChange && onLanguageChange(lang.id)}
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
              className={`setup-pill diff-${diff.id} ${difficulty === diff.id ? 'active' : ''}`}
              onClick={() => onDifficultyChange && onDifficultyChange(diff.id)}
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
              className={`setup-pill ${duration === timer.seconds ? 'active' : ''}`}
              onClick={() => onDurationChange && onDurationChange(timer.seconds)}
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
          onClick={onStart}
        >
          {isRanked ? 'Start Ranked Test' : 'Start Practice Test'}
        </button>
      </div>
    </div>
  );
}

export default TestSetup;
