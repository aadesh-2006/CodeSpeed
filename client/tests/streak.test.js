import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

describe('StreakCard Component & Flame Icon Frontend Tests', () => {
  let viteServer;
  let StreakCard;
  let FlameIcon;

  before(async () => {
    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    const streakModule = await viteServer.ssrLoadModule('./src/components/StreakCard.jsx');
    StreakCard = streakModule.StreakCard;
    FlameIcon = streakModule.FlameIcon;
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  test('FlameIcon renders SVG with flame-lit class and gradient when lit is true', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(FlameIcon, { lit: true, size: 24 })
    );

    assert.ok(html.includes('<svg'), 'Should render SVG element');
    assert.ok(html.includes('flame-lit'), 'Should include flame-lit class');
    assert.ok(html.includes('flameGradient'), 'Should include flameGradient fill');
    assert.ok(html.includes('width="24"'), 'Should set custom width');
  });

  test('FlameIcon renders SVG with flame-unlit class when lit is false', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(FlameIcon, { lit: false })
    );

    assert.ok(html.includes('<svg'), 'Should render SVG element');
    assert.ok(html.includes('flame-unlit'), 'Should include flame-unlit class');
    assert.ok(!html.includes('flame-lit'), 'Should not include flame-lit class');
  });

  test('StreakCard renders current streak and longest streak metrics with active status when practiced today', () => {
    const mockStreak = {
      currentStreak: 5,
      longestStreak: 12,
      practicedToday: true,
      today: '2026-09-09',
      recentDays: [
        { date: '2026-09-03', dayLabel: 'Thu', practiced: true, isToday: false },
        { date: '2026-09-04', dayLabel: 'Fri', practiced: false, isToday: false },
        { date: '2026-09-05', dayLabel: 'Sat', practiced: true, isToday: false },
        { date: '2026-09-06', dayLabel: 'Sun', practiced: true, isToday: false },
        { date: '2026-09-07', dayLabel: 'Mon', practiced: true, isToday: false },
        { date: '2026-09-08', dayLabel: 'Tue', practiced: true, isToday: false },
        { date: '2026-09-09', dayLabel: 'Wed', practiced: true, isToday: true },
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StreakCard, { streak: mockStreak })
    );

    assert.ok(html.includes('Daily Practice Streak'), 'Should display widget title');
    assert.ok(html.includes('5'), 'Should display current streak of 5');
    assert.ok(html.includes('12'), 'Should display longest streak of 12');
    assert.ok(html.includes('Practiced Today'), 'Should indicate active practiced status');
    assert.ok(html.includes('status-active'), 'Should have status-active class');

    // 7 days rendered
    assert.ok(html.includes('Thu'), 'Should render Thursday day label');
    assert.ok(html.includes('Fri'), 'Should render Friday day label');
    assert.ok(html.includes('Today'), 'Should render Today label for current day');
    assert.ok(html.includes('day-practiced'), 'Should include day-practiced classes');
    assert.ok(html.includes('day-missed'), 'Should include day-missed classes');
  });

  test('StreakCard renders unlit pending state when user has not practiced today', () => {
    const mockStreak = {
      currentStreak: 0,
      longestStreak: 8,
      practicedToday: false,
      today: '2026-09-09',
      recentDays: [
        { date: '2026-09-03', dayLabel: 'Thu', practiced: true, isToday: false },
        { date: '2026-09-04', dayLabel: 'Fri', practiced: true, isToday: false },
        { date: '2026-09-05', dayLabel: 'Sat', practiced: true, isToday: false },
        { date: '2026-09-06', dayLabel: 'Sun', practiced: false, isToday: false },
        { date: '2026-09-07', dayLabel: 'Mon', practiced: true, isToday: false },
        { date: '2026-09-08', dayLabel: 'Tue', practiced: true, isToday: false },
        { date: '2026-09-09', dayLabel: 'Wed', practiced: false, isToday: true },
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StreakCard, { streak: mockStreak })
    );

    assert.ok(html.includes('Not Practiced Today'), 'Should indicate not practiced today');
    assert.ok(html.includes('status-pending'), 'Should have status-pending class');
    assert.ok(html.includes('8'), 'Should display longest streak of 8');
  });

  test('StreakCard handles zero/null streak state without errors', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StreakCard, { streak: null })
    );

    assert.ok(html.includes('Daily Practice Streak'));
    assert.ok(html.includes('Not Practiced Today'));
    assert.ok(html.includes('0'));
  });
});
