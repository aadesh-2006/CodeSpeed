import React, { useState, useEffect, useRef } from 'react';
import { calculateWPM, calculateAccuracy, formatTime, compareCharacters } from '../utils/typingMetrics';

export function TypingTest({ snippet, durationSeconds, languageName, onFinish, onCancel, onRestart }) {
  const [typedCode, setTypedCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const textareaRef = useRef(null);
  const timerRef = useRef(null);
  const codeDisplayRef = useRef(null);

  const targetCode = snippet?.code || '';

  // Focus textarea on mount and reset state
  useEffect(() => {
    setTypedCode('');
    setTimeLeft(durationSeconds);
    setElapsedSeconds(0);
    setHasStarted(false);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [snippet, durationSeconds]);

  // Handle countdown timer
  useEffect(() => {
    if (!hasStarted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prevTime - 1;
      });

      setElapsedSeconds((prevElapsed) => prevElapsed + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [hasStarted]);

  // When timer reaches 0, finish the test
  useEffect(() => {
    if (hasStarted && timeLeft === 0) {
      finishTest();
    }
  }, [timeLeft, hasStarted]);

  // Live character comparison
  const comparison = compareCharacters(targetCode, typedCode);
  const liveWpm = calculateWPM(comparison.correctCount, elapsedSeconds);
  const liveAccuracy = calculateAccuracy(comparison.correctCount, comparison.totalTyped);

  // Auto-finish if full snippet is correctly typed
  useEffect(() => {
    if (hasStarted && comparison.isComplete) {
      finishTest();
    }
  }, [comparison.isComplete, hasStarted]);

  const finishTest = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const finalElapsed = Math.max(1, elapsedSeconds || durationSeconds - timeLeft);
    const finalWpm = calculateWPM(comparison.correctCount, finalElapsed);
    const finalAccuracy = calculateAccuracy(comparison.correctCount, comparison.totalTyped);

    onFinish({
      wpm: finalWpm,
      accuracy: finalAccuracy,
      correctChars: comparison.correctCount,
      incorrectChars: comparison.incorrectCount,
      totalTyped: comparison.totalTyped,
      elapsedSeconds: finalElapsed,
      timeElapsedSeconds: finalElapsed,
      timeElapsedFormatted: formatTime(finalElapsed),
      language: snippet.language,
      languageName,
      difficulty: snippet.difficulty,
      timerSeconds: durationSeconds,
      snippetId: snippet.id,
      snippetTitle: snippet.title,
    });
  };

  const handleInputChange = (e) => {
    if (timeLeft === 0) return;
    if (!hasStarted) {
      setHasStarted(true);
    }
    setTypedCode(e.target.value);
  };

  // Keyboard navigation & indentation handling (Tab inserts 2 spaces)
  const handleKeyDown = (e) => {
    if (timeLeft === 0) return;

    if (!hasStarted) {
      setHasStarted(true);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '  '; // 2 spaces for code indentation

      const updated = typedCode.substring(0, start) + spaces + typedCode.substring(end);
      setTypedCode(updated);

      // Restore cursor position after inserted spaces
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + spaces.length;
        }
      });
    }
  };

  const handleCodeAreaClick = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="typing-test-container">
      {/* Top Test Navigation Bar */}
      <div className="test-nav-bar">
        <div className="meta-left">
          <span className="lang-tag">{languageName}</span>
          <span className={`diff-tag ${snippet.difficulty?.toLowerCase()}`}>
            {snippet.difficulty ? snippet.difficulty.charAt(0).toUpperCase() + snippet.difficulty.slice(1) : ''}
          </span>
          <span className="snippet-tag">{snippet.title}</span>
        </div>
        <div className={`countdown-timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
          <span className="timer-icon">&#x23F1;</span>
          <span className="timer-digits">{formatTime(timeLeft)}</span>
        </div>
        <div className="meta-right">
          <button type="button" className="nav-btn" onClick={onRestart} title="Restart test">
            &#x21BB; Restart
          </button>
          <button type="button" className="nav-btn secondary" onClick={onCancel} title="Exit test">
            Settings
          </button>
        </div>
      </div>

      {/* Target Code Display Area */}
      <div className="code-display-panel" onClick={handleCodeAreaClick} ref={codeDisplayRef}>
        <div className="code-header">
          <span className="window-dots">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
          </span>
          <span className="code-instruction">
            {!hasStarted ? 'Start typing to begin timer...' : 'Keep typing target code...'}
          </span>
        </div>
        <pre className="code-content">
          <code>
            {comparison.charStatuses.map((item, index) => {
              let displayChar = item.char;
              let isNewline = item.char === '\n';

              return (
                <span
                  key={index}
                  className={`code-char ${item.status} ${isNewline ? 'newline-char' : ''}`}
                >
                  {isNewline ? (item.status === 'current' || item.status === 'incorrect' ? '↵\n' : '\n') : displayChar}
                </span>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Input Typing Area */}
      <div className="typing-input-panel">
        <label htmlFor="code-typing-textarea" className="input-label">
          Typing Area (Tab key inserts indentation)
        </label>
        <textarea
          id="code-typing-textarea"
          ref={textareaRef}
          className="code-textarea"
          value={typedCode}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Click here and start typing the code above..."
          disabled={timeLeft === 0}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={6}
        />
      </div>

      {/* Live Metrics Gauge */}
      <div className="live-metrics-bar">
        <div className="metric-box">
          <span className="metric-number">{liveWpm}</span>
          <span className="metric-title">WPM</span>
        </div>
        <div className="metric-box">
          <span className="metric-number">{liveAccuracy}%</span>
          <span className="metric-title">Accuracy</span>
        </div>
        <div className="metric-box">
          <span className="metric-number">{comparison.correctCount}</span>
          <span className="metric-title">Correct</span>
        </div>
        <div className="metric-box">
          <span className="metric-number">{comparison.incorrectCount}</span>
          <span className="metric-title">Errors</span>
        </div>
        <div className="metric-box">
          <span className="metric-number">{comparison.totalTyped} / {targetCode.length}</span>
          <span className="metric-title">Progress</span>
        </div>
      </div>
    </div>
  );
}

export default TypingTest;
