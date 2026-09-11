import React, { useState } from 'react';

export function RoomResults({
  room,
  results = [],
  currentUser,
  onLeaveRoom,
  onCreateNewRoom,
}) {
  const [showSnippetPreview, setShowSnippetPreview] = useState(false);

  const roomCode = room?.roomCode || '';
  const config = room?.config || {};
  const snippet = room?.snippet || {};
  const language = (snippet.language || config.language || 'javascript').toUpperCase();
  const difficulty = (snippet.difficulty || config.difficulty || 'medium').toUpperCase();

  // Sort results by rank ascending
  const sortedResults = [...(results && results.length > 0 ? results : room?.participants || [])].sort(
    (a, b) => (a.rank || 99) - (b.rank || 99)
  );

  // Identify winner (Rank 1)
  const winner = sortedResults.find((r) => r.rank === 1) || sortedResults[0];

  const handleCreateNew = () => {
    if (typeof onCreateNewRoom === 'function') {
      onCreateNewRoom();
    } else {
      window.location.hash = '/rooms';
    }
  };

  const handleReturnToHub = () => {
    if (typeof onLeaveRoom === 'function') {
      onLeaveRoom();
    } else {
      window.location.hash = '/rooms';
    }
  };

  return (
    <div className="room-results-container">
      {/* Header Bar */}
      <div className="results-header-bar">
        <div className="results-header-left">
          <span className="room-code-tag">ROOM: {roomCode}</span>
          <span className="race-badge-meta">{language}</span>
          <span className="race-badge-meta">{difficulty}</span>
          <span className="badge-match-completed">MATCH COMPLETED</span>
        </div>

        <div className="results-header-right">
          <button
            type="button"
            className="btn-leave-lobby"
            onClick={handleReturnToHub}
            title="Return to Rooms Hub"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Champion Spotlight Banner */}
      {winner && (
        <section className="winner-spotlight-card">
          <div className="winner-spotlight-inner">
            <div className="winner-badge-pill">
              <span className="crown-icon">👑</span>
              <span>1ST PLACE CHAMPION</span>
            </div>

            <div className="winner-identity-row">
              <div className="winner-avatar">
                {winner.profilePhoto ? (
                  <img src={winner.profilePhoto} alt="" className="avatar-img" />
                ) : (
                  (winner.username || 'W')[0].toUpperCase()
                )}
              </div>
              <div className="winner-details">
                <div className="winner-name-row">
                  <h2 className="winner-username">{winner.username}</h2>
                  {winner.userId === room?.hostId && <span className="badge-participant-host">HOST</span>}
                  {currentUser?.id && (winner.userId === currentUser.id || winner.userId === currentUser.id.toString()) && (
                    <span className="badge-participant-you">YOU</span>
                  )}
                </div>
                <p className="winner-tagline">Dominant finish with unmatched typing precision</p>
              </div>
            </div>

            <div className="winner-metrics-grid">
              <div className="winner-metric-cell">
                <span className="winner-metric-val">{winner.wpm || 0}</span>
                <span className="winner-metric-lbl">WPM</span>
              </div>
              <div className="winner-metric-cell">
                <span className="winner-metric-val">{winner.accuracy || 0}%</span>
                <span className="winner-metric-lbl">ACCURACY</span>
              </div>
              <div className="winner-metric-cell">
                <span className="winner-metric-val">{winner.completionTimeSeconds || winner.elapsedSeconds || 0}s</span>
                <span className="winner-metric-lbl">TIME</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Full Competition Leaderboard Table */}
      <section className="results-leaderboard-card">
        <div className="leaderboard-card-header">
          <h3 className="leaderboard-title">FINAL COMPETITION LEADERBOARD</h3>
          <span className="leaderboard-participant-count">{sortedResults.length} Competitors</span>
        </div>

        <div className="results-table-wrapper">
          <table className="results-leaderboard-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-racer">RACER</th>
                <th className="col-status">STATUS</th>
                <th className="col-speed">SPEED</th>
                <th className="col-accuracy">ACCURACY</th>
                <th className="col-time">TIME</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((racer, idx) => {
                const rankNum = racer.rank || idx + 1;
                const isHost = racer.userId === room?.hostId;
                const isYou =
                  currentUser?.id &&
                  (racer.userId === currentUser.id || racer.userId === currentUser.id.toString());
                const isCompleted = racer.completedSnippet || racer.status === 'finished';
                const isTimedOut = racer.status === 'timed_out';
                const isAbandoned = racer.status === 'abandoned';

                let rankBadgeClass = 'rank-muted';
                if (rankNum === 1) rankBadgeClass = 'rank-gold';
                else if (rankNum === 2) rankBadgeClass = 'rank-silver';
                else if (rankNum === 3) rankBadgeClass = 'rank-bronze';

                return (
                  <tr
                    key={racer.userId || racer.id || idx}
                    className={`results-table-row ${isYou ? 'result-row-you' : ''}`}
                  >
                    <td className="col-rank">
                      <span className={`rank-pill ${rankBadgeClass}`}>
                        {rankNum === 1 ? '1' : rankNum}
                      </span>
                    </td>
                    <td className="col-racer">
                      <div className="racer-cell-content">
                        <div className="racer-avatar-mini">
                          {racer.profilePhoto ? (
                            <img src={racer.profilePhoto} alt="" className="avatar-img" />
                          ) : (
                            (racer.username || 'P')[0].toUpperCase()
                          )}
                        </div>
                        <div className="racer-names-wrap">
                          <span className="racer-name-text">{racer.username}</span>
                          <div className="racer-badges-row">
                            {isHost && <span className="badge-participant-host">HOST</span>}
                            {isYou && <span className="badge-participant-you">YOU</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="col-status">
                      {isCompleted ? (
                        <span className="badge-finished">COMPLETED</span>
                      ) : isTimedOut ? (
                        <span className="badge-timed-out">TIMED OUT</span>
                      ) : isAbandoned ? (
                        <span className="badge-abandoned">LEFT</span>
                      ) : (
                        <span className="badge-incomplete">INCOMPLETE</span>
                      )}
                    </td>
                    <td className="col-speed">
                      <span className="metric-primary-text">{racer.wpm || 0}</span>
                      <span className="metric-unit-text"> WPM</span>
                    </td>
                    <td className="col-accuracy">
                      <span className="metric-primary-text">{racer.accuracy || 0}%</span>
                    </td>
                    <td className="col-time">
                      <span className="metric-primary-text">
                        {racer.completionTimeSeconds !== undefined
                          ? `${racer.completionTimeSeconds}s`
                          : racer.elapsedSeconds !== undefined
                          ? `${racer.elapsedSeconds}s`
                          : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Snippet Summary Card */}
      {snippet?.code && (
        <section className="snippet-summary-card">
          <div
            className="snippet-summary-header"
            onClick={() => setShowSnippetPreview((prev) => !prev)}
            style={{ cursor: 'pointer' }}
          >
            <div className="snippet-summary-title-wrap">
              <span className="snippet-summary-title">SNIPPET: {snippet.title || 'Code Snippet'}</span>
              <span className="snippet-length-badge">{snippet.code.length} chars</span>
            </div>
            <button type="button" className="btn-snippet-toggle">
              {showSnippetPreview ? 'Hide Snippet ▲' : 'View Snippet ▼'}
            </button>
          </div>

          {showSnippetPreview && (
            <div className="snippet-code-preview-box">
              <pre className="snippet-code-pre">
                <code>{snippet.code}</code>
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Action Navigation Buttons */}
      <div className="results-actions-bar">
        <button
          type="button"
          className="btn-primary btn-create-new-room"
          onClick={handleCreateNew}
        >
          Create New Room
        </button>
        <button
          type="button"
          className="btn-secondary btn-return-rooms"
          onClick={handleReturnToHub}
        >
          Return to Rooms Hub
        </button>
      </div>
    </div>
  );
}

export default RoomResults;
