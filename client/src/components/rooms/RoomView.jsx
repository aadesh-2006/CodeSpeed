import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import socketService from '../../services/socket';

/**
 * Foundation Room View container.
 * Prepares the socket connection and room verification for Milestone 3.
 */
export function RoomView({ roomCode, onNavigateBack }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!cleanCode) {
      setError('Invalid room code.');
      setLoading(false);
      return;
    }

    // Connect socket service
    const socket = socketService.connectSocket();

    // Verify room via REST
    api
      .getRoom(cleanCode)
      .then((res) => {
        if (!isMounted) return;
        if (res?.data?.room) {
          setRoom(res.data.room);
        } else {
          setError(`Room '${cleanCode}' not found.`);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || `Failed to load room '${cleanCode}'.`);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  if (loading) {
    return (
      <div className="rooms-loading-container">
        <div className="loading-spinner"></div>
        <p className="rooms-loading-text">Connecting to Room {roomCode}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rooms-error-container">
        <div className="rooms-hub-badge">ROOM ERROR</div>
        <h2 className="rooms-error-title">Unable to Join Room</h2>
        <p className="rooms-error-desc">{error}</p>
        <button
          type="button"
          className="btn-secondary btn-back-rooms"
          onClick={() => {
            if (typeof onNavigateBack === 'function') {
              onNavigateBack();
            } else {
              window.location.hash = '/rooms';
            }
          }}
        >
          Return to Rooms Hub
        </button>
      </div>
    );
  }

  return (
    <div className="room-view-foundation">
      <div className="room-foundation-card">
        <div className="rooms-hub-badge">ROOM READY</div>
        <h2 className="room-foundation-code">Room Code: {roomCode}</h2>
        <p className="room-foundation-desc">
          Connected as participant. Ready for synchronized lobby in Milestone 3.
        </p>
        <div className="room-foundation-meta">
          <span className="badge-meta">Language: {room?.config?.language || 'JavaScript'}</span>
          <span className="badge-meta">Difficulty: {room?.config?.difficulty || 'Medium'}</span>
          <span className="badge-meta">Timer: {room?.config?.timerSeconds || 60}s</span>
          <span className="badge-meta">Host: {room?.hostUsername || 'Host'}</span>
        </div>
        <button
          type="button"
          className="btn-secondary btn-back-rooms"
          onClick={() => {
            if (typeof onNavigateBack === 'function') {
              onNavigateBack();
            } else {
              window.location.hash = '/rooms';
            }
          }}
        >
          Back to Rooms Hub
        </button>
      </div>
    </div>
  );
}

export default RoomView;
