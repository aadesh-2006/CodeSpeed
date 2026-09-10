import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

describe('ActivityHeatmap & StreakCard Frontend Component Tests', () => {
  let viteServer;
  let StreakCard;
  let ActivityHeatmap;
  let FlameIcon;
  let getIntensityLevel;
  let formatHeatmapDate;

  before(async () => {
    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    const streakModule = await viteServer.ssrLoadModule('./src/components/StreakCard.jsx');
    StreakCard = streakModule.StreakCard;
    ActivityHeatmap = streakModule.ActivityHeatmap;
    FlameIcon = streakModule.FlameIcon;
    getIntensityLevel = streakModule.getIntensityLevel;
    formatHeatmapDate = streakModule.formatHeatmapDate;
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  test('getIntensityLevel correctly maps test counts to levels (0 to 5)', () => {
    assert.equal(getIntensityLevel(0), 0);
    assert.equal(getIntensityLevel(null), 0);
    assert.equal(getIntensityLevel(undefined), 0);
    assert.equal(getIntensityLevel(-3), 0);

    // Level 1: 1 test/day
    assert.equal(getIntensityLevel(1), 1);

    // Level 2: 2–3 tests/day
    assert.equal(getIntensityLevel(2), 2);
    assert.equal(getIntensityLevel(3), 2);

    // Level 3: 4–7 tests/day
    assert.equal(getIntensityLevel(4), 3);
    assert.equal(getIntensityLevel(7), 3);

    // Level 4: 8–15 tests/day
    assert.equal(getIntensityLevel(8), 4);
    assert.equal(getIntensityLevel(15), 4);

    // Level 5: 16+ tests/day
    assert.equal(getIntensityLevel(16), 5);
    assert.equal(getIntensityLevel(30), 5);
  });

  test('formatHeatmapDate correctly formats YYYY-MM-DD strings', () => {
    assert.equal(formatHeatmapDate('2026-09-10'), 'Sep 10, 2026');
    assert.equal(formatHeatmapDate('2026-01-01'), 'Jan 1, 2026');
    assert.equal(formatHeatmapDate('2026-12-31'), 'Dec 31, 2026');
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

  test('ActivityHeatmap renders 52-week calendar grid with month labels, tooltips, and intensity levels', () => {
    const mockStreak = {
      currentStreak: 5,
      longestStreak: 12,
      activeToday: true,
      today: '2026-09-09',
      dailyActivity: [
        { date: '2026-09-05', testCount: 1 },  // level 1
        { date: '2026-09-06', testCount: 3 },  // level 2
        { date: '2026-09-07', testCount: 6 },  // level 3
        { date: '2026-09-08', testCount: 10 }, // level 4
        { date: '2026-09-09', testCount: 18 }, // level 5 (today)
      ],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ActivityHeatmap, { streak: mockStreak })
    );

    assert.ok(html.includes('Daily Streak'), 'Should display widget title');
    assert.ok(html.includes('5'), 'Should display current streak of 5');
    assert.ok(html.includes('12'), 'Should display longest streak of 12');
    assert.ok(html.includes('Active Today'), 'Should indicate active status');
    assert.ok(html.includes('status-active'), 'Should have status-active class');

    // 38 tests total in the year
    assert.ok(html.includes('38 tests completed in the last year'), 'Should show total tests in last year');

    // Level classes
    assert.ok(html.includes('level-1'), 'Should contain level-1 cell');
    assert.ok(html.includes('level-2'), 'Should contain level-2 cell');
    assert.ok(html.includes('level-3'), 'Should contain level-3 cell');
    assert.ok(html.includes('level-4'), 'Should contain level-4 cell');
    assert.ok(html.includes('level-5'), 'Should contain level-5 cell');

    // Today indicator
    assert.ok(html.includes('cell-today'), 'Should highlight today cell');

    // Tooltips
    assert.ok(html.includes('Sep 9, 2026 — 18 tests (Today)'), 'Should contain tooltip for today');
    assert.ok(html.includes('Sep 5, 2026 — 1 test'), 'Should contain tooltip for 1 test');

    // Weekday labels
    assert.ok(html.includes('Mon'), 'Should render Mon weekday label');
    assert.ok(html.includes('Wed'), 'Should render Wed weekday label');
    assert.ok(html.includes('Fri'), 'Should render Fri weekday label');

    // Legend
    assert.ok(html.includes('heatmap-legend'), 'Should render heatmap legend');
    assert.ok(html.includes('Less'), 'Should include Less label');
    assert.ok(html.includes('More'), 'Should include More label');
  });

  test('StreakCard alias works identically and handles pending streak', () => {
    const mockStreak = {
      currentStreak: 0,
      longestStreak: 8,
      activeToday: false,
      today: '2026-09-09',
      dailyActivity: [],
    };

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StreakCard, { streak: mockStreak })
    );

    assert.ok(html.includes('Not Active Today'), 'Should indicate not active today');
    assert.ok(html.includes('status-pending'), 'Should have status-pending class');
    assert.ok(html.includes('8'), 'Should display longest streak of 8');
    assert.ok(html.includes('0 tests completed in the last year'), 'Should show 0 tests');
  });

  test('StreakCard handles null/undefined streak state gracefully', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StreakCard, { streak: null })
    );

    assert.ok(html.includes('Daily Streak'));
    assert.ok(html.includes('Not Active Today'));
    assert.ok(html.includes('0'));
    assert.ok(html.includes('heatmap-weeks-grid'));
  });
});

