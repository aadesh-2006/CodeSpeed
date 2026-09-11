import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

describe('Multiplayer Competition Rooms — Milestone 2 & 3 Frontend Tests', () => {
  let viteServer;
  let RoomsHub;
  let RoomView;
  let RoomLobby;
  let socketService;
  let api;

  before(async () => {
    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    const roomsHubModule = await viteServer.ssrLoadModule('./src/components/rooms/RoomsHub.jsx');
    RoomsHub = roomsHubModule.RoomsHub || roomsHubModule.default;

    const roomViewModule = await viteServer.ssrLoadModule('./src/components/rooms/RoomView.jsx');
    RoomView = roomViewModule.RoomView || roomViewModule.default;

    const roomLobbyModule = await viteServer.ssrLoadModule('./src/components/rooms/RoomLobby.jsx');
    RoomLobby = roomLobbyModule.RoomLobby || roomLobbyModule.default;

    const socketModule = await viteServer.ssrLoadModule('./src/services/socket.js');
    socketService = socketModule.default || socketModule;

    const apiModule = await viteServer.ssrLoadModule('./src/services/api.js');
    api = apiModule.api || apiModule.default;
  });

  after(async () => {
    if (socketService) {
      socketService.disconnectSocket();
    }
    if (viteServer) {
      await viteServer.close();
    }
  });

  describe('1. RoomsHub Component Rendering & Form Controls', () => {
    test('RoomsHub renders Create Room form and Join Room panel cleanly', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomsHub, { onNavigateToRoom: () => {} })
      );

      // Verify header
      assert.ok(html.includes('Competition Rooms'));
      assert.ok(html.includes('MULTIPLAYER COMPETITION'));

      // Verify Create Room controls
      assert.ok(html.includes('Create a Room'));
      assert.ok(html.includes('Programming Language'));
      assert.ok(html.includes('Difficulty Level'));
      assert.ok(html.includes('Timer Duration'));
      assert.ok(html.includes('Create Competition Room'));

      // Verify Join Room controls
      assert.ok(html.includes('Join Existing Room'));
      assert.ok(html.includes('Room Code'));
      assert.ok(html.includes('Enter Room'));
      assert.ok(html.includes('How It Works'));
    });

    test('RoomsHub renders all 8 supported languages in dropdown', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomsHub, { onNavigateToRoom: () => {} })
      );

      const languages = [
        'JavaScript',
        'Python',
        'Java',
        'C++',
        'C',
        'HTML',
        'CSS',
        'SQL',
      ];

      for (const lang of languages) {
        assert.ok(html.includes(lang), `Expected language '${lang}' in dropdown`);
      }
    });

    test('RoomsHub renders all 3 canonical difficulty levels', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomsHub, { onNavigateToRoom: () => {} })
      );

      assert.ok(html.includes('Easy'));
      assert.ok(html.includes('Medium'));
      assert.ok(html.includes('Hard'));
    });

    test('RoomsHub renders all 7 canonical timer duration buttons (30s, 1m, 2m, 3m, 4m, 5m, 10m)', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomsHub, { onNavigateToRoom: () => {} })
      );

      assert.ok(html.includes('30s'));
      assert.ok(html.includes('1m'));
      assert.ok(html.includes('2m'));
      assert.ok(html.includes('3m'));
      assert.ok(html.includes('4m'));
      assert.ok(html.includes('5m'));
      assert.ok(html.includes('10m'));
    });
  });

  describe('2. RoomLobby Component Rendering & Roster Details', () => {
    const mockRoom = {
      roomCode: 'FAST99',
      hostId: 'user-123',
      hostUsername: 'SpeedHost',
      status: 'waiting',
      config: {
        language: 'python',
        difficulty: 'hard',
        timerSeconds: 120,
      },
      participants: [
        { userId: 'user-123', username: 'SpeedHost', profilePhoto: null, isHost: true },
        { userId: 'user-456', username: 'ChallengerOne', profilePhoto: null, isHost: false },
        { userId: 'user-789', username: 'CodeNinja', profilePhoto: 'https://example.com/p.jpg', isHost: false },
      ],
    };

    test('renders room code, copy button, leave room button, and participant count', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: mockRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('FAST99'), 'Room code must be rendered');
      assert.ok(html.includes('Copy'), 'Copy button must be rendered');
      assert.ok(html.includes('Leave Room'), 'Leave Room button must be rendered');
      assert.ok(html.includes('Participants'), 'Participants header must be rendered');
      assert.ok(html.includes('3'), 'Participant count badge must show 3');
      assert.ok(html.includes('SpeedHost'), 'Host username must be rendered');
      assert.ok(html.includes('ChallengerOne'), 'Challenger username must be rendered');
      assert.ok(html.includes('CodeNinja'), 'Third participant username must be rendered');
    });

    test('displays HOST and YOU badges correctly for host user', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: mockRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('badge-participant-host'), 'Host badge class must be present');
      assert.ok(html.includes('badge-participant-you'), 'You badge class must be present');
      assert.ok(html.includes('Start Competition'), 'Host should see Start Competition button');
    });

    test('displays YOU badge correctly on non-host participant', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: mockRoom,
          currentUser: { id: 'user-456', username: 'ChallengerOne' },
          isHost: false,
        })
      );

      assert.ok(html.includes('badge-participant-host'), 'Host badge class must be present on SpeedHost');
      assert.ok(html.includes('badge-participant-you'), 'You badge class must be present on ChallengerOne');
      assert.ok(html.includes('Waiting for host'), 'Non-host should see waiting notice');
      assert.ok(!html.includes('btn-start-competition'), 'Non-host should not see Start button');
    });

    test('renders interactive form controls when user is host in waiting status', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: mockRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('lobby-lang-select'), 'Host should have interactive language select');
      assert.ok(html.includes('btn-group-pill'), 'Host should have difficulty & timer pill buttons');
      assert.ok(html.includes('Start Competition'), 'Host should have Start Competition button');
      // Verify all 7 timer buttons are present
      assert.ok(html.includes('30s'));
      assert.ok(html.includes('1m'));
      assert.ok(html.includes('2m'));
      assert.ok(html.includes('3m'));
      assert.ok(html.includes('4m'));
      assert.ok(html.includes('5m'));
      assert.ok(html.includes('10m'));
    });

    test('renders read-only badges when user is not host', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: mockRoom,
          currentUser: { id: 'user-456', username: 'ChallengerOne' },
          isHost: false,
        })
      );

      assert.ok(html.includes('config-readonly-badge'), 'Non-host should see read-only badges');
      assert.ok(!html.includes('<select'), 'Non-host should not have language select dropdown');
      assert.ok(html.includes('Python'), 'Language name should be displayed');
      assert.ok(html.includes('Hard'), 'Difficulty name should be displayed');
      assert.ok(html.includes('2 minutes'), 'Timer duration should be displayed');
    });

    test('renders countdown transition state when room status is countdown', () => {
      const countdownRoom = {
        ...mockRoom,
        status: 'countdown',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: countdownRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('STARTING COMPETITION'));
      assert.ok(html.includes('Match Starting'));
      assert.ok(html.includes('Synchronizing code challenge across all participants'));
    });

    test('renders active transition state when room status is active', () => {
      const activeRoom = {
        ...mockRoom,
        status: 'active',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: activeRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('RACE IN PROGRESS'));
      assert.ok(html.includes('Competition Active'));
    });

    test('renders finished transition state when room status is finished', () => {
      const finishedRoom = {
        ...mockRoom,
        status: 'finished',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: finishedRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('COMPETITION FINISHED'));
      assert.ok(html.includes('Match Concluded'));
    });

    test('renders cancelled state when room status is cancelled', () => {
      const cancelledRoom = {
        ...mockRoom,
        status: 'cancelled',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomLobby, {
          room: cancelledRoom,
          currentUser: { id: 'user-123', username: 'SpeedHost' },
          isHost: true,
        })
      );

      assert.ok(html.includes('ROOM CANCELLED'));
      assert.ok(html.includes('Return to Rooms Hub'));
    });
  });

  describe('3. RoomView Container Component', () => {
    test('RoomView renders loading state initially with roomCode', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomView, { roomCode: 'ABC123' })
      );

      assert.ok(html.includes('ABC123'));
      assert.ok(html.includes('Connecting to Room'));
    });

    test('RoomView handles missing room code gracefully', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomView, { roomCode: '' })
      );

      assert.ok(html.includes('Connecting to Room') || html.includes('ROOM ERROR') || html.includes('ROOM READY'));
    });
  });

  describe('4. Socket.IO Client Service Architecture', () => {
    test('connectSocket returns null when unauthenticated without active token', () => {
      const socket = socketService.connectSocket();
      assert.strictEqual(socket, null);
      assert.strictEqual(socketService.isSocketConnected(), false);
    });

    test('disconnectSocket cleans up socket instance cleanly', () => {
      socketService.disconnectSocket();
      assert.strictEqual(socketService.isSocketConnected(), false);
    });
  });

  describe('5. API Client Room Methods Extension', () => {
    test('api service exposes createRoom, getRoom, and getRoomResults methods', () => {
      assert.strictEqual(typeof api.createRoom, 'function');
      assert.strictEqual(typeof api.getRoom, 'function');
      assert.strictEqual(typeof api.getRoomResults, 'function');
    });
  });
});

