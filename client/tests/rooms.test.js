import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

describe('Multiplayer Competition Rooms — Milestone 2 Frontend Tests', () => {
  let viteServer;
  let RoomsHub;
  let RoomView;
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

    test('RoomsHub renders timer duration buttons', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomsHub, { onNavigateToRoom: () => {} })
      );

      assert.ok(html.includes('30s'));
      assert.ok(html.includes('1m'));
      assert.ok(html.includes('2m'));
      assert.ok(html.includes('3m'));
      assert.ok(html.includes('5m'));
    });
  });

  describe('2. RoomView Foundation Component', () => {
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

  describe('3. Socket.IO Client Service Architecture', () => {
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

  describe('4. API Client Room Methods Extension', () => {
    test('api service exposes createRoom, getRoom, and getRoomResults methods', () => {
      assert.strictEqual(typeof api.createRoom, 'function');
      assert.strictEqual(typeof api.getRoom, 'function');
      assert.strictEqual(typeof api.getRoomResults, 'function');
    });
  });
});
