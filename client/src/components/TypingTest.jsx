import React, { useState, useEffect, useRef } from 'react';
import {
  calculateWPM,
  calculateAccuracy,
  formatTime,
  compareCharacters,
  getNextLineIndent,
} from '../utils/typingMetrics';

export function TypingTest({ snippet, durationSeconds, languageName, onFinish, onCancel, onRestart }) {
  const [typedCode, setTypedCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const textareaRef = useRef(null);
  const timerRef = useRef(null);
  const codeDisplayRef = useRef(null);

  const targetCode = snippet?.code || '';
  const language = snippet?.language || '';

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

  // Live character comparison with whitespace tolerance and language awareness
  const comparison = compareCharacters(targetCode, typedCode, { language });
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

  // Keyboard navigation & smart indentation handling (Enter auto-indents, Tab inserts 2 spaces)
  const handleKeyDown = (e) => {
    if (timeLeft === 0) return;

    if (!hasStarted) {
      setHasStarted(true);
    }

    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '  '; // 2 spaces for code indentation

      const updated = typedCode.substring(0, start) + spaces + typedCode.substring(end);
      setTypedCode(updated);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + spaces.length;
        }
      });
      return;
    }

    // Enter key auto-indents to next line
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const nextIndent = getNextLineIndent(targetCode, typedCode.substring(0, start), language);
      const insertion = '\n' + nextIndent;

      const updated = typedCode.substring(0, start) + insertion + typedCode.substring(end);
      setTypedCode(updated);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + insertion.length;
        }
      });
      return;
    }
  };

  const handleCodeAreaClick = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="typing-container">
      {/* Top Test Navigation Bar */}
      <div className="test-toolbar">
        <div className="test-meta-tags">
          <span className="badge-tag">{languageName}</span>
          <span className={`diff-tag ${snippet.difficulty?.toLowerCase()}`}>
            {snippet.difficulty ? snippet.difficulty.charAt(0).toUpperCase() + snippet.difficulty.slice(1) : ''}
          </span>
          <span className="snippet-name-tag">{snippet.title}</span>
        </div>

        <div className={`countdown-clock ${timeLeft <= 10 ? 'urgent' : ''}`}>
          <span className="clock-digits">{formatTime(timeLeft)}</span>
        </div>

        <div className="test-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRestart} title="Restart test">
            &#x21BB; Restart
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} title="Change settings">
            Settings
          </button>
        </div>
      </div>

      {/* Target Code Display Area */}
      <div className="editor-panel" onClick={handleCodeAreaClick} ref={codeDisplayRef}>
        <div className="editor-header">
          <div className="editor-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <span className="editor-status">
            {!hasStarted ? 'Start typing to begin...' : 'Keep typing...'}
          </span>
        </div>
        <pre className="editor-code">
          <code>
            {comparison.charStatuses.map((item, index) => {
              let displayChar = item.char;
              let isNewline = item.char === '\n';

              return (
                <span
                  key={index}
                  className={`char-node ${item.status} ${isNewline ? 'newline' : ''}`}
                >
                  {isNewline ? (item.status === 'current' || item.status === 'incorrect' ? '↵\n' : '\n') : displayChar}
                </span>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Hidden Textarea for Input Capture */}
      <div className="typing-input-area">
        <textarea
          id="code-typing-textarea"
          ref={textareaRef}
          className="editor-textarea"
          value={typedCode}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Click here and start typing the code snippet..."
          disabled={timeLeft === 0}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={3}
        />
      </div>

      {/* Live Metrics Gauge */}
      <div className="live-metrics-row">
        <div className="live-metric">
          <span className="live-val">{liveWpm}</span>
          <span className="live-lbl">WPM</span>
        </div>
        <div className="live-metric">
          <span className="live-val">{liveAccuracy}%</span>
          <span className="live-lbl">Accuracy</span>
        </div>
        <div className="live-metric">
          <span className="live-val text-green">{comparison.correctCount}</span>
          <span className="live-lbl">Correct</span>
        </div>
        <div className="live-metric">
          <span className="live-val text-red">{comparison.incorrectCount}</span>
          <span className="live-lbl">Errors</span>
        </div>
        <div className="live-metric">
          <span className="live-val">{comparison.totalTyped} / {targetCode.length}</span>
          <span className="live-lbl">Progress</span>
        </div>
      </div>
    </div>
  );
}

export default TypingTest;
