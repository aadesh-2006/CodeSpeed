import React, { useState } from 'react';
import { api } from '../../services/api';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, TIMER_OPTIONS } from '../../data/snippets';

export function RoomsHub({ onNavigateToRoom }) {
  // Create Room state
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Join Room state
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await api.createRoom({
        language: selectedLanguage,
        difficulty: selectedDifficulty,
        timerSeconds: Number(selectedDuration),
      });

      if (response?.data?.room?.roomCode) {
        const roomCode = response.data.room.roomCode;
        if (typeof onNavigateToRoom === 'function') {
          onNavigateToRoom(roomCode);
        } else {
          window.location.hash = `/room/${roomCode}`;
        }
      } else {
        throw new Error('Room created, but no room code was returned.');
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create competition room.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setJoinError(null);
    const cleanCode = (joinCode || '').toUpperCase().trim();

    if (!cleanCode) {
      setJoinError('Please enter a 6-character room code.');
      return;
    }

    if (cleanCode.length !== 6) {
      setJoinError('Room codes are exactly 6 characters long.');
      return;
    }

    setIsJoining(true);

    try {
      const response = await api.getRoom(cleanCode);
      if (response?.data?.room) {
        if (response.data.room.status === 'cancelled') {
          setJoinError(`Room '${cleanCode}' was cancelled or closed.`);
          return;
        }
        if (typeof onNavigateToRoom === 'function') {
          onNavigateToRoom(cleanCode);
        } else {
          window.location.hash = `/room/${cleanCode}`;
        }
      } else {
        setJoinError(`Room '${cleanCode}' not found.`);
      }
    } catch (err) {
      setJoinError(err.message || `Room '${cleanCode}' not found.`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="rooms-hub-container">
      {/* Header */}
      <div className="rooms-hub-header">
        <div className="rooms-hub-badge">MULTIPLAYER COMPETITION</div>
        <h1 className="rooms-hub-title">Competition Rooms</h1>
        <p className="rooms-hub-subtitle">
          Create or join a synchronized real-time coding race. All participants type the exact same challenge.
        </p>
      </div>

      <div className="rooms-hub-grid">
        {/* Create Room Panel */}
        <section className="rooms-hub-card create-room-card">
          <div className="card-header">
            <h2 className="card-title">Create a Room</h2>
            <p className="card-desc">Configure match rules and invite participants with a room code.</p>
          </div>

          <form onSubmit={handleCreateRoom} className="create-room-form">
            {/* Language Selector */}
            <div className="form-group">
              <label htmlFor="room-language" className="form-label">
                Programming Language
              </label>
              <select
                id="room-language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="room-select"
                disabled={isCreating}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Selector */}
            <div className="form-group">
              <label className="form-label">Difficulty Level</label>
              <div className="btn-group-pill">
                {DIFFICULTY_LEVELS.map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    className={`pill-btn ${selectedDifficulty === diff.id ? 'active' : ''}`}
                    onClick={() => setSelectedDifficulty(diff.id)}
                    disabled={isCreating}
                  >
                    {diff.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Duration Selector */}
            <div className="form-group">
              <label className="form-label">Timer Duration</label>
              <div className="btn-group-pill">
                {TIMER_OPTIONS.slice(0, 6).map((timer) => (
                  <button
                    key={timer.seconds}
                    type="button"
                    className={`pill-btn ${selectedDuration === timer.seconds ? 'active' : ''}`}
                    onClick={() => setSelectedDuration(timer.seconds)}
                    disabled={isCreating}
                  >
                    {timer.seconds < 60 ? `${timer.seconds}s` : `${timer.seconds / 60}m`}
                  </button>
                ))}
              </div>
            </div>

            {createError && <div className="room-error-banner">{createError}</div>}

            <button type="submit" className="btn-primary btn-create-room" disabled={isCreating}>
              {isCreating ? 'Creating Room...' : 'Create Competition Room'}
            </button>
          </form>
        </section>

        {/* Join Room Panel */}
        <section className="rooms-hub-card join-room-card">
          <div className="card-header">
            <h2 className="card-title">Join Existing Room</h2>
            <p className="card-desc">Enter a 6-character room code from your host.</p>
          </div>

          <form onSubmit={handleJoinRoom} className="join-room-form">
            <div className="form-group">
              <label htmlFor="room-code-input" className="form-label">
                Room Code
              </label>
              <input
                id="room-code-input"
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinError(null);
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6));
                }}
                placeholder="e.g. 7K2M9X"
                maxLength={6}
                className="room-code-input"
                autoComplete="off"
                spellCheck="false"
                disabled={isJoining}
              />
            </div>

            {joinError && <div className="room-error-banner">{joinError}</div>}

            <button
              type="submit"
              className="btn-secondary btn-join-room"
              disabled={isJoining || joinCode.trim().length === 0}
            >
              {isJoining ? 'Joining...' : 'Enter Room'}
            </button>
          </form>

          <div className="join-info-box">
            <h3 className="join-info-title">How It Works</h3>
            <ul className="join-info-list">
              <li>Hosts select language, difficulty, and timer.</li>
              <li>All participants receive the exact same code snippet.</li>
              <li>A synchronized 3-2-1 countdown starts the race.</li>
              <li>Leaderboard ranks live speed, accuracy, and completion.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoomsHub;
