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

      // Racer finishes first with 200 correct characters in 10s -> ~240 WPM, 100% accuracy
      const racerSubmit = await new Promise((res) => {
        racerSocket.emit(
          'race:submit',
          {
            code: room.roomCode,
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
    });
  });
});
