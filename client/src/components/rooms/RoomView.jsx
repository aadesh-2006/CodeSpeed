import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import socketService from '../../services/socket';
import RoomLobby from './RoomLobby';
import RoomRace from './RoomRace';
import RoomResults from './RoomResults';

export function RoomView({ roomCode, currentUser, onNavigateBack }) {
  const [room, setRoom] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cleanCode = (roomCode || '').toUpperCase().trim();

  // Determine if the current authenticated user is the room host
  const isHost = Boolean(
    currentUser?.id && room?.hostId && (room.hostId === currentUser.id || room.hostId === currentUser.id.toString())
  );

  // Helper to fetch competition results for finished room
  const fetchResults = useCallback((code) => {
    if (!code) return;
    api
      .getRoomResults(code)
      .then((res) => {
        if (res?.data?.results) {
          setResults(res.data.results);
        }
      })
      .catch((err) => {
        console.error('[RoomView] Failed to fetch room results:', err.message);
      });
  }, []);

  // Initialize room and Socket.IO listeners
  useEffect(() => {
    let isMounted = true;

    if (!cleanCode) {
      setError('Invalid room code.');
      setLoading(false);
      return;
    }

    const socket = socketService.connectSocket();

    // 1. Initial REST fetch for immediate hydration
    api
      .getRoom(cleanCode)
      .then((res) => {
        if (!isMounted) return;
        if (res?.data?.room) {
          setRoom(res.data.room);
          if (res.data.room.status === 'finished') {
            fetchResults(cleanCode);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || `Failed to connect to room '${cleanCode}'.`);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Define Socket event listeners
    const handleRoomState = (state) => {
      if (!isMounted) return;
      setRoom(state);
      setError(null);
    };

    const handleUserJoined = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants?.some((p) => p.userId === data.user?.userId);
        if (exists) return prev;
        const updatedParticipants = [...(prev.participants || []), data.user];
        return {
          ...prev,
          participants: updatedParticipants,
          participantCount: updatedParticipants.length,
        };
      });
    };

    const handleUserLeft = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedParticipants = (prev.participants || []).filter(
          (p) => p.userId !== data.userId
        );
        return {
          ...prev,
          hostId: data.newHost?.hostId || prev.hostId,
          hostUsername: data.newHost?.hostUsername || prev.hostUsername,
          participants: updatedParticipants,
          participantCount: updatedParticipants.length,
        };
      });
    };

    const handleConfigUpdated = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          config: data.config || prev.config,
          snippet: data.snippet || prev.snippet,
        };
      });
    };

    const handleCountdown = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'countdown',
          countdownStartsAt: data.countdownStartsAt,
          raceStartsAt: data.raceStartsAt,
          raceEndsAt: data.raceEndsAt,
          snippet: data.snippet || prev.snippet,
        };
      });
    };

    const handleRaceStarted = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'active',
          raceStartsAt: data.raceStartsAt,
          raceEndsAt: data.raceEndsAt,
          snippet: data.snippet || prev.snippet,
        };
      });
    };

    const handleProgressUpdate = (data) => {
      if (!isMounted || !data?.userId) return;
      setRoom((prev) => {
        if (!prev || !prev.participants) return prev;
        const updatedParticipants = prev.participants.map((p) => {
          if (p.userId === data.userId || p.userId.toString() === data.userId.toString()) {
            return {
              ...p,
              progressPercent: data.progressPercent !== undefined ? data.progressPercent : p.progressPercent,
              currentPosition: data.currentPosition !== undefined ? data.currentPosition : p.currentPosition,
              liveWpm: data.liveWpm !== undefined ? data.liveWpm : p.liveWpm,
            };
          }
          return p;
        });
        return {
          ...prev,
          participants: updatedParticipants,
        };
      });
    };

    const handleUserFinished = (data) => {
      if (!isMounted || !data?.userId) return;
      setRoom((prev) => {
        if (!prev || !prev.participants) return prev;
        const updatedParticipants = prev.participants.map((p) => {
          if (p.userId === data.userId || p.userId.toString() === data.userId.toString()) {
            return {
              ...p,
              status: 'finished',
              progressPercent: 100,
              wpm: data.wpm !== undefined ? data.wpm : p.wpm,
              accuracy: data.accuracy !== undefined ? data.accuracy : p.accuracy,
              elapsedSeconds: data.elapsedSeconds !== undefined ? data.elapsedSeconds : p.elapsedSeconds,
              completedSnippet: data.completedSnippet !== undefined ? data.completedSnippet : true,
            };
          }
          return p;
        });
        return {
          ...prev,
          participants: updatedParticipants,
        };
      });
    };

    const handleFinished = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'finished',
          ...(data.room || {}),
        };
      });
      fetchResults(cleanCode);
    };

    const handleCancelled = (data) => {
      if (!isMounted) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'cancelled',
        };
      });
      setError(data.message || 'Room was closed.');
    };

    const handleRoomError = (data) => {
      if (!isMounted) return;
      setError(data.message || 'An error occurred in this room.');
    };

    if (socket) {
      // Register listeners
      socket.on('room:state', handleRoomState);
      socket.on('room:user_joined', handleUserJoined);
      socket.on('room:user_left', handleUserLeft);
      socket.on('room:config_updated', handleConfigUpdated);
      socket.on('room:countdown', handleCountdown);
      socket.on('room:race_started', handleRaceStarted);
      socket.on('race:progress_update', handleProgressUpdate);
      socket.on('race:user_finished', handleUserFinished);
      socket.on('room:finished', handleFinished);
      socket.on('room:cancelled', handleCancelled);
      socket.on('room:error', handleRoomError);

      // Join socket room
      socket.emit('room:join', { code: cleanCode }, (resp) => {
        if (!isMounted) return;
        if (resp?.error) {
          setError(resp.error);
        } else if (resp?.room) {
          setRoom(resp.room);
          if (resp.room.status === 'finished') {
            fetchResults(cleanCode);
          }
        }
      });
    }

    // Cleanup: remove ONLY registered listeners on unmount
    return () => {
      isMounted = false;
      if (socket) {
        socket.off('room:state', handleRoomState);
        socket.off('room:user_joined', handleUserJoined);
        socket.off('room:user_left', handleUserLeft);
        socket.off('room:config_updated', handleConfigUpdated);
        socket.off('room:countdown', handleCountdown);
        socket.off('room:race_started', handleRaceStarted);
        socket.off('race:progress_update', handleProgressUpdate);
        socket.off('race:user_finished', handleUserFinished);
        socket.off('room:finished', handleFinished);
        socket.off('room:cancelled', handleCancelled);
        socket.off('room:error', handleRoomError);
      }
    };
  }, [cleanCode, fetchResults]);

  // Actions
  const handleUpdateConfig = useCallback(
    (newConfig) => {
      const socket = socketService.getSocket();
      if (!socket || !cleanCode) return;

      socket.emit('room:update_config', { code: cleanCode, config: newConfig }, (resp) => {
        if (resp?.error) {
          setError(resp.error);
        } else if (resp?.room) {
          setRoom(resp.room);
        }
      });
    },
    [cleanCode]
  );

  const handleStartCompetition = useCallback(() => {
    const socket = socketService.getSocket();
    if (!socket || !cleanCode) return;

    socket.emit('room:start', { code: cleanCode }, (resp) => {
      if (resp?.error) {
        setError(resp.error);
      }
    });
  }, [cleanCode]);

  const handleProgress = useCallback(
    (progressData) => {
      const socket = socketService.getSocket();
      if (!socket || !cleanCode) return;
      socket.emit('race:progress', {
        code: cleanCode,
        ...progressData,
      });
    },
    [cleanCode]
  );

  const handleSubmit = useCallback(
    (submissionData) => {
      const socket = socketService.getSocket();
      if (!socket || !cleanCode) return;
      socket.emit('race:submit', {
        code: cleanCode,
        ...submissionData,
      }, (resp) => {
        if (resp?.error) {
          setError(resp.error);
        }
      });
    },
    [cleanCode]
  );

  const handleLeaveRoom = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket && cleanCode) {
      socket.emit('room:leave', { code: cleanCode });
    }
    if (typeof onNavigateBack === 'function') {
      onNavigateBack();
    } else {
      window.location.hash = '/rooms';
    }
  }, [cleanCode, onNavigateBack]);

  if (loading && !room) {
    return (
      <div className="rooms-loading-container">
        <div className="loading-spinner"></div>
        <p className="rooms-loading-text">Connecting to Room {cleanCode}...</p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="rooms-error-container">
        <div className="rooms-hub-badge badge-danger">ROOM ERROR</div>
        <h2 className="rooms-error-title">Unable to Enter Room</h2>
        <p className="rooms-error-desc">{error}</p>
        <button type="button" className="btn-secondary btn-back-rooms" onClick={handleLeaveRoom}>
          Return to Rooms Hub
        </button>
      </div>
    );
  }

  // Render RoomResults when finished
  if (room?.status === 'finished') {
    return (
      <RoomResults
        room={room}
        results={results}
        currentUser={currentUser}
        onLeaveRoom={handleLeaveRoom}
        onCreateNewRoom={() => {
          if (typeof onNavigateBack === 'function') {
            onNavigateBack();
          } else {
            window.location.hash = '/rooms';
          }
        }}
      />
    );
  }

  // Render RoomRace when countdown or active
  if (room?.status === 'countdown' || room?.status === 'active') {
    return (
      <RoomRace
        room={room}
        currentUser={currentUser}
        onProgress={handleProgress}
        onSubmit={handleSubmit}
        onLeaveRoom={handleLeaveRoom}
        error={error}
      />
    );
  }

  return (
    <RoomLobby
      room={room}
      currentUser={currentUser}
      isHost={isHost}
      onUpdateConfig={handleUpdateConfig}
      onStartCompetition={handleStartCompetition}
      onLeaveRoom={handleLeaveRoom}
      error={error}
    />
  );
}

export default RoomView;

