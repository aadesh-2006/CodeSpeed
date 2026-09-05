import React, { useState, useEffect, useRef } from 'react';
import {
  calculateWPM,
  calculateAccuracy,
  formatTime,
  compareCharacters,
  getNextLineIndent,
} from '../utils/typingMetrics';

export function TypingTest({ snippet, duration = 60, language = 'javascript', onFinish, onCancel, onRestart }) {
  const [typedCode, setTypedCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const textareaRef = useRef(null);
  const timerRef = useRef(null);
  const codeDisplayRef = useRef(null);

  const targetCode = snippet?.code || '';
  const snippetLanguage = snippet?.language || language;

  // Focus textarea on mount and reset state
  useEffect(() => {
    setTypedCode('');
    setTimeLeft(duration);
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
  }, [snippet, duration]);

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
  const comparison = compareCharacters(targetCode, typedCode, { language: snippetLanguage });
  const liveCorrect = comparison.meaningfulCorrectCount !== undefined
    ? comparison.meaningfulCorrectCount
    : comparison.correctCount;
  const liveWpm = calculateWPM(liveCorrect, elapsedSeconds);
  const liveAccuracy = calculateAccuracy(liveCorrect, liveCorrect + comparison.incorrectCount);

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
    const finalElapsed = Math.max(1, elapsedSeconds || duration - timeLeft);
    const meaningfulCorrect = comparison.meaningfulCorrectCount !== undefined
      ? comparison.meaningfulCorrectCount
      : comparison.correctCount;
    const finalWpm = calculateWPM(meaningfulCorrect, finalElapsed);
    const finalAccuracy = calculateAccuracy(
      meaningfulCorrect,
      meaningfulCorrect + comparison.incorrectCount
    );

    if (onFinish) {
      onFinish({
        wpm: finalWpm,
        accuracy: finalAccuracy,
        correctChars: meaningfulCorrect,
        incorrectChars: comparison.incorrectCount,
        totalTyped: meaningfulCorrect + comparison.incorrectCount,
        elapsedSeconds: finalElapsed,
        timeElapsedSeconds: finalElapsed,
        timeElapsedFormatted: formatTime(finalElapsed),
        language: snippetLanguage,
        difficulty: snippet?.difficulty || 'medium',
        timerSeconds: duration,
        snippetId: snippet?.id,
        snippetTitle: snippet?.title,
      });
    }
  };

  const handleInputChange = (e) => {
    if (timeLeft === 0) return;
    if (!hasStarted) {
      setHasStarted(true);
    }
    setTypedCode(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (timeLeft === 0) return;

    if (!hasStarted) {
      setHasStarted(true);
    }

    // Smart Tab indentation: insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const cursorPosition = e.target.selectionStart;
      const newTyped = typedCode.slice(0, cursorPosition) + '  ' + typedCode.slice(cursorPosition);
      setTypedCode(newTyped);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = cursorPosition + 2;
          textareaRef.current.selectionEnd = cursorPosition + 2;
        }
      }, 0);
      return;
    }

    // Smart Enter auto-indentation based on language syntax
    if (e.key === 'Enter') {
      e.preventDefault();
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = typedCode.slice(0, cursorPosition);
      const textAfterCursor = typedCode.slice(cursorPosition);

      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const targetLines = targetCode.split('\n');
      const expectedLine = targetLines[lines.length - 1] || '';

      const indentation = getNextLineIndent(currentLine, expectedLine, snippetLanguage);
      const newTyped = textBeforeCursor + '\n' + indentation + textAfterCursor;
      const newCursorPos = cursorPosition + 1 + indentation.length;

      setTypedCode(newTyped);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    }
  };

  // Clicking on code display redirects focus to hidden textarea
  const handleCodeAreaClick = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="typing-test-container">
      {/* Test Control Header */}
      <div className="test-header">
        <div className="test-timer-badge">
          <span className="timer-icon">&#x23F1;</span>
          <span className={`timer-value ${timeLeft <= 10 && hasStarted ? 'timer-critical' : ''}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="test-meta">
          <span className="badge badge-blue">{snippetLanguage}</span>
          {snippet?.difficulty && (
            <span className={`badge badge-${snippet.difficulty}`}>{snippet.difficulty}</span>
          )}
          <span className="badge badge-neutral">{snippet?.title || 'Code Snippet'}</span>
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
