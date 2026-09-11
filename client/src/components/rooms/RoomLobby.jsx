import React, { useState } from 'react';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, TIMER_OPTIONS } from '../../data/snippets';

export function RoomLobby({
  room,
  currentUser,
  isHost,
  onUpdateConfig,
  onStartCompetition,
  onLeaveRoom,
  error,
}) {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const roomCode = room?.roomCode || '';
  const config = room?.config || { language: 'javascript', difficulty: 'medium', timerSeconds: 60 };
  const participants = room?.participants || [];
  const status = room?.status || 'waiting';

  const handleCopyCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        // Fallback
        const el = document.createElement('textarea');
        el.value = roomCode;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silent fail
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLanguageChange = (e) => {
    if (!isHost || status !== 'waiting') return;
    onUpdateConfig?.({
      ...config,
      language: e.target.value,
    });
  };

  const handleDifficultyChange = (difficulty) => {
    if (!isHost || status !== 'waiting') return;
    onUpdateConfig?.({
      ...config,
      difficulty,
    });
  };

  const handleTimerChange = (timerSeconds) => {
    if (!isHost || status !== 'waiting') return;
    onUpdateConfig?.({
      ...config,
      timerSeconds: Number(timerSeconds),
    });
  };

  const handleStart = () => {
    if (!isHost || status !== 'waiting' || isStarting) return;
    setIsStarting(true);
    onStartCompetition?.();
    setTimeout(() => setIsStarting(false), 3000);
  };

  // Status-specific placeholder views for countdown, active, finished, cancelled
  if (status === 'cancelled') {
    return (
      <div className="room-lobby-container">
        <div className="rooms-error-container">
          <div className="rooms-hub-badge badge-danger">ROOM CANCELLED</div>
          <h2 className="rooms-error-title">Room {roomCode} Closed</h2>
          <p className="rooms-error-desc">This competition room was closed because all participants left or the host cancelled the match.</p>
          <button type="button" className="btn-secondary btn-back-rooms" onClick={onLeaveRoom}>
            Return to Rooms Hub
          </button>
        </div>
      </div>
    );
  }

  if (status === 'countdown') {
    return (
      <div className="room-lobby-container">
        <div className="room-transition-container">
          <div className="rooms-hub-badge badge-warning">STARTING COMPETITION</div>
          <h2 className="room-transition-title">Match Starting</h2>
          <p className="room-transition-desc">Synchronizing code challenge across all participants...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="room-lobby-container">
        <div className="room-transition-container">
          <div className="rooms-hub-badge">RACE IN PROGRESS</div>
          <h2 className="room-transition-title">Competition Active</h2>
          <p className="room-transition-desc">Race is currently active for Room {roomCode}.</p>
          <button type="button" className="btn-secondary btn-back-rooms" onClick={onLeaveRoom}>
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="room-lobby-container">
        <div className="room-transition-container">
          <div className="rooms-hub-badge badge-success">COMPETITION FINISHED</div>
          <h2 className="room-transition-title">Match Concluded</h2>
          <p className="room-transition-desc">All participants have completed the competition.</p>
          <button type="button" className="btn-secondary btn-back-rooms" onClick={onLeaveRoom}>
            Return to Rooms Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-lobby-container">
      {/* Top Header & Room Code Display */}
      <div className="lobby-header-bar">
        <div className="lobby-header-left">
          <span className="lobby-tag">LOBBY</span>
          <div className="room-code-wrapper">
            <span className="room-code-label">ROOM CODE</span>
            <div className="room-code-display">
              <span className="room-code-text">{roomCode}</span>
              <button
                type="button"
                className={`btn-copy-code ${copied ? 'copied' : ''}`}
                onClick={handleCopyCode}
                title="Copy Room Code"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="lobby-header-right">
          <button type="button" className="btn-leave-lobby" onClick={onLeaveRoom} title="Leave this room">
            Leave Room
          </button>
        </div>
      </div>

      {error && <div className="room-error-banner">{error}</div>}

      <div className="lobby-grid">
        {/* Left Column: Participant Roster */}
        <section className="lobby-card participants-card">
          <div className="card-header-row">
            <h2 className="card-title">
              Participants <span className="count-badge">{participants.length}</span>
            </h2>
            <span className="host-indicator">Host: <strong>{room?.hostUsername || 'Unknown'}</strong></span>
          </div>

          <div className="participants-list">
            {participants.map((p, idx) => {
              const isParticipantHost = p.userId === room?.hostId || p.username === room?.hostUsername;
              const isCurrent = currentUser?.id && p.userId === currentUser.id;

              return (
                <div key={p.userId || idx} className={`participant-item ${isCurrent ? 'current-user-item' : ''}`}>
                  <div className="participant-info">
                    <div className="participant-avatar">
                      {p.profilePhoto ? (
                        <img src={p.profilePhoto} alt="" className="avatar-img" />
                      ) : (
                        (p.username || 'P')[0].toUpperCase()
                      )}
                    </div>
                    <span className="participant-name">{p.username}</span>
                  </div>

                  <div className="participant-badges">
                    {isParticipantHost && <span className="badge-participant-host">HOST</span>}
                    {isCurrent && <span className="badge-participant-you">YOU</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Match Configuration & Controls */}
        <section className="lobby-card config-card">
          <div className="card-header-row">
            <h2 className="card-title">Match Configuration</h2>
            {isHost ? (
              <span className="config-edit-hint">Editable by you (Host)</span>
            ) : (
              <span className="config-edit-hint">Host controls settings</span>
            )}
          </div>

          <div className="config-controls-list">
            {/* Language Selection */}
            <div className="config-group">
              <label htmlFor={isHost && status === 'waiting' ? 'lobby-lang-select' : undefined} className="config-label">
                Language
              </label>
              {isHost && status === 'waiting' ? (
                <select
                  id="lobby-lang-select"
                  value={config.language}
                  onChange={handleLanguageChange}
                  className="room-select"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="config-readonly-badge">
                  {SUPPORTED_LANGUAGES.find((l) => l.id === config.language)?.name || config.language}
                </div>
              )}
            </div>

            {/* Difficulty Selection */}
            <div className="config-group">
              <label className="config-label">Difficulty</label>
              {isHost && status === 'waiting' ? (
                <div className="btn-group-pill">
                  {DIFFICULTY_LEVELS.map((diff) => (
                    <button
                      key={diff.id}
                      type="button"
                      className={`pill-btn ${config.difficulty === diff.id ? 'active' : ''}`}
                      onClick={() => handleDifficultyChange(diff.id)}
                    >
                      {diff.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="config-readonly-badge">
                  {DIFFICULTY_LEVELS.find((d) => d.id === config.difficulty)?.name || config.difficulty}
                </div>
              )}
            </div>

            {/* Timer Duration Selection */}
            <div className="config-group">
              <label className="config-label">Timer Duration</label>
              {isHost && status === 'waiting' ? (
                <div className="btn-group-pill">
                  {TIMER_OPTIONS.map((timer) => (
                    <button
                      key={timer.seconds}
                      type="button"
                      className={`pill-btn ${config.timerSeconds === timer.seconds ? 'active' : ''}`}
                      onClick={() => handleTimerChange(timer.seconds)}
                    >
                      {timer.seconds < 60 ? `${timer.seconds}s` : `${timer.seconds / 60}m`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="config-readonly-badge">
                  {config.timerSeconds < 60 ? `${config.timerSeconds} seconds` : `${config.timerSeconds / 60} minutes`}
                </div>
              )}
            </div>
          </div>

          {/* Action Area */}
          <div className="lobby-actions-area">
            {isHost ? (
              <button
                type="button"
                className="btn-primary btn-start-competition"
                onClick={handleStart}
                disabled={status !== 'waiting' || isStarting}
              >
                {isStarting ? 'Starting...' : 'Start Competition'}
              </button>
            ) : (
              <div className="waiting-host-notice">
                <span className="pulse-dot"></span>
                <span>Waiting for host (<strong>{room?.hostUsername}</strong>) to start the match...</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoomLobby;
