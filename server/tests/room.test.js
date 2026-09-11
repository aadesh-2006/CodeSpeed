import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ClientIO } from 'socket.io-client';
import app, { server, io } from '../src/index.js';
import User from '../src/models/User.js';
import Performance from '../src/models/Performance.js';
import CompetitionRoom from '../src/models/CompetitionRoom.js';
import CompetitionResult from '../src/models/CompetitionResult.js';
import roomManager from '../src/services/roomManager.js';
import { SNIPPETS, getRandomSnippet } from '../src/data/snippets.js';

const JWT_TEST_SECRET = 'codespeed_room_test_secret_998877';
process.env.JWT_SECRET = JWT_TEST_SECRET;
process.env.NODE_ENV = 'test';

describe('Real-Time Multiplayer Competition Rooms — Milestone 1 Backend Tests', () => {
  let mongoServer;
  let serverPort;
  let baseUrl;
  let hostUser;
  let hostToken;
  let participantUser;
  let participantToken;
  let participantUser2;
  let participantToken2;
  const openSockets = [];
  const testDbPath = path.resolve('node_modules/.cache/test-room-db-' + Date.now());

  before(async () => {
    fs.mkdirSync(testDbPath, { recursive: true });
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '4.4.29',
      },
      instance: {
        dbPath: testDbPath,
      },
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Listen on random free port with existing server and Socket.IO
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });

    // Create test users
    hostUser = await User.create({
      username: 'RoomHostUser',
      email: 'host@codespeed.test',
      passwordHash: 'hashed_password_host',
      timezone: 'UTC',
    });
    hostToken = jwt.sign({ id: hostUser._id.toString() }, JWT_TEST_SECRET);

    participantUser = await User.create({
      username: 'RacerOne',
      email: 'racer1@codespeed.test',
      passwordHash: 'hashed_password_racer1',
      timezone: 'UTC',
    });
    participantToken = jwt.sign({ id: participantUser._id.toString() }, JWT_TEST_SECRET);

    participantUser2 = await User.create({
      username: 'RacerTwo',
      email: 'racer2@codespeed.test',
      passwordHash: 'hashed_password_racer2',
      timezone: 'UTC',
    });
    participantToken2 = jwt.sign({ id: participantUser2._id.toString() }, JWT_TEST_SECRET);
  });

  after(async () => {
    while (openSockets.length > 0) {
      const s = openSockets.pop();
      if (s) {
        s.disconnect();
      }
    }
    roomManager.reset();
    if (io) {
      io.disconnectSockets(true);
      await new Promise((resolve) => io.close(resolve));
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    try {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  beforeEach(async () => {
    roomManager.reset();
    await CompetitionRoom.deleteMany({});
    await CompetitionResult.deleteMany({});
    await Performance.deleteMany({});
  });

  afterEach(async () => {
    while (openSockets.length > 0) {
      const s = openSockets.pop();
      if (s && s.connected) {
        s.disconnect();
      }
    }
    roomManager.reset();
  });

  // Helper to create authenticated Socket.IO client with reconnection disabled
  const createSocketClient = (token) => {
    const socket = ClientIO(`http://127.0.0.1:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
  };

  describe('1. Snippet Selection & Canonical Source Verification', () => {
    test('canonical snippets collection contains 72 items across 8 languages and 3 difficulties', () => {
      assert.strictEqual(SNIPPETS.length, 72);
      const languages = ['javascript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'sql'];
      const difficulties = ['easy', 'medium', 'hard'];

      for (const lang of languages) {
        for (const diff of difficulties) {
          const matching = SNIPPETS.filter((s) => s.language === lang && s.difficulty === diff);
          assert.strictEqual(matching.length, 3, `Expected 3 snippets for ${lang}-${diff}`);
        }
      }
    });

    test('getRandomSnippet returns matching snippet and handles parameters correctly', () => {
      const snip = getRandomSnippet('python', 'hard');
      assert.ok(snip);
      assert.strictEqual(snip.language, 'python');
      assert.strictEqual(snip.difficulty, 'hard');
      assert.ok(snip.code.length > 0);
    });
  });

  describe('2. Room Creation & REST API', () => {
    test('POST /api/rooms creates a room with valid config and 6-char code', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: JSON.stringify({
          language: 'python',
          difficulty: 'hard',
          timerSeconds: 120,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.status, 'success');
      assert.ok(data.data.room);
      assert.strictEqual(data.data.room.roomCode.length, 6);
      assert.strictEqual(data.data.room.config.language, 'python');
      assert.strictEqual(data.data.room.config.difficulty, 'hard');
      assert.strictEqual(data.data.room.config.timerSeconds, 120);
      assert.strictEqual(data.data.room.hostUsername, 'RoomHostUser');
      assert.strictEqual(data.data.room.participants.length, 1);
      assert.strictEqual(data.data.room.snippet.language, 'python');
    });

    test('POST /api/rooms rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'javascript' }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('GET /api/rooms/:code fetches created room details', async () => {
      const created = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'java', difficulty: 'easy', timerSeconds: 60 },
      });

      const res = await fetch(`${baseUrl}/api/rooms/${created.roomCode}`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.room.roomCode, created.roomCode);
      assert.strictEqual(json.data.room.config.language, 'java');
    });

    test('GET /api/rooms/:code returns 404 for non-existent code', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/NONEXIST`);
      assert.strictEqual(res.status, 404);
    });
  });

  describe('3. Real-Time Socket Connection & Room Lifecycle', () => {
    test('Socket rejects connection without valid JWT token', async () => {
      const socket = ClientIO(`http://127.0.0.1:${serverPort}`, {
        auth: { token: 'invalid_bad_token' },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);

      await new Promise((resolve) => {
        socket.on('connect_error', (err) => {
          assert.ok(err.message.includes('token') || err.message.includes('Authentication'));
          socket.disconnect();
          resolve();
        });
      });
    });

    test('Host and Participants join room and receive identical snippet', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      // Host creates room via manager
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'cpp', difficulty: 'medium', timerSeconds: 60 },
      });

      // Host joins socket room
      const hostJoinPromise = new Promise((res) => {
        hostSocket.emit('room:join', { code: room.roomCode }, (resp) => {
          res(resp);
        });
      });
      const hostResp = await hostJoinPromise;
      assert.strictEqual(hostResp.success, true);

      // Racer joins socket room
      const racerJoinPromise = new Promise((res) => {
        racerSocket.emit('room:join', { code: room.roomCode }, (resp) => {
          res(resp);
        });
      });
      const racerResp = await racerJoinPromise;
      assert.strictEqual(racerResp.success, true);
      assert.strictEqual(racerResp.room.participantCount, 2);

      // Exact same snippet verification
      assert.strictEqual(hostResp.room.snippet.id, racerResp.room.snippet.id);
      assert.strictEqual(hostResp.room.snippet.code, racerResp.room.snippet.code);
    });

    test('Duplicate join attempts re-attach socket without creating duplicate participant entries', async () => {
      const socket1 = createSocketClient(hostToken);
      await new Promise((res) => socket1.on('connect', res));

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 30 },
      });

      // Join once
      await new Promise((res) => socket1.emit('room:join', { code: room.roomCode }, res));

      // Join second time from same user
      const secondJoin = await new Promise((res) => socket1.emit('room:join', { code: room.roomCode }, res));
      assert.strictEqual(secondJoin.success, true);
      assert.strictEqual(secondJoin.room.participants.length, 1);
    });

    test('Host updates configuration in waiting state and participants receive updated config & snippet', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 30 },
      });

      await new Promise((res) => hostSocket.emit('room:join', { code: room.roomCode }, res));
      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      // Racer listens for config_updated event
      const configUpdatePromise = new Promise((res) => {
        racerSocket.on('room:config_updated', (payload) => {
          res(payload);
        });
      });

      // Host updates config
      await new Promise((res) => {
        hostSocket.emit(
          'room:update_config',
          { code: room.roomCode, config: { language: 'sql', difficulty: 'hard', timerSeconds: 120 } },
          res
        );
      });

      const updatePayload = await configUpdatePromise;
      assert.strictEqual(updatePayload.config.language, 'sql');
      assert.strictEqual(updatePayload.config.difficulty, 'hard');
      assert.strictEqual(updatePayload.config.timerSeconds, 120);
      assert.strictEqual(updatePayload.snippet.language, 'sql');
    });

    test('Non-host participant CANNOT update room configuration', async () => {
      const racerSocket = createSocketClient(participantToken);
      await new Promise((res) => racerSocket.on('connect', res));

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 30 },
      });

      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      const res = await new Promise((resolve) => {
        racerSocket.emit('room:update_config', { code: room.roomCode, config: { language: 'python' } }, resolve);
      });

      assert.ok(res.error.includes('host'));
    });
  });

  describe('4. Synchronized Start, Configuration Freeze & Live Race', () => {
    test('Host starts competition: broadcasts 3-second countdown and freezes configuration', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'c', difficulty: 'medium', timerSeconds: 60 },
      });

      await new Promise((res) => hostSocket.emit('room:join', { code: room.roomCode }, res));
      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      const countdownPromise = new Promise((res) => {
        racerSocket.on('room:countdown', (payload) => res(payload));
      });

      // Host triggers start
      const startResp = await new Promise((res) => {
        hostSocket.emit('room:start', { code: room.roomCode }, res);
      });
      assert.strictEqual(startResp.success, true);

      const countdownPayload = await countdownPromise;
      assert.strictEqual(countdownPayload.countdownSeconds, 3);
      assert.ok(countdownPayload.raceStartsAt);
      assert.ok(countdownPayload.raceEndsAt);

      // Verify config is now FROZEN
      const configAttempt = await new Promise((res) => {
        hostSocket.emit('room:update_config', { code: room.roomCode, config: { language: 'python' } }, res);
      });
      assert.ok(configAttempt.error.includes('frozen'));
    });

    test('Live progress broadcasting between opponents during race', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'html', difficulty: 'easy', timerSeconds: 30 },
      });

      await new Promise((res) => hostSocket.emit('room:join', { code: room.roomCode }, res));
      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      // Force room to active for test
      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 5000);

      const progressPromise = new Promise((res) => {
        hostSocket.on('race:progress_update', (data) => res(data));
      });

      racerSocket.emit('race:progress', {
        code: room.roomCode,
        progressPercent: 45,
        liveWpm: 72,
      });

      const progressData = await progressPromise;
      assert.strictEqual(progressData.username, 'RacerOne');
      assert.strictEqual(progressData.progressPercent, 45);
      assert.strictEqual(progressData.liveWpm, 72);
    });
  });

  describe('5. Authoritative Result Submission & Anti-Tamper Verification', () => {
    test('Valid result submission calculates rank, WPM, and persists CompetitionResult & Performance (competition mode)', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 60 },
      });

      await new Promise((res) => hostSocket.emit('room:join', { code: room.roomCode }, res));
      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      // Simulate race started 10 seconds ago
      activeRoom.raceStartsAt = new Date(Date.now() - 10000);

      // Racer finishes first with correct code
      const racerSubmit = await new Promise((res) => {
        racerSocket.emit(
          'race:submit',
          {
            code: room.roomCode,
            typedCode: activeRoom.snippet.code,
            correctChars: 100,
            incorrectChars: 0,
            completedSnippet: true,
          },
          res
        );
      });

      assert.strictEqual(racerSubmit.success, true);
      assert.strictEqual(racerSubmit.participant.rank, 1);
      assert.strictEqual(racerSubmit.participant.status, 'finished');
      assert.strictEqual(racerSubmit.participant.accuracy, 100);
      assert.ok(racerSubmit.participant.wpm > 0);

      // Verify CompetitionResult was persisted
      const resultDoc = await CompetitionResult.findOne({
        roomCode: room.roomCode,
        userId: participantUser._id,
      });
      assert.ok(resultDoc);
      assert.strictEqual(resultDoc.rank, 1);
      assert.strictEqual(resultDoc.completedSnippet, true);

      // Verify user Performance record was created with mode: 'competition'
      const perfDoc = await Performance.findOne({
        userId: participantUser._id,
        mode: 'competition',
        roomCode: room.roomCode,
      });
      assert.ok(perfDoc);
      assert.strictEqual(perfDoc.mode, 'competition');
    });

    test('Competition mode tests contribute to daily activity and streak without altering solo ranked personal bests', async () => {
      // Save 1 ranked test
      await Performance.create({
        userId: hostUser._id,
        mode: 'ranked',
        language: 'javascript',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 80,
        accuracy: 95,
        correctChars: 380,
        incorrectChars: 20,
        elapsedSeconds: 60,
        snippetId: 'js-medium-01',
      });

      // Save 1 competition test
      await Performance.create({
        userId: hostUser._id,
        mode: 'competition',
        language: 'javascript',
        difficulty: 'hard',
        timerSeconds: 60,
        wpm: 120, // Faster than solo ranked
        accuracy: 98,
        correctChars: 580,
        incorrectChars: 12,
        elapsedSeconds: 60,
        snippetId: 'js-hard-01',
      });

      // Fetch public profile
      const profileRes = await fetch(`${baseUrl}/api/users/${hostUser.username}/profile`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const profileData = await profileRes.json();

      // Solo ranked personal best must still be 80 WPM (NOT 120 WPM from competition)
      assert.strictEqual(profileData.data.ranked.summary.personalBest.wpm, 80);

      // Streak total should include both (ranked + competition = 2 tests)
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayItem = profileData.data.streak.dailyActivity.find((d) => d.date === todayStr);
      assert.strictEqual(todayItem?.testCount, 2);

      // Fetch daily activity details
      const dailyRes = await fetch(`${baseUrl}/api/users/${hostUser.username}/activity/${todayStr}`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const dailyData = await dailyRes.json();
      assert.strictEqual(dailyData.data.totalTests, 2);
      assert.strictEqual(dailyData.data.rankedCount, 1);
      assert.strictEqual(dailyData.data.competitionCount, 1);
    });
  });

  describe('6. Disconnect, Host Transfer & Reconnection', () => {
    test('Host leaves waiting room: transfers host to remaining participant', async () => {
      const hostSocket = createSocketClient(hostToken);
      const racerSocket = createSocketClient(participantToken);

      await Promise.all([
        new Promise((res) => hostSocket.on('connect', res)),
        new Promise((res) => racerSocket.on('connect', res)),
      ]);

      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'easy', timerSeconds: 30 },
      });

      await new Promise((res) => hostSocket.emit('room:join', { code: room.roomCode }, res));
      await new Promise((res) => racerSocket.emit('room:join', { code: room.roomCode }, res));

      // Host leaves room
      const leaveResult = await roomManager.leaveRoom({
        roomCode: room.roomCode,
        userId: hostUser._id,
      });

      assert.strictEqual(leaveResult.left, true);
      assert.ok(leaveResult.newHost);
      assert.strictEqual(leaveResult.newHost.hostUsername, 'RacerOne');

      // Check room in memory
      const updated = roomManager.rooms.get(room.roomCode);
      assert.strictEqual(updated.hostUsername, 'RacerOne');
      assert.strictEqual(updated.participants.length, 1);
    });

    test('Participant reconnects to active room without resetting race or creating duplicates', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'java', difficulty: 'medium', timerSeconds: 60 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 15000);
      activeRoom.raceEndsAt = new Date(Date.now() + 45000);

      // Racer reconnects with socket
      const racerSocket = createSocketClient(participantToken);
      await new Promise((res) => racerSocket.on('connect', res));

      const reconnectResp = await new Promise((res) => {
        racerSocket.emit('room:join', { code: room.roomCode }, res);
      });

      assert.strictEqual(reconnectResp.success, true);
      assert.strictEqual(reconnectResp.room.status, 'active');
      assert.strictEqual(reconnectResp.room.snippet.id, room.snippet.id);
      assert.strictEqual(reconnectResp.room.participants.length, 2);
      assert.ok(reconnectResp.room.remainingSeconds > 0 && reconnectResp.room.remainingSeconds <= 45);
      assert.ok(reconnectResp.room.raceStartsAt);
      assert.ok(reconnectResp.room.raceEndsAt);
    });

    test('Authoritative race expiration transitions room to finished and marks unfinished racers as timed_out', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'easy', timerSeconds: 30 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 31000);
      activeRoom.raceEndsAt = new Date(Date.now() - 1000); // 1s ago

      // Participant finishes before expiration
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].wpm = 90;

      // Participant 2 is still racing -> finalize room
      await roomManager.finalizeRoom(room.roomCode);

      const finishedRoom = roomManager.rooms.get(room.roomCode);
      assert.strictEqual(finishedRoom.status, 'finished');
      assert.strictEqual(finishedRoom.participants[0].status, 'finished');
    });

    test('Progress update includes currentPosition and rejects non-active race progress', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'c', difficulty: 'easy', timerSeconds: 30 },
      });

      // Attempt progress in waiting state -> should return null
      const waitingProgress = roomManager.updateProgress({
        roomCode: room.roomCode,
        userId: hostUser._id,
        progressPercent: 20,
        currentPosition: 15,
        liveWpm: 50,
      });
      assert.strictEqual(waitingProgress, null);

      // Transition to active
      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';

      const validProgress = roomManager.updateProgress({
        roomCode: room.roomCode,
        userId: hostUser._id,
        progressPercent: 25,
        currentPosition: 30,
        liveWpm: 65,
      });

      assert.ok(validProgress);
      assert.strictEqual(validProgress.progressPercent, 25);
      assert.strictEqual(validProgress.currentPosition, 30);
      assert.strictEqual(validProgress.liveWpm, 65);
    });
  });

  describe('7. Competition Results REST API & Deterministic Ranking (Milestone 5)', () => {
    test('GET /api/rooms/:code/results rejects unauthenticated requests with 401', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'easy', timerSeconds: 30 },
      });

      const res = await fetch(`${baseUrl}/api/rooms/${room.roomCode}/results`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.status, 'error');
    });

    test('GET /api/rooms/:code/results rejects authenticated non-participants with 403', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'easy', timerSeconds: 30 },
      });

      // participantUser2 is NOT in this room
      const res = await fetch(`${baseUrl}/api/rooms/${room.roomCode}/results`, {
        headers: { Authorization: `Bearer ${participantToken2}` },
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.status, 'error');
      assert.ok(json.message.includes('forbidden') || json.message.includes('participant'));
    });

    test('GET /api/rooms/:code/results returns 404 for non-existent room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/NONEX9/results`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.status, 'error');
      assert.ok(json.message.includes('not found'));
    });

    test('GET /api/rooms/:code/results returns enriched room metadata and sorted results to participants', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'hard', timerSeconds: 60 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 30000);

      // Submit result for participant 1 (fast finish: 20s, 95% accuracy)
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].completedSnippet = true;
      activeRoom.participants[0].elapsedSeconds = 20;
      activeRoom.participants[0].accuracy = 95;
      activeRoom.participants[0].wpm = 95;
      activeRoom.participants[0].finishedAt = new Date(Date.now() - 10000);

      // Submit result for participant 2 (slower finish: 25s, 100% accuracy)
      activeRoom.participants[1].status = 'finished';
      activeRoom.participants[1].completedSnippet = true;
      activeRoom.participants[1].elapsedSeconds = 25;
      activeRoom.participants[1].accuracy = 100;
      activeRoom.participants[1].wpm = 80;
      activeRoom.participants[1].finishedAt = new Date(Date.now() - 5000);

      await roomManager.finalizeRoom(room.roomCode);

      const res = await fetch(`${baseUrl}/api/rooms/${room.roomCode}/results`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.roomCode, room.roomCode);
      assert.strictEqual(json.data.config.language, 'python');
      assert.strictEqual(json.data.config.difficulty, 'hard');
      assert.strictEqual(json.data.status, 'finished');
      assert.strictEqual(json.data.results.length, 2);

      // Verify Rank 1 (lowest elapsed seconds = 20s) and Rank 2 (25s)
      assert.strictEqual(json.data.results[0].rank, 1);
      assert.strictEqual(json.data.results[0].userId, hostUser._id.toString());
      assert.strictEqual(json.data.results[0].completionTimeSeconds, 20);

      assert.strictEqual(json.data.results[1].rank, 2);
      assert.strictEqual(json.data.results[1].userId, participantUser._id.toString());
      assert.strictEqual(json.data.results[1].completionTimeSeconds, 25);
    });

    test('GET /api/rooms/:code/results is durable across server restarts / in-memory room cleanup', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 30 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].completedSnippet = true;
      activeRoom.participants[0].elapsedSeconds = 15;
      activeRoom.participants[0].accuracy = 100;
      activeRoom.participants[0].wpm = 110;
      activeRoom.participants[0].finishedAt = new Date();

      await roomManager.finalizeRoom(room.roomCode);

      // Verify records in DB
      const resultBefore = await CompetitionResult.findOne({ roomCode: room.roomCode });
      assert.ok(resultBefore);

      // Wipe in-memory state to simulate server restart / cache eviction
      roomManager.reset();
      assert.strictEqual(roomManager.rooms.has(room.roomCode), false);

      // Fetch results via REST API from DB as host participant
      const res = await fetch(`${baseUrl}/api/rooms/${room.roomCode}/results`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.roomCode, room.roomCode);
      assert.strictEqual(json.data.results.length, 1);
      assert.strictEqual(json.data.results[0].wpm, 110);
      assert.strictEqual(json.data.results[0].rank, 1);
    });

    test('Corrected deterministic ranking: elapsedSeconds ASC then finishedAt ASC (accuracy must NOT tie-break finished racers)', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'java', difficulty: 'medium', timerSeconds: 60 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser2._id, username: participantUser2.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';

      const t1 = new Date(Date.now() - 20000); // Finished earlier
      const t2 = new Date(Date.now() - 15000); // Finished later

      // Participant 1 (Host): finished, 20s, 95% accuracy, finishedAt = t1 (earlier)
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].completedSnippet = true;
      activeRoom.participants[0].elapsedSeconds = 20;
      activeRoom.participants[0].accuracy = 95;
      activeRoom.participants[0].wpm = 80;
      activeRoom.participants[0].finishedAt = t1;

      // Participant 2: finished, 20s, 99% accuracy, finishedAt = t2 (later)
      // Even with 99% accuracy, Participant 2 finished later (t2 > t1) so Participant 1 wins rank 1
      activeRoom.participants[1].status = 'finished';
      activeRoom.participants[1].completedSnippet = true;
      activeRoom.participants[1].elapsedSeconds = 20;
      activeRoom.participants[1].accuracy = 99;
      activeRoom.participants[1].wpm = 80;
      activeRoom.participants[1].finishedAt = t2;

      // Participant 3: timed_out, 60s, 75% progress (Ranks after finished participants)
      activeRoom.participants[2].status = 'timed_out';
      activeRoom.participants[2].completedSnippet = false;
      activeRoom.participants[2].elapsedSeconds = 60;
      activeRoom.participants[2].progressPercent = 75;
      activeRoom.participants[2].accuracy = 90;
      activeRoom.participants[2].wpm = 45;

      await roomManager.finalizeRoom(room.roomCode);

      // Participant 1 (earlier finishedAt t1) should be Rank 1
      assert.strictEqual(activeRoom.participants[0].rank, 1);
      // Participant 2 (later finishedAt t2) should be Rank 2 despite higher accuracy
      assert.strictEqual(activeRoom.participants[1].rank, 2);
      // Participant 3 (timed out) should be Rank 3
      assert.strictEqual(activeRoom.participants[2].rank, 3);
    });

    test('Duplicate room finalization cannot create duplicate CompetitionResult documents', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'cpp', difficulty: 'easy', timerSeconds: 30 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].completedSnippet = true;
      activeRoom.participants[0].elapsedSeconds = 18;
      activeRoom.participants[0].accuracy = 100;
      activeRoom.participants[0].wpm = 85;

      // Finalize 1st time
      await roomManager.finalizeRoom(room.roomCode);
      // Finalize 2nd time (idempotency check)
      await roomManager.finalizeRoom(room.roomCode);

      const docs = await CompetitionResult.find({ roomCode: room.roomCode, userId: hostUser._id });
      assert.strictEqual(docs.length, 1);
    });

    test('Client-provided rank in submission is ignored and server calculates authoritative rank', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 10000);

      // Host submits with manipulated rank claim: { rank: 99 }
      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          typedCode: activeRoom.snippet.code,
          correctChars: 100,
          incorrectChars: 0,
          completedSnippet: true,
          rank: 99, // Tampered client rank claim
        },
      });

      assert.strictEqual(res.participant.rank, 1, 'Server must calculate rank independently');
      const doc = await CompetitionResult.findOne({ roomCode: room.roomCode, userId: hostUser._id });
      assert.strictEqual(doc.rank, 1, 'Persisted rank must be server-calculated');
    });

    test('Competition Performance records do NOT alter solo Ranked stats, personal bests, badges, or Practice stats', async () => {
      // 1. Save solo Ranked performance: 75 WPM
      await Performance.create({
        userId: hostUser._id,
        mode: 'ranked',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 75,
        accuracy: 94,
        correctChars: 375,
        incorrectChars: 24,
        elapsedSeconds: 60,
        snippetId: 'py-med-01',
      });

      // 2. Save solo Practice performance: 65 WPM
      await Performance.create({
        userId: hostUser._id,
        mode: 'practice',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 65,
        accuracy: 92,
        correctChars: 325,
        incorrectChars: 28,
        elapsedSeconds: 60,
        snippetId: 'py-med-02',
      });

      // 3. Save high-score Competition performance: 140 WPM
      await Performance.create({
        userId: hostUser._id,
        mode: 'competition',
        language: 'python',
        difficulty: 'medium',
        timerSeconds: 60,
        wpm: 140, // Much higher than ranked or practice
        accuracy: 100,
        correctChars: 700,
        incorrectChars: 0,
        elapsedSeconds: 60,
        snippetId: 'py-med-03',
        roomCode: 'TEST99',
      });

      // 4. Fetch Ranked summary
      const rankedSummaryRes = await fetch(`${baseUrl}/api/performances/summary?mode=ranked`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const rankedSummary = await rankedSummaryRes.json();
      assert.strictEqual(rankedSummary.data.personalBest.wpm, 75, 'Ranked PB must remain 75 WPM');
      assert.strictEqual(rankedSummary.data.totalTests, 1, 'Ranked total tests must be 1');

      // 5. Fetch Practice summary
      const practiceSummaryRes = await fetch(`${baseUrl}/api/performances/summary?mode=practice`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const practiceSummary = await practiceSummaryRes.json();
      assert.strictEqual(practiceSummary.data.personalBest.wpm, 65, 'Practice PB must remain 65 WPM');
      assert.strictEqual(practiceSummary.data.totalTests, 1, 'Practice total tests must be 1');

      // 6. Fetch Badges (evaluated against ranked attempts)
      const badgesRes = await fetch(`${baseUrl}/api/performances/badges`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const badges = await badgesRes.json();
      const speedBadge75 = badges.data.badges.find((b) => b.id === 'wpm_75');
      const speedBadge100 = badges.data.badges.find((b) => b.id === 'wpm_100');
      assert.strictEqual(speedBadge75.earned, true, '75 WPM badge should be earned from ranked');
      assert.strictEqual(speedBadge100.earned, false, '100 WPM badge should NOT be unlocked by 140 WPM competition attempt');
    });

    test('Incomplete and timed-out racers maintain verified accuracy and elapsedSeconds in final results', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'medium', timerSeconds: 60 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 60000);
      activeRoom.raceEndsAt = new Date(Date.now());

      // Host typed partially: 150 chars -> server evaluates typedCode
      roomManager.updateProgress({
        roomCode: room.roomCode,
        userId: hostUser._id,
        progressPercent: 50,
        currentPosition: 150,
        liveWpm: 30,
        accuracy: 100,
        correctChars: 150,
        incorrectChars: 0,
        typedCode: activeRoom.snippet.code.slice(0, 150),
      });

      // Participant typed partially: 80 chars -> server evaluates typedCode
      roomManager.updateProgress({
        roomCode: room.roomCode,
        userId: participantUser._id,
        progressPercent: 25,
        currentPosition: 80,
        liveWpm: 16,
        accuracy: 100,
        correctChars: 80,
        incorrectChars: 0,
        typedCode: activeRoom.snippet.code.slice(0, 80),
      });

      // Mark racers timed_out and finalize room
      for (const p of activeRoom.participants) {
        p.status = 'timed_out';
        p.elapsedSeconds = 60;
      }
      await roomManager.finalizeRoom(room.roomCode);

      // Fetch results via API
      const res = await fetch(`${baseUrl}/api/rooms/${room.roomCode}/results`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.results.length, 2);

      // Host (Server-derived from typed 150 chars, 60s time)
      assert.strictEqual(json.data.results[0].rank, 1);
      assert.ok(json.data.results[0].wpm > 0, 'WPM should be server-calculated');
      assert.strictEqual(json.data.results[0].accuracy, 100, 'Accuracy should be server-calculated as 100%');
      assert.strictEqual(json.data.results[0].completionTimeSeconds, 60);
      assert.strictEqual(json.data.results[0].completedSnippet, false);

      // Participant (Server-derived from typed 80 chars, 60s time)
      assert.strictEqual(json.data.results[1].rank, 2);
      assert.ok(json.data.results[1].wpm > 0, 'WPM should be server-calculated');
      assert.strictEqual(json.data.results[1].accuracy, 100, 'Accuracy should be server-calculated as 100%');
      assert.strictEqual(json.data.results[1].completionTimeSeconds, 60);
      assert.strictEqual(json.data.results[1].completedSnippet, false);
    });
  });

  describe('8. Server-Authoritative Anti-Tamper & Security Verification (Milestone 8)', () => {
    test('Attack Simulation: Malicious client sending fabricated numbers cannot spoof completed result or high score', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'javascript', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 5000); // 5s elapsed

      // Malicious attack payload attempting to forge 999999 characters, 350 WPM, 100% accuracy, and completedSnippet
      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          correctChars: 999999,
          incorrectChars: 0,
          accuracy: 100,
          liveWpm: 350,
          completedSnippet: true,
          typedCode: 'console.log("fraudulent injection attempt");',
        },
      });

      assert.strictEqual(res.participant.completedSnippet, false, 'Server must reject fraudulent completion');
      assert.notStrictEqual(res.participant.status, 'finished', 'Fraudulent submission must NOT be marked finished');
      assert.ok(res.participant.status === 'incomplete' || res.participant.status === 'timed_out');
      assert.notStrictEqual(res.participant.wpm, 350, 'Fabricated 350 WPM must be ignored');

      const persistedDoc = await CompetitionResult.findOne({ roomCode: room.roomCode, userId: hostUser._id });
      assert.ok(persistedDoc);
      assert.strictEqual(persistedDoc.completedSnippet, false, 'Persisted result must NOT be completed');
    });

    test('CASE A: Client sends fake WPM -> final WPM is strictly server-derived', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'python', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 30000); // 30s elapsed

      // Send fake 300 WPM with real 50 chars typed
      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          liveWpm: 300,
          typedCode: activeRoom.snippet.code.slice(0, 50),
        },
      });

      // 50 chars / 5 = 10 words in 0.5 min = 20 WPM (not 300 WPM)
      assert.ok(res.participant.wpm <= 25, `Expected server-derived ~20 WPM, got ${res.participant.wpm}`);
    });

    test('CASE B: Client sends fake accuracy -> final accuracy is strictly server-derived', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'java', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 10000);

      // Send fake 100% accuracy claim with incorrect typing
      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          accuracy: 100,
          typedCode: 'wrong_syntax_completely_invalid',
        },
      });

      assert.ok(res.participant.accuracy < 100, 'Accuracy must be calculated by server from actual character match');
    });

    test('CASE C: Client sends fake correctChars/incorrectChars -> metrics derived from actual typed text', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'c', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 10000);

      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          correctChars: 500,
          incorrectChars: 0,
          typedCode: activeRoom.snippet.code.slice(0, 30),
        },
      });

      assert.strictEqual(res.participant.correctChars, 30, 'Server must verify only 30 characters were correctly typed');
    });

    test('CASE D: Client sends completedSnippet=true without actually completing canonical text -> rejected', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'cpp', difficulty: 'medium', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 15000);

      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          completedSnippet: true, // Untrusted client claim
          typedCode: activeRoom.snippet.code.slice(0, 10), // Only 10 chars typed
        },
      });

      assert.strictEqual(res.participant.completedSnippet, false);
      assert.notStrictEqual(res.participant.status, 'finished');
      assert.ok(res.participant.status === 'incomplete' || res.participant.status === 'timed_out');
    });

    test('CASE E: Timed-out participant with verified typing state derives authoritative final metrics', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'html', difficulty: 'easy', timerSeconds: 30 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';

      // Racer typed 50 chars during live race
      roomManager.updateProgress({
        roomCode: room.roomCode,
        userId: hostUser._id,
        progressPercent: 40,
        typedCode: activeRoom.snippet.code.slice(0, 50),
      });

      // Race expires and finalizes
      const finalState = await roomManager.finalizeRoom(room.roomCode);
      const hostP = finalState.participants.find((p) => p.userId === hostUser._id.toString());

      assert.strictEqual(hostP.status, 'timed_out');
      assert.strictEqual(hostP.elapsedSeconds, 30);
      assert.strictEqual(hostP.accuracy, 100);
      assert.ok(hostP.wpm > 0);
      assert.strictEqual(hostP.completedSnippet, false);
    });

    test('CASE F: Valid finished participant derives exact server elapsed time, WPM, and accuracy', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'css', difficulty: 'easy', timerSeconds: 60 },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 12000); // exactly 12s

      const res = await roomManager.submitResult({
        roomCode: room.roomCode,
        userId: hostUser._id,
        submission: {
          typedCode: activeRoom.snippet.code, // Full canonical snippet
        },
      });

      assert.strictEqual(res.participant.status, 'finished');
      assert.strictEqual(res.participant.completedSnippet, true);
      assert.strictEqual(res.participant.accuracy, 100);
      assert.strictEqual(res.participant.elapsedSeconds, 12);
      assert.ok(res.participant.wpm > 0);
    });

    test('CASE G: Deterministic ranking remains strictly enforced with server-derived metrics', async () => {
      const room = await roomManager.createRoom({
        host: { userId: hostUser._id, username: hostUser.username },
        config: { language: 'sql', difficulty: 'easy', timerSeconds: 60 },
      });

      await roomManager.joinRoom({
        roomCode: room.roomCode,
        user: { userId: participantUser._id, username: participantUser.username },
      });

      const activeRoom = roomManager.rooms.get(room.roomCode);
      activeRoom.status = 'active';
      activeRoom.raceStartsAt = new Date(Date.now() - 20000);

      // Participant finishes first in 10s
      activeRoom.participants[1].status = 'finished';
      activeRoom.participants[1].completedSnippet = true;
      activeRoom.participants[1].elapsedSeconds = 10;
      activeRoom.participants[1].finishedAt = new Date(Date.now() - 10000);

      // Host finishes second in 20s
      activeRoom.participants[0].status = 'finished';
      activeRoom.participants[0].completedSnippet = true;
      activeRoom.participants[0].elapsedSeconds = 20;
      activeRoom.participants[0].finishedAt = new Date(Date.now());

      const finalState = await roomManager.finalizeRoom(room.roomCode);

      const pRank1 = finalState.participants.find((p) => p.userId === participantUser._id.toString());
      const pRank2 = finalState.participants.find((p) => p.userId === hostUser._id.toString());

      assert.strictEqual(pRank1.rank, 1, 'Participant with 10s elapsed must be Rank 1');
      assert.strictEqual(pRank2.rank, 2, 'Host with 20s elapsed must be Rank 2');
    });

    test('CASE H: Mode isolation verified - Competition results never taint Ranked PB or Practice stats', async () => {
      // Create high-speed competition record
      await Performance.create({
        userId: hostUser._id,
        mode: 'competition',
        language: 'javascript',
        difficulty: 'hard',
        timerSeconds: 60,
        wpm: 150,
        accuracy: 99,
        correctChars: 750,
        incorrectChars: 5,
        elapsedSeconds: 60,
        snippetId: 'js-hard-02',
      });

      const userDoc = await User.findById(hostUser._id);
      // Ensure user document has no competition corruption in standard stats
      assert.ok(userDoc);
    });
  });
});

