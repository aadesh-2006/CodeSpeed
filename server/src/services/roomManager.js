import crypto from 'crypto';
import CompetitionRoom from '../models/CompetitionRoom.js';
import CompetitionResult from '../models/CompetitionResult.js';
import Performance from '../models/Performance.js';
import { getRandomSnippet } from '../data/snippets.js';
import {
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  VALID_TIMERS,
} from '../models/Performance.js';

// Configurable max participant safety limit
export const MAX_ROOM_PARTICIPANTS = parseInt(process.env.MAX_ROOM_PARTICIPANTS || '100', 10);

// Ambiguity-free alphanumeric charset for room codes (excludes 0, O, 1, I, L)
const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generate a random 6-character room code.
 */
export const generateRoomCode = () => {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARSET[bytes[i] % ROOM_CODE_CHARSET.length];
  }
  return code;
};

class RoomManager {
  constructor() {
    // Map<roomCode, activeRoomObject>
    this.rooms = new Map();
    // Map<socketId, { roomCode, userId, username }>
    this.socketMap = new Map();
  }

  /**
   * Generates a unique room code not currently active in memory or MongoDB.
   */
  async generateUniqueCode() {
    let attempts = 0;
    while (attempts < 20) {
      const code = generateRoomCode();
      if (!this.rooms.has(code)) {
        const existing = await CompetitionRoom.findOne({ roomCode: code, status: { $ne: 'cancelled' } });
        if (!existing) {
          return code;
        }
      }
      attempts++;
    }
    // Fallback: append timestamp slice if high collision
    return `${generateRoomCode().slice(0, 4)}${Date.now().toString().slice(-2)}`;
  }

  /**
   * Create a new Competition Room.
   */
  async createRoom({ host, config }) {
    if (!host || !host.userId || !host.username) {
      throw new Error('Host user context is required.');
    }

    const {
      language = 'javascript',
      difficulty = 'medium',
      timerSeconds = 60,
    } = config || {};

    const normLang = language.toLowerCase().trim();
    const normDiff = difficulty.toLowerCase().trim();
    const parsedTimer = parseInt(timerSeconds, 10);

    if (!SUPPORTED_LANGUAGES.includes(normLang)) {
      throw new Error(`Unsupported language: '${language}'`);
    }
    if (!DIFFICULTY_LEVELS.includes(normDiff)) {
      throw new Error(`Unsupported difficulty: '${difficulty}'`);
    }
    if (!VALID_TIMERS.includes(parsedTimer)) {
      throw new Error(`Invalid timer: ${timerSeconds}`);
    }

    const snippet = getRandomSnippet(normLang, normDiff);
    if (!snippet) {
      throw new Error(`No snippet available for ${normLang} (${normDiff})`);
    }

    const roomCode = await this.generateUniqueCode();

    const initialParticipant = {
      userId: host.userId,
      username: host.username,
      profilePhoto: host.profilePhoto || null,
      joinedAt: new Date(),
      status: 'joined',
      progressPercent: 0,
      liveWpm: 0,
      wpm: 0,
      accuracy: 0,
      elapsedSeconds: 0,
      rank: null,
      completedSnippet: false,
      finishedAt: null,
    };

    const roomDoc = await CompetitionRoom.create({
      roomCode,
      hostId: host.userId,
      hostUsername: host.username,
      config: {
        language: normLang,
        difficulty: normDiff,
        timerSeconds: parsedTimer,
      },
      snippet: {
        id: snippet.id,
        title: snippet.title,
        language: snippet.language,
        difficulty: snippet.difficulty,
        code: snippet.code,
      },
      status: 'waiting',
      participants: [initialParticipant],
    });

    const activeRoom = {
      id: roomDoc._id.toString(),
      roomCode,
      hostId: host.userId.toString(),
      hostUsername: host.username,
      config: {
        language: normLang,
        difficulty: normDiff,
        timerSeconds: parsedTimer,
      },
      snippet: {
        id: snippet.id,
        title: snippet.title,
        language: snippet.language,
        difficulty: snippet.difficulty,
        code: snippet.code,
      },
      status: 'waiting',
      participants: [initialParticipant],
      countdownStartsAt: null,
      raceStartsAt: null,
      raceEndsAt: null,
      results: [],
      timers: {
        countdown: null,
        raceExpiration: null,
      },
      userSockets: new Map([[host.userId.toString(), new Set()]]),
    };

    this.rooms.set(roomCode, activeRoom);
    return this.formatRoomState(activeRoom);
  }

  /**
   * Join an existing Competition Room.
   */
  async joinRoom({ roomCode, user, socketId }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    let room = this.rooms.get(cleanCode);

    if (!room) {
      // Attempt load from DB if server restarted
      const dbRoom = await CompetitionRoom.findOne({ roomCode: cleanCode });
      if (!dbRoom || dbRoom.status === 'cancelled') {
        throw new Error(`Room '${cleanCode}' not found.`);
      }
      room = this.hydrateRoomFromDb(dbRoom);
      this.rooms.set(cleanCode, room);
    }

    const userIdStr = user.userId.toString();

    // Map socket to room & user
    if (socketId) {
      this.socketMap.set(socketId, { roomCode: cleanCode, userId: userIdStr, username: user.username });
      if (!room.userSockets.has(userIdStr)) {
        room.userSockets.set(userIdStr, new Set());
      }
      room.userSockets.get(userIdStr).add(socketId);
    }

    // Check if user is already a participant (reconnect / refresh)
    const existingIndex = room.participants.findIndex((p) => p.userId.toString() === userIdStr);
    if (existingIndex !== -1) {
      // Reconnection: update profile photo if changed, do not duplicate
      if (user.profilePhoto) {
        room.participants[existingIndex].profilePhoto = user.profilePhoto;
      }
      return { room: this.formatRoomState(room), isNewParticipant: false };
    }

    // If room has already started or finished, new participants cannot join
    if (room.status !== 'waiting') {
      throw new Error('Competition has already started or finished. Cannot join.');
    }

    // Safety limit check
    if (room.participants.length >= MAX_ROOM_PARTICIPANTS) {
      throw new Error(`Room is full (max ${MAX_ROOM_PARTICIPANTS} participants).`);
    }

    const newParticipant = {
      userId: user.userId,
      username: user.username,
      profilePhoto: user.profilePhoto || null,
      joinedAt: new Date(),
      status: 'joined',
      progressPercent: 0,
      liveWpm: 0,
      wpm: 0,
      accuracy: 0,
      elapsedSeconds: 0,
      rank: null,
      completedSnippet: false,
      finishedAt: null,
    };

    room.participants.push(newParticipant);

    // Persist to MongoDB asynchronously
    CompetitionRoom.updateOne(
      { roomCode: cleanCode },
      { $push: { participants: newParticipant }, updatedAt: new Date() }
    ).catch((err) => console.error('[RoomManager] DB join sync error:', err.message));

    return { room: this.formatRoomState(room), isNewParticipant: true };
  }

  /**
   * Leave a Competition Room.
   */
  async leaveRoom({ roomCode, userId, socketId }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room) return null;

    const userIdStr = userId.toString();

    // Clean up socket mapping
    if (socketId) {
      this.socketMap.delete(socketId);
      if (room.userSockets.has(userIdStr)) {
        room.userSockets.get(userIdStr).delete(socketId);
      }
      if (room.userSockets.get(userIdStr)?.size > 0) {
        return { room: this.formatRoomState(room), left: false };
      }
    } else {
      const userSockets = room.userSockets.get(userIdStr);
      if (userSockets) {
        for (const sId of userSockets) {
          this.socketMap.delete(sId);
        }
        room.userSockets.delete(userIdStr);
      }
    }

    if (room.status === 'waiting') {
      // Remove from participants list
      room.participants = room.participants.filter((p) => p.userId.toString() !== userIdStr);

      if (room.participants.length === 0) {
        // Room is empty -> cancel and cleanup
        room.status = 'cancelled';
        this.clearTimers(room);
        this.rooms.delete(cleanCode);
        await CompetitionRoom.updateOne({ roomCode: cleanCode }, { status: 'cancelled', updatedAt: new Date() });
        return { room: null, left: true, cancelled: true };
      }

      // If leaving user was host, transfer host to next oldest participant
      let newHost = null;
      if (room.hostId === userIdStr) {
        const nextHost = room.participants[0];
        room.hostId = nextHost.userId.toString();
        room.hostUsername = nextHost.username;
        newHost = { hostId: room.hostId, hostUsername: room.hostUsername };
      }

      await CompetitionRoom.updateOne(
        { roomCode: cleanCode },
        {
          hostId: room.hostId,
          hostUsername: room.hostUsername,
          participants: room.participants,
          updatedAt: new Date(),
        }
      );

      return { room: this.formatRoomState(room), left: true, newHost };
    }

    // If race is active / countdown, mark participant as abandoned but keep historical record
    const participant = room.participants.find((p) => p.userId.toString() === userIdStr);
    if (participant && participant.status === 'racing') {
      participant.status = 'abandoned';
    }

    return { room: this.formatRoomState(room), left: true };
  }

  /**
   * Update Room Configuration (Language, Difficulty, Timer).
   * Allowed ONLY while room.status === 'waiting'.
   */
  async updateConfig({ roomCode, userId, config }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error(`Room '${cleanCode}' not found.`);
    }

    if (room.hostId !== userId.toString()) {
      throw new Error('Only the room host can update configuration.');
    }

    if (room.status !== 'waiting') {
      throw new Error('Room configuration is frozen once the competition starts.');
    }

    const {
      language = room.config.language,
      difficulty = room.config.difficulty,
      timerSeconds = room.config.timerSeconds,
    } = config || {};

    const normLang = language.toLowerCase().trim();
    const normDiff = difficulty.toLowerCase().trim();
    const parsedTimer = parseInt(timerSeconds, 10);

    if (!SUPPORTED_LANGUAGES.includes(normLang)) {
      throw new Error(`Unsupported language: '${language}'`);
    }
    if (!DIFFICULTY_LEVELS.includes(normDiff)) {
      throw new Error(`Unsupported difficulty: '${difficulty}'`);
    }
    if (!VALID_TIMERS.includes(parsedTimer)) {
      throw new Error(`Invalid timer: ${timerSeconds}`);
    }

    // Select new canonical snippet matching the new configuration
    const snippet = getRandomSnippet(normLang, normDiff);
    if (!snippet) {
      throw new Error(`No snippet available for ${normLang} (${normDiff})`);
    }

    room.config = {
      language: normLang,
      difficulty: normDiff,
      timerSeconds: parsedTimer,
    };
    room.snippet = {
      id: snippet.id,
      title: snippet.title,
      language: snippet.language,
      difficulty: snippet.difficulty,
      code: snippet.code,
    };

    await CompetitionRoom.updateOne(
      { roomCode: cleanCode },
      {
        config: room.config,
        snippet: room.snippet,
        updatedAt: new Date(),
      }
    );

    return this.formatRoomState(room);
  }

  /**
   * Start Competition: Initiates synchronized 3-2-1 countdown.
   * Freezes configuration & snippet, establishes authoritative timestamps.
   */
  async startRoom({ roomCode, userId, onActive, onFinished }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error(`Room '${cleanCode}' not found.`);
    }

    if (room.hostId !== userId.toString()) {
      throw new Error('Only the room host can start the competition.');
    }

    if (room.status !== 'waiting') {
      throw new Error(`Cannot start room in '${room.status}' state.`);
    }

    if (room.participants.length < 1) {
      throw new Error('Cannot start room with 0 participants.');
    }

    const now = Date.now();
    const countdownStartsAt = new Date(now);
    const raceStartsAt = new Date(now + 3000); // 3-second countdown
    const raceEndsAt = new Date(now + 3000 + room.config.timerSeconds * 1000);

    room.status = 'countdown';
    room.countdownStartsAt = countdownStartsAt;
    room.raceStartsAt = raceStartsAt;
    room.raceEndsAt = raceEndsAt;

    // Set all participants to 'racing'
    for (const p of room.participants) {
      p.status = 'racing';
      p.progressPercent = 0;
      p.liveWpm = 0;
      p.wpm = 0;
      p.accuracy = 0;
      p.elapsedSeconds = 0;
      p.rank = null;
      p.completedSnippet = false;
      p.finishedAt = null;
    }

    await CompetitionRoom.updateOne(
      { roomCode: cleanCode },
      {
        status: 'countdown',
        countdownStartsAt,
        raceStartsAt,
        raceEndsAt,
        participants: room.participants,
        updatedAt: new Date(),
      }
    );

    // Schedule transition to ACTIVE when countdown finishes (3s)
    room.timers.countdown = setTimeout(async () => {
      if (room.status === 'countdown') {
        room.status = 'active';
        await CompetitionRoom.updateOne({ roomCode: cleanCode }, { status: 'active', updatedAt: new Date() });
        if (typeof onActive === 'function') {
          onActive(this.formatRoomState(room));
        }
      }
    }, 3000);

    // Schedule authoritative race expiration timeout (3s countdown + timer duration)
    const expirationMs = 3000 + room.config.timerSeconds * 1000;
    room.timers.raceExpiration = setTimeout(async () => {
      if (room.status === 'active' || room.status === 'countdown') {
        // Mark any unfinished racers as timed_out
        for (const p of room.participants) {
          if (p.status === 'racing' || p.status === 'joined') {
            p.status = 'timed_out';
          }
        }
        await this.finalizeRoom(cleanCode, onFinished);
      }
    }, expirationMs);

    return this.formatRoomState(room);
  }

  /**
   * Update participant live progress (throttled).
   */
  updateProgress({ roomCode, userId, progressPercent, currentPosition, liveWpm }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room || room.status !== 'active') return null;

    // Enforce race expiration
    if (room.raceEndsAt && Date.now() > new Date(room.raceEndsAt).getTime()) {
      return null;
    }

    const participant = room.participants.find((p) => p.userId.toString() === userId.toString());
    if (!participant || participant.status === 'finished' || participant.status === 'timed_out' || participant.status === 'abandoned') {
      return null;
    }

    participant.progressPercent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    participant.currentPosition = Math.max(0, Number(currentPosition) || 0);
    participant.liveWpm = Math.max(0, Number(liveWpm) || 0);

    return {
      userId: participant.userId.toString(),
      username: participant.username,
      progressPercent: participant.progressPercent,
      currentPosition: participant.currentPosition,
      liveWpm: participant.liveWpm,
    };
  }

  /**
   * Submit participant competition result upon completion or timeout.
   * Performs server-authoritative validation & anti-tamper verification.
   */
  async submitResult({ roomCode, userId, submission, onFinished }) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error(`Room '${cleanCode}' not found.`);
    }

    if (room.status !== 'active' && room.status !== 'countdown') {
      if (room.status === 'finished') {
        // Return existing finished result if already finalized
        const existingResult = room.participants.find((p) => p.userId.toString() === userId.toString());
        return { participant: existingResult, room: this.formatRoomState(room), allFinished: true };
      }
      throw new Error(`Cannot submit in '${room.status}' state.`);
    }

    const participant = room.participants.find((p) => p.userId.toString() === userId.toString());
    if (!participant) {
      throw new Error('User is not a registered participant in this room.');
    }

    if (participant.status === 'finished') {
      return { participant, room: this.formatRoomState(room), allFinished: false };
    }

    const {
      correctChars = 0,
      incorrectChars = 0,
      completedSnippet = false,
    } = submission || {};

    const targetCode = room.snippet.code;
    const now = Date.now();
    const raceStartMs = room.raceStartsAt ? new Date(room.raceStartsAt).getTime() : now;

    // Authoritative server-calculated elapsed time
    const rawElapsedSeconds = Math.max(1, (now - raceStartMs) / 1000);
    const serverElapsedSeconds = Math.min(room.config.timerSeconds + 5, Math.round(rawElapsedSeconds));

    // Anti-tamper calculations
    const safeCorrect = Math.max(0, Math.min(targetCode.length + 50, parseInt(correctChars, 10) || 0));
    const safeIncorrect = Math.max(0, parseInt(incorrectChars, 10) || 0);
    const totalChars = safeCorrect + safeIncorrect;

    let computedWpm = Math.round((safeCorrect / 5) / (serverElapsedSeconds / 60));
    if (isNaN(computedWpm) || computedWpm < 0) computedWpm = 0;
    if (computedWpm > 350) computedWpm = 350; // human speed ceiling

    let computedAccuracy = 100;
    if (totalChars > 0) {
      computedAccuracy = Math.round(((safeCorrect / totalChars) * 100) * 10) / 10;
      computedAccuracy = Math.max(0, Math.min(100, computedAccuracy));
    }

    // Determine current rank among finished participants
    const currentlyFinished = room.participants.filter((p) => p.status === 'finished');
    const rank = currentlyFinished.length + 1;

    participant.status = 'finished';
    participant.progressPercent = 100;
    participant.wpm = computedWpm;
    participant.liveWpm = computedWpm;
    participant.accuracy = computedAccuracy;
    participant.elapsedSeconds = serverElapsedSeconds;
    participant.rank = rank;
    participant.completedSnippet = Boolean(completedSnippet || safeCorrect >= targetCode.length);
    participant.finishedAt = new Date();

    // Upsert CompetitionResult document
    await CompetitionResult.findOneAndUpdate(
      { roomCode: cleanCode, userId: participant.userId },
      {
        roomCode: cleanCode,
        roomId: room.id,
        userId: participant.userId,
        username: participant.username,
        wpm: computedWpm,
        accuracy: computedAccuracy,
        completionTimeSeconds: serverElapsedSeconds,
        rank,
        completedSnippet: participant.completedSnippet,
        submittedAt: participant.finishedAt,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).catch((err) => console.error('[RoomManager] CompetitionResult upsert error:', err.message));

    // Persist user Performance record with mode: 'competition' for streak & history
    await Performance.create({
      userId: participant.userId,
      mode: 'competition',
      language: room.config.language,
      difficulty: room.config.difficulty,
      timerSeconds: room.config.timerSeconds,
      wpm: computedWpm,
      accuracy: computedAccuracy,
      correctChars: safeCorrect,
      incorrectChars: safeIncorrect,
      elapsedSeconds: serverElapsedSeconds,
      snippetId: room.snippet.id,
      roomCode: cleanCode,
      roomId: room.id,
      createdAt: participant.finishedAt,
    }).catch((err) => console.error('[RoomManager] Performance competition sync error:', err.message));

    // Check if all participants have finished
    const remainingRacers = room.participants.filter(
      (p) => p.status === 'racing' || p.status === 'joined'
    );
    const allFinished = remainingRacers.length === 0;

    if (allFinished) {
      await this.finalizeRoom(cleanCode, onFinished);
    } else {
      CompetitionRoom.updateOne(
        { roomCode: cleanCode },
        { participants: room.participants, updatedAt: new Date() }
      ).catch((err) => console.error('[RoomManager] DB update error:', err.message));
    }

    return {
      participant,
      room: this.formatRoomState(room),
      allFinished,
    };
  }

  /**
   * Finalize the room, sort leaderboard ranks deterministically, persist to DB, and clear timeouts.
   *
   * Deterministic Ranking Specification:
   * 1. Finished participants (completed snippet) rank ahead of incomplete / timed out / abandoned.
   * 2. Among finished participants:
   *    - Primary: lower elapsedSeconds (fastest completion time).
   *    - Tie-breaker: earlier finishedAt timestamp.
   * 3. Among incomplete / timed out / abandoned participants:
   *    - Primary: higher progressPercent.
   *    - Tie-breaker 1: higher liveWpm / wpm.
   *    - Tie-breaker 2: higher accuracy.
   */
  async finalizeRoom(roomCode, onFinished) {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room || room.status === 'finished') return room ? this.formatRoomState(room) : null;

    this.clearTimers(room);
    room.status = 'finished';

    // Deterministic sorting
    const sorted = [...room.participants].sort((a, b) => {
      const aFinished = a.status === 'finished' || a.completedSnippet;
      const bFinished = b.status === 'finished' || b.completedSnippet;

      // 1. Finished ahead of unfinished
      if (aFinished !== bFinished) {
        return aFinished ? -1 : 1;
      }

      // 2. Among finished participants: elapsedSeconds ASC, finishedAt ASC
      if (aFinished && bFinished) {
        const aElapsed = a.elapsedSeconds || 9999;
        const bElapsed = b.elapsedSeconds || 9999;
        if (aElapsed !== bElapsed) {
          return aElapsed - bElapsed; // Lower time ranks higher
        }
        const aTime = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const bTime = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        return aTime - bTime; // Earlier finish ranks higher
      }

      // 3. Among unfinished/timed out/abandoned participants
      const aProgress = a.progressPercent || 0;
      const bProgress = b.progressPercent || 0;
      if (bProgress !== aProgress) {
        return bProgress - aProgress; // Higher progress ranks higher
      }
      const aWpm = a.wpm || a.liveWpm || 0;
      const bWpm = b.wpm || b.liveWpm || 0;
      if (bWpm !== aWpm) {
        return bWpm - aWpm; // Higher WPM ranks higher
      }
      return (b.accuracy || 0) - (a.accuracy || 0); // Higher accuracy ranks higher
    });

    // Assign 1-based ranks
    sorted.forEach((p, idx) => {
      const original = room.participants.find((orig) => orig.userId.toString() === p.userId.toString());
      if (original) {
        original.rank = idx + 1;
      }
    });

    // Idempotent upsert into CompetitionResult for all participants
    for (const p of room.participants) {
      const isCompleted = Boolean(p.completedSnippet || p.status === 'finished');
      await CompetitionResult.findOneAndUpdate(
        { roomCode: cleanCode, userId: p.userId },
        {
          roomCode: cleanCode,
          roomId: room.id,
          userId: p.userId,
          username: p.username,
          wpm: p.wpm || p.liveWpm || 0,
          accuracy: p.accuracy || 0,
          completionTimeSeconds: p.elapsedSeconds || 0,
          rank: p.rank || 1,
          completedSnippet: isCompleted,
          submittedAt: p.finishedAt || new Date(),
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      ).catch((err) => console.error('[RoomManager] Finalize CompetitionResult upsert error:', err.message));
    }

    await CompetitionRoom.updateOne(
      { roomCode: cleanCode },
      {
        status: 'finished',
        participants: room.participants,
        updatedAt: new Date(),
      }
    ).catch((err) => console.error('[RoomManager] Finalize DB error:', err.message));

    const formatted = this.formatRoomState(room);
    if (typeof onFinished === 'function') {
      onFinished(formatted);
    }
    return formatted;
  }

  /**
   * Handle socket disconnect event.
   */
  async handleSocketDisconnect(socketId) {
    const meta = this.socketMap.get(socketId);
    if (!meta) return null;

    const { roomCode, userId } = meta;
    return this.leaveRoom({ roomCode, userId, socketId });
  }

  /**
   * Format room state object for client consumption.
   */
  formatRoomState(room) {
    const now = Date.now();
    let remainingSeconds = room.config.timerSeconds;

    if (room.status === 'active' && room.raceEndsAt) {
      const msLeft = new Date(room.raceEndsAt).getTime() - now;
      remainingSeconds = Math.max(0, Math.ceil(msLeft / 1000));
    } else if (room.status === 'finished') {
      remainingSeconds = 0;
    }

    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      hostUsername: room.hostUsername,
      config: { ...room.config },
      snippet: { ...room.snippet },
      status: room.status,
      participants: room.participants.map((p) => ({
        userId: p.userId.toString(),
        username: p.username,
        profilePhoto: p.profilePhoto,
        status: p.status,
        progressPercent: p.progressPercent || 0,
        currentPosition: p.currentPosition || 0,
        liveWpm: p.liveWpm || 0,
        wpm: p.wpm,
        accuracy: p.accuracy,
        elapsedSeconds: p.elapsedSeconds,
        rank: p.rank,
        completedSnippet: p.completedSnippet,
        finishedAt: p.finishedAt,
      })),
      participantCount: room.participants.length,
      countdownStartsAt: room.countdownStartsAt,
      raceStartsAt: room.raceStartsAt,
      raceEndsAt: room.raceEndsAt,
      remainingSeconds,
    };
  }

  /**
   * Hydrate in-memory room from MongoDB document.
   */
  hydrateRoomFromDb(dbRoom) {
    return {
      id: dbRoom._id.toString(),
      roomCode: dbRoom.roomCode,
      hostId: dbRoom.hostId.toString(),
      hostUsername: dbRoom.hostUsername,
      config: {
        language: dbRoom.config.language,
        difficulty: dbRoom.config.difficulty,
        timerSeconds: dbRoom.config.timerSeconds,
      },
      snippet: {
        id: dbRoom.snippet.id,
        title: dbRoom.snippet.title,
        language: dbRoom.snippet.language,
        difficulty: dbRoom.snippet.difficulty,
        code: dbRoom.snippet.code,
      },
      status: dbRoom.status,
      participants: dbRoom.participants.map((p) => ({
        userId: p.userId.toString(),
        username: p.username,
        profilePhoto: p.profilePhoto,
        joinedAt: p.joinedAt,
        status: p.status,
        progressPercent: p.progressPercent || 0,
        currentPosition: p.currentPosition || 0,
        liveWpm: p.liveWpm || 0,
        wpm: p.wpm || 0,
        accuracy: p.accuracy || 0,
        elapsedSeconds: p.elapsedSeconds || 0,
        rank: p.rank || null,
        completedSnippet: p.completedSnippet || false,
        finishedAt: p.finishedAt || null,
      })),
      countdownStartsAt: dbRoom.countdownStartsAt,
      raceStartsAt: dbRoom.raceStartsAt,
      raceEndsAt: dbRoom.raceEndsAt,
      results: [],
      timers: {
        countdown: null,
        raceExpiration: null,
      },
      userSockets: new Map(),
    };
  }

  clearTimers(room) {
    if (room?.timers) {
      if (room.timers.countdown) clearTimeout(room.timers.countdown);
      if (room.timers.raceExpiration) clearTimeout(room.timers.raceExpiration);
      room.timers.countdown = null;
      room.timers.raceExpiration = null;
    }
  }

  /**
   * Reset / clear all in-memory rooms (useful for test tearDown).
   */
  reset() {
    for (const room of this.rooms.values()) {
      this.clearTimers(room);
    }
    this.rooms.clear();
    this.socketMap.clear();
  }
}

export const roomManager = new RoomManager();
export default roomManager;
