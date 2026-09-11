import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  calculateWPM,
  calculateAccuracy,
  formatTime,
  compareCharacters,
  getNextLineIndent,
} from '../../utils/typingMetrics';
import {
  getSoundEnabled,
  toggleSound,
  getSoundVolume,
  setSoundVolume,
  initAudio,
  playKeySound,
} from '../../utils/keyboardSound';

export function RoomRace({
  room,
  currentUser,
  onProgress,
  onSubmit,
  onLeaveRoom,
  error,
}) {
  const [typedCode, setTypedCode] = useState('');
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled);
  const [soundVolume, setSoundVolumeState] = useState(getSoundVolume);
  const [isFinished, setIsFinished] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  const textareaRef = useRef(null);
  const codeDisplayRef = useRef(null);
  const lastProgressSentRef = useRef(0);
  const hasSubmittedRef = useRef(false);

  const targetCode = room?.snippet?.code || '';
  const snippetLanguage = room?.snippet?.language || room?.config?.language || 'javascript';
  const roomCode = room?.roomCode || '';
  const participants = room?.participants || [];

  const raceStartMs = room?.raceStartsAt ? new Date(room.raceStartsAt).getTime() : Date.now();
  const raceEndMs = room?.raceEndsAt ? new Date(room.raceEndsAt).getTime() : raceStartMs + (room?.config?.timerSeconds || 60) * 1000;

  // High-frequency clock tick (every 100ms) for deterministic countdown and timer synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const isCountdown = nowTime < raceStartMs && room?.status !== 'active' && room?.status !== 'finished';
  const countdownRemaining = isCountdown ? Math.max(0, Math.ceil((raceStartMs - nowTime) / 1000)) : 0;
  const isRaceActive = !isCountdown && nowTime < raceEndMs && room?.status !== 'finished';
  const raceSecondsLeft = Math.max(0, Math.ceil((raceEndMs - nowTime) / 1000));
  const isRaceExpired = nowTime >= raceEndMs || room?.status === 'finished';

  // Check if current user is already finished
  const currentParticipant = participants.find(
    (p) =>
      (currentUser?.id && (p.userId === currentUser.id || p.userId?.toString() === currentUser.id.toString())) ||
      (currentUser?._id && (p.userId === currentUser._id || p.userId?.toString() === currentUser._id.toString())) ||
      (currentUser?.username && p.username && currentUser.username.toLowerCase() === p.username.toLowerCase())
  );
  const isCurrentUserFinished = isFinished || currentParticipant?.status === 'finished';

  // Character comparison
  const comparison = compareCharacters(targetCode, typedCode, { language: snippetLanguage });
  const liveCorrect = comparison.meaningfulCorrectCount !== undefined
    ? comparison.meaningfulCorrectCount
    : comparison.correctCount;
  const elapsedSinceStart = Math.max(1, Math.floor((nowTime - raceStartMs) / 1000));
  const liveWpm = isRaceActive ? calculateWPM(liveCorrect, elapsedSinceStart) : (currentParticipant?.wpm || 0);
  const liveAccuracy = calculateAccuracy(liveCorrect, liveCorrect + comparison.incorrectCount);
  const progressPercent = targetCode.length > 0
    ? Math.min(100, Math.round((comparison.currentPosition / targetCode.length) * 100))
    : 0;

  // Focus textarea when race becomes active
  useEffect(() => {
    if (isRaceActive && !isCurrentUserFinished && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isRaceActive, isCurrentUserFinished]);

  // Throttled live progress broadcasting (at most once every 200ms)
  const sendThrottledProgress = useCallback(
    (currProgress, currPos, currWpm, currAccuracy, currCorrect, currIncorrect, currTypedCode) => {
      const now = Date.now();
      if (now - lastProgressSentRef.current >= 200 || currProgress === 100) {
        lastProgressSentRef.current = now;
        onProgress?.({
          progressPercent: currProgress,
          currentPosition: currPos,
          liveWpm: currWpm,
          accuracy: currAccuracy,
          correctChars: currCorrect,
          incorrectChars: currIncorrect,
          typedCode: currTypedCode,
        });
      }
    },
    [onProgress]
  );

  // Handle snippet completion
  useEffect(() => {
    if (isRaceActive && comparison.isComplete && !hasSubmittedRef.current && !isCurrentUserFinished) {
      hasSubmittedRef.current = true;
      setIsFinished(true);

      // Send 100% progress update
      onProgress?.({
        progressPercent: 100,
        currentPosition: targetCode.length,
        liveWpm,
        accuracy: liveAccuracy,
        correctChars: liveCorrect,
        incorrectChars: comparison.incorrectCount,
        typedCode,
      });

      // Submit final result to server
      onSubmit?.({
        typedCode,
        correctChars: liveCorrect,
        incorrectChars: comparison.incorrectCount,
        completedSnippet: true,
      });
    }
  }, [
    isRaceActive,
    comparison.isComplete,
    isCurrentUserFinished,
    liveCorrect,
    liveAccuracy,
    comparison.incorrectCount,
    liveWpm,
    targetCode.length,
    typedCode,
    onProgress,
    onSubmit,
  ]);

  // Handle timer expiration
  useEffect(() => {
    if (isRaceExpired && !hasSubmittedRef.current && !isCurrentUserFinished) {
      hasSubmittedRef.current = true;
      setIsFinished(true);

      onSubmit?.({
        typedCode,
        correctChars: liveCorrect,
        incorrectChars: comparison.incorrectCount,
        completedSnippet: false,
      });
    }
  }, [isRaceExpired, isCurrentUserFinished, liveCorrect, comparison.incorrectCount, typedCode, onSubmit]);

  const handleInputChange = (e) => {
    if (!isRaceActive || isCurrentUserFinished) return;
    const value = e.target.value;
    setTypedCode(value);

    const comp = compareCharacters(targetCode, value, { language: snippetLanguage });
    const correct = comp.meaningfulCorrectCount !== undefined ? comp.meaningfulCorrectCount : comp.correctCount;
    const wpm = calculateWPM(correct, elapsedSinceStart);
    const accuracy = calculateAccuracy(correct, correct + comp.incorrectCount);
    const pct = targetCode.length > 0 ? Math.min(100, Math.round((comp.currentPosition / targetCode.length) * 100)) : 0;

    sendThrottledProgress(pct, comp.currentPosition, wpm, accuracy, correct, comp.incorrectCount, value);
  };

  const handleKeyDown = (e) => {
    if (!isRaceActive || isCurrentUserFinished) return;

    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter' || e.key === 'Tab')
    ) {
      playKeySound(e.key);
    }

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

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndent = getNextLineIndent(targetCode, typedCode, snippetLanguage);
      const cursorPosition = e.target.selectionStart;
      const newTyped = typedCode.slice(0, cursorPosition) + '\n' + nextIndent + typedCode.slice(cursorPosition);
      setTypedCode(newTyped);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = cursorPosition + 1 + nextIndent.length;
          textareaRef.current.selectionEnd = cursorPosition + 1 + nextIndent.length;
        }
      }, 0);
    }
  };

  const handleToggleSound = () => {
    const nextState = toggleSound();
    setSoundEnabledState(nextState);
    if (nextState) {
      initAudio().catch(() => {});
    }
  };

  const handleVolumeChange = (e) => {
    const nextVal = parseInt(e.target.value, 10);
    const clamped = setSoundVolume(nextVal);
    setSoundVolumeState(clamped);
    initAudio().catch(() => {});
  };

  return (
    <div className="room-race-container">
      {/* Header Bar */}
      <div className="race-header-bar">
        <div className="race-header-left">
          <span className="room-code-tag">ROOM: {roomCode}</span>
          <span className="race-badge-meta">{snippetLanguage.toUpperCase()}</span>
          <span className="race-badge-meta">{(room?.config?.difficulty || 'medium').toUpperCase()}</span>
        </div>

        <div className="race-header-center">
          {isCountdown ? (
            <div className="race-timer-countdown-label">STARTING IN {countdownRemaining}s</div>
          ) : (
            <div className={`race-timer-display ${raceSecondsLeft <= 10 ? 'timer-critical' : ''}`}>
              {formatTime(raceSecondsLeft)}
            </div>
          )}
        </div>

        <div className="race-header-right">
          <div className="sound-toggle-group">
            <button
              type="button"
              className={`sound-toggle-btn ${soundEnabled ? 'active' : ''}`}
              onClick={handleToggleSound}
              title={soundEnabled ? 'Disable Keyboard Sound' : 'Enable Keyboard Sound'}
            >
              {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
            </button>
            {soundEnabled && (
              <input
                type="range"
                min="0"
                max="100"
                value={soundVolume}
                onChange={handleVolumeChange}
                className="volume-slider"
                title={`Volume: ${soundVolume}%`}
              />
            )}
          </div>
          <button type="button" className="btn-leave-lobby" onClick={onLeaveRoom} title="Leave competition">
            Leave
          </button>
        </div>
      </div>

      {error && <div className="room-error-banner">{error}</div>}

      {/* Competitors Live Track Panel */}
      <section className="competitors-track-panel">
        <div className="competitors-header">
          <span className="competitors-title">LIVE COMPETITION TRACK</span>
          <span className="competitors-count">{participants.length} Racers</span>
        </div>

        <div className="competitors-list">
          {participants.map((p, idx) => {
            const isHost = p.userId === room?.hostId;
            const isYou = Boolean(
              (currentUser?.id && (p.userId === currentUser.id || p.userId?.toString() === currentUser.id.toString())) ||
              (currentUser?._id && (p.userId === currentUser._id || p.userId?.toString() === currentUser._id.toString())) ||
              (currentUser?.username && p.username && currentUser.username.toLowerCase() === p.username.toLowerCase())
            );
            const pProgress = isYou ? progressPercent : (p.progressPercent || 0);
            const pWpm = isYou ? liveWpm : (p.liveWpm || p.wpm || 0);
            const pStatus = p.status || 'joined';

            return (
              <div key={p.userId || idx} className={`competitor-row ${isYou ? 'competitor-you' : ''}`}>
                <div className="competitor-identity">
                  <div className="competitor-avatar">
                    {p.profilePhoto ? (
                      <img src={p.profilePhoto} alt="" className="avatar-img" />
                    ) : (
                      (p.username || 'P')[0].toUpperCase()
                    )}
                  </div>
                  <div className="competitor-names">
                    <span className="competitor-username">{p.username}</span>
                    <div className="competitor-badges-inline">
                      {isHost && <span className="badge-participant-host">HOST</span>}
                      {isYou && <span className="badge-participant-you">YOU</span>}
                    </div>
                  </div>
                </div>

                <div className="competitor-progress-wrap">
                  <div className="competitor-progress-bar-bg">
                    <div
                      className={`competitor-progress-bar-fill ${pStatus === 'finished' ? 'bar-finished' : ''}`}
                      style={{ width: `${Math.max(2, pProgress)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="competitor-stats-box">
                  {pStatus === 'finished' ? (
                    <span className="badge-finished">COMPLETED</span>
                  ) : pStatus === 'timed_out' ? (
                    <span className="badge-timed-out">TIMED OUT</span>
                  ) : pStatus === 'abandoned' ? (
                    <span className="badge-abandoned">LEFT</span>
                  ) : (
                    <div className="competitor-live-stats">
                      <span className="stat-pct">{pProgress}%</span>
                      <span className="stat-wpm">{pWpm} WPM</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Synchronized Countdown Overlay */}
      {isCountdown && (
        <div className="countdown-overlay-modal">
          <div className="countdown-number-box">
            <span className="countdown-number">{countdownRemaining > 0 ? countdownRemaining : 'GO!'}</span>
            <span className="countdown-subtext">GET READY TO RACE</span>
          </div>
        </div>
      )}

      {/* Finished Banner */}
      {isCurrentUserFinished && (
        <div className="finished-notice-bar">
          <span className="finished-check-icon">✓</span>
          <div className="finished-text-wrap">
            <strong>Snippet Complete!</strong>
            <span>You finished in {currentParticipant?.elapsedSeconds || elapsedSinceStart}s ({currentParticipant?.wpm || liveWpm} WPM). Waiting for race to conclude...</span>
          </div>
        </div>
      )}

      {/* Code Editor Panel */}
      <section
        className={`race-editor-panel ${isCountdown ? 'editor-locked' : ''}`}
        onClick={() => textareaRef.current?.focus()}
      >
        <textarea
          ref={textareaRef}
          value={typedCode}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="typing-input-area"
          autoFocus={isRaceActive}
          disabled={isCountdown || isCurrentUserFinished}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Code typing input"
        />

        <div className="editor-code" ref={codeDisplayRef}>
          {comparison.charStatuses.map((charNode, idx) => {
            if (!charNode) return null;
            let displayChar = charNode.char;
            if (displayChar === '\n') {
              displayChar = '↵\n';
            }
            return (
              <span
                key={idx}
                className={`char-node ${charNode.status} ${charNode.isOptional ? 'optional-space' : ''}`}
              >
                {displayChar}
              </span>
            );
          })}
        </div>
      </section>

      {/* Live Metrics Row */}
      <div className="live-metrics-row">
        <div className="live-metric">
          <span className="live-val">{liveWpm}</span>
          <span className="live-lbl">SPEED</span>
        </div>
        <div className="live-metric">
          <span className="live-val">{liveAccuracy}%</span>
          <span className="live-lbl">ACCURACY</span>
        </div>
        <div className="live-metric">
          <span className="live-val">{progressPercent}%</span>
          <span className="live-lbl">PROGRESS</span>
        </div>
        <div className="live-metric">
          <span className="live-val">{formatTime(raceSecondsLeft)}</span>
          <span className="live-lbl">TIME LEFT</span>
        </div>
      </div>
    </div>
  );
}

export default RoomRace;
