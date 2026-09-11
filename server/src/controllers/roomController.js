import roomManager from '../services/roomManager.js';
import CompetitionRoom from '../models/CompetitionRoom.js';
import CompetitionResult from '../models/CompetitionResult.js';

/**
 * REST controller to create a competition room.
 * POST /api/rooms
 */
export const createRoom = async (req, res) => {
  try {
    const userId = req.user?.id;
    const username = req.user?.username;
    if (!userId || !username) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const { language, difficulty, timerSeconds } = req.body || {};

    const roomState = await roomManager.createRoom({
      host: {
        userId,
        username,
        profilePhoto: req.user?.profilePhoto || null,
      },
      config: {
        language,
        difficulty,
        timerSeconds,
      },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        room: roomState,
      },
    });
  } catch (error) {
    console.error('[Room Controller] Error creating room:', error.message);
    return res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to create room.',
    });
  }
};

/**
 * REST controller to get room state by room code.
 * GET /api/rooms/:code
 */
export const getRoom = async (req, res) => {
  try {
    const codeParam = req.params?.code ? String(req.params.code).toUpperCase().trim() : '';
    if (!codeParam) {
      return res.status(400).json({
        status: 'error',
        message: 'Room code parameter is required.',
      });
    }

    const activeRoom = roomManager.rooms.get(codeParam);
    if (activeRoom) {
      return res.status(200).json({
        status: 'success',
        data: {
          room: roomManager.formatRoomState(activeRoom),
        },
      });
    }

    const dbRoom = await CompetitionRoom.findOne({ roomCode: codeParam });
    if (!dbRoom || dbRoom.status === 'cancelled') {
      return res.status(404).json({
        status: 'error',
        message: `Room '${codeParam}' not found.`,
      });
    }

    const hydrated = roomManager.hydrateRoomFromDb(dbRoom);
    return res.status(200).json({
      status: 'success',
      data: {
        room: roomManager.formatRoomState(hydrated),
      },
    });
  } catch (error) {
    console.error('[Room Controller] Error fetching room:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching room.',
    });
  }
};

/**
 * REST controller to get match results for a room.
 * GET /api/rooms/:code/results
 */
export const getRoomResults = async (req, res) => {
  try {
    const userId = req.user?.id ? req.user.id.toString() : null;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const codeParam = req.params?.code ? String(req.params.code).toUpperCase().trim() : '';
    if (!codeParam) {
      return res.status(400).json({
        status: 'error',
        message: 'Room code parameter is required.',
      });
    }

    // 1. Locate room in memory or DB
    let room = roomManager.rooms.get(codeParam);
    let dbRoom = null;
    if (!room) {
      dbRoom = await CompetitionRoom.findOne({ roomCode: codeParam });
      if (!dbRoom || dbRoom.status === 'cancelled') {
        return res.status(404).json({
          status: 'error',
          message: `Room '${codeParam}' not found.`,
        });
      }
      room = roomManager.hydrateRoomFromDb(dbRoom);
    }

    // Authorization: only participants (including host) can access competition results
    const isParticipant =
      room.hostId === userId ||
      (room.participants && room.participants.some((p) => (p.userId?.toString() || p.userId) === userId));

    if (!isParticipant) {
      return res.status(403).json({
        status: 'error',
        message: 'Access forbidden: only room participants can access competition results.',
      });
    }

    // 2. Fetch persisted results from MongoDB
    const persistedResults = await CompetitionResult.find({ roomCode: codeParam }).sort({ rank: 1 });
    let formattedResults = persistedResults.map((r) => r.toJSON());

    // If no persisted results yet, map participants from room state
    if (formattedResults.length === 0 && room.participants) {
      formattedResults = room.participants.map((p, idx) => ({
        id: p.userId?.toString(),
        roomCode: codeParam,
        roomId: room.id,
        userId: p.userId?.toString(),
        username: p.username,
        wpm: p.wpm || p.liveWpm || 0,
        accuracy: p.accuracy || 0,
        completionTimeSeconds: p.elapsedSeconds || 0,
        rank: p.rank || idx + 1,
        completedSnippet: Boolean(p.completedSnippet || p.status === 'finished'),
        submittedAt: p.finishedAt || new Date(),
      }));
    }

    return res.status(200).json({
      status: 'success',
      data: {
        roomCode: codeParam,
        roomId: room.id,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        config: room.config,
        snippet: room.snippet,
        status: room.status,
        results: formattedResults,
      },
    });
  } catch (error) {
    console.error('[Room Controller] Error fetching room results:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching room results.',
    });
  }
};
