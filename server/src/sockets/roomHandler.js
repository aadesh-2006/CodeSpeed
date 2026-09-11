import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import roomManager from '../services/roomManager.js';

/**
 * Initialize Socket.IO server with JWT authentication and competition room event handlers.
 *
 * @param {import('socket.io').Server} io
 */
export function setupRoomSocket(io) {
  // 1. Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!authHeader) {
        return next(new Error('Authentication required. No token provided.'));
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return next(new Error('Internal server configuration error.'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (err) {
        return next(new Error('Invalid or expired authentication token.'));
      }

      if (!decoded || !decoded.id) {
        return next(new Error('Invalid token payload.'));
      }

      const user = await User.findById(decoded.id).select('username profilePhoto');
      if (!user) {
        return next(new Error('User not found.'));
      }

      socket.user = {
        id: user._id.toString(),
        username: user.username,
        profilePhoto: user.profilePhoto || null,
      };

      next();
    } catch (error) {
      console.error('[Socket Auth] Authentication error:', error.message);
      next(new Error('Server error during socket authentication.'));
    }
  });

  // 2. Connection Handler
  io.on('connection', (socket) => {
    const user = socket.user;

    // --- Event: Join Room ---
    socket.on('room:join', async (data, callback) => {
      try {
        const { code } = data || {};
        if (!code) {
          if (typeof callback === 'function') callback({ error: 'Room code is required.' });
          return;
        }

        const roomCode = String(code).toUpperCase().trim();
        const { room, isNewParticipant } = await roomManager.joinRoom({
          roomCode,
          user: {
            userId: user.id,
            username: user.username,
            profilePhoto: user.profilePhoto,
          },
          socketId: socket.id,
        });

        socket.join(`room:${roomCode}`);

        // Notify caller with full room state
        if (typeof callback === 'function') {
          callback({ success: true, room });
        }
        socket.emit('room:state', room);

        // Notify other room participants if newly joined
        if (isNewParticipant) {
          socket.to(`room:${roomCode}`).emit('room:user_joined', {
            user: {
              userId: user.id,
              username: user.username,
              profilePhoto: user.profilePhoto,
            },
            participantCount: room.participantCount,
          });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- Event: Leave Room ---
    socket.on('room:leave', async (data, callback) => {
      try {
        const { code } = data || {};
        if (!code) return;

        const roomCode = String(code).toUpperCase().trim();
        const result = await roomManager.leaveRoom({
          roomCode,
          userId: user.id,
          socketId: socket.id,
        });

        socket.leave(`room:${roomCode}`);

        if (typeof callback === 'function') {
          callback({ success: true });
        }

        if (result?.cancelled) {
          io.to(`room:${roomCode}`).emit('room:cancelled', {
            message: 'Room was closed as all participants left.',
          });
        } else if (result?.left && result?.room) {
          io.to(`room:${roomCode}`).emit('room:user_left', {
            userId: user.id,
            username: user.username,
            newHost: result.newHost,
            room: result.room,
          });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // --- Event: Update Config (Host Only, Waiting Only) ---
    socket.on('room:update_config', async (data, callback) => {
      try {
        const { code, config } = data || {};
        if (!code) return;

        const roomCode = String(code).toUpperCase().trim();
        const updatedRoom = await roomManager.updateConfig({
          roomCode,
          userId: user.id,
          config,
        });

        if (typeof callback === 'function') {
          callback({ success: true, room: updatedRoom });
        }

        io.to(`room:${roomCode}`).emit('room:config_updated', {
          config: updatedRoom.config,
          snippet: updatedRoom.snippet,
          room: updatedRoom,
        });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- Event: Start Competition (Host Only) ---
    socket.on('room:start', async (data, callback) => {
      try {
        const { code } = data || {};
        if (!code) return;

        const roomCode = String(code).toUpperCase().trim();

        const roomState = await roomManager.startRoom({
          roomCode,
          userId: user.id,
          onActive: (activeRoom) => {
            io.to(`room:${roomCode}`).emit('room:race_started', {
              raceStartsAt: activeRoom.raceStartsAt,
              raceEndsAt: activeRoom.raceEndsAt,
              snippet: activeRoom.snippet,
              room: activeRoom,
            });
          },
          onFinished: (finishedRoom) => {
            io.to(`room:${roomCode}`).emit('room:finished', {
              room: finishedRoom,
            });
          },
        });

        if (typeof callback === 'function') {
          callback({ success: true, room: roomState });
        }

        // Broadcast countdown immediately
        io.to(`room:${roomCode}`).emit('room:countdown', {
          countdownStartsAt: roomState.countdownStartsAt,
          raceStartsAt: roomState.raceStartsAt,
          raceEndsAt: roomState.raceEndsAt,
          countdownSeconds: 3,
          snippet: roomState.snippet,
          room: roomState,
        });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- Event: Live Race Progress ---
    socket.on('race:progress', (data) => {
      const { code, progressPercent, currentPosition, liveWpm } = data || {};
      if (!code) return;

      const roomCode = String(code).toUpperCase().trim();
      const progress = roomManager.updateProgress({
        roomCode,
        userId: user.id,
        progressPercent,
        currentPosition,
        liveWpm,
      });

      if (progress) {
        socket.to(`room:${roomCode}`).emit('race:progress_update', progress);
      }
    });

    // --- Event: Submit Result ---
    socket.on('race:submit', async (data, callback) => {
      try {
        const { code, correctChars, incorrectChars, completedSnippet } = data || {};
        if (!code) return;

        const roomCode = String(code).toUpperCase().trim();

        const result = await roomManager.submitResult({
          roomCode,
          userId: user.id,
          submission: { correctChars, incorrectChars, completedSnippet },
          onFinished: (finishedRoom) => {
            io.to(`room:${roomCode}`).emit('room:finished', {
              room: finishedRoom,
            });
          },
        });

        if (typeof callback === 'function') {
          callback({ success: true, participant: result.participant, allFinished: result.allFinished });
        }

        // Broadcast individual participant finish
        io.to(`room:${roomCode}`).emit('race:user_finished', {
          userId: user.id,
          username: user.username,
          rank: result.participant.rank,
          wpm: result.participant.wpm,
          accuracy: result.participant.accuracy,
          elapsedSeconds: result.participant.elapsedSeconds,
          completedSnippet: result.participant.completedSnippet,
        });

        if (result.allFinished) {
          io.to(`room:${roomCode}`).emit('room:finished', {
            room: result.room,
          });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- Event: Disconnect ---
    socket.on('disconnect', async () => {
      try {
        const result = await roomManager.handleSocketDisconnect(socket.id);
        if (result && result.roomCode) {
          const roomCode = result.roomCode;
          if (result.cancelled) {
            io.to(`room:${roomCode}`).emit('room:cancelled', {
              message: 'Room was closed as all participants left.',
            });
          } else if (result.left && result.room) {
            io.to(`room:${roomCode}`).emit('room:user_left', {
              userId: user.id,
              username: user.username,
              newHost: result.newHost,
              room: result.room,
            });
          }
        }
      } catch (err) {
        console.error('[Socket Disconnect] Error handling socket disconnect:', err.message);
      }
    });
  });

  return io;
}

export default setupRoomSocket;
