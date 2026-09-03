import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateYBounds,
  computePointCoordinates,
  generateLinePath,
  generateAreaPath,
} from '../src/utils/graphMetrics.js';

describe('WPM Progression Graph Pure Logic Tests', () => {
  describe('calculateYBounds', () => {
    test('returns sensible defaults for empty data', () => {
      const bounds = calculateYBounds([]);
      assert.equal(bounds.minY, 0);
      assert.equal(bounds.maxY, 100);
      assert.ok(bounds.ticks.length >= 4);
    });

    test('dynamically scales bounds for low WPM values (e.g. 15-30 WPM)', () => {
      const data = [{ wpm: 15 }, { wpm: 25 }, { wpm: 30 }];
      const bounds = calculateYBounds(data);
      assert.ok(bounds.minY <= 15);
      assert.ok(bounds.maxY >= 30);
      assert.ok(bounds.ticks.includes(bounds.minY));
      assert.ok(bounds.ticks.includes(bounds.maxY));
    });

    test('dynamically scales bounds for high WPM values (e.g. 110-140 WPM)', () => {
      const data = [{ wpm: 110 }, { wpm: 125 }, { wpm: 140 }];
      const bounds = calculateYBounds(data);
      assert.ok(bounds.minY <= 110);
      assert.ok(bounds.maxY >= 140);
      assert.ok(bounds.ticks.length >= 4);
    });

    test('creates padded bounds and dynamic ticks for single-point dataset', () => {
      const data = [{ wpm: 75 }];
      const bounds = calculateYBounds(data);
      assert.ok(bounds.minY < 75);
      assert.ok(bounds.maxY > 75);
      assert.ok(bounds.ticks.length >= 4);
    });
  });

  describe('computePointCoordinates', () => {
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };
    const width = 800;
    const height = 280;
    const yBounds = { minY: 50, maxY: 100, ticks: [50, 60, 70, 80, 90, 100] };

    test('returns empty array for empty data', () => {
      const pts = computePointCoordinates([], width, height, padding, yBounds);
      assert.deepEqual(pts, []);
    });

    test('centers single point horizontally in canvas', () => {
      const data = [{ attemptNumber: 1, wpm: 75 }];
      const pts = computePointCoordinates(data, width, height, padding, yBounds);
      assert.equal(pts.length, 1);
      const expectedX = padding.left + (width - padding.left - padding.right) / 2;
      assert.equal(pts[0].x, expectedX);
      assert.ok(pts[0].y >= padding.top && pts[0].y <= height - padding.bottom);
    });

    test('distributes multiple points evenly from left to right padding bounds', () => {
      const data = [
        { attemptNumber: 1, wpm: 60 },
        { attemptNumber: 2, wpm: 80 },
        { attemptNumber: 3, wpm: 100 },
      ];
      const pts = computePointCoordinates(data, width, height, padding, yBounds);
      assert.equal(pts.length, 3);
      assert.equal(pts[0].x, padding.left);
      assert.equal(pts[2].x, width - padding.right);
      // Higher WPM has smaller Y in SVG coordinate space
      assert.ok(pts[2].y < pts[1].y);
      assert.ok(pts[1].y < pts[0].y);
    });
  });

  describe('generateLinePath & generateAreaPath', () => {
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };
    const height = 280;
    const points = [
      { x: 45, y: 200 },
      { x: 400, y: 150 },
      { x: 770, y: 50 },
    ];

    test('generateLinePath returns SVG M and L commands connecting all points', () => {
      const path = generateLinePath(points);
      assert.ok(path.startsWith('M 45.00 200.00'));
      assert.ok(path.includes('L 400.00 150.00'));
      assert.ok(path.includes('L 770.00 50.00'));
    });

    test('generateAreaPath closes down to baseline for gradient fill', () => {
      const area = generateAreaPath(points, height, padding);
      const baseY = (height - padding.bottom).toFixed(2);
      assert.ok(area.startsWith('M 45.00 200.00'));
      assert.ok(area.endsWith(`L 770.00 ${baseY} L 45.00 ${baseY} Z`));
    });

    test('returns empty string for datasets with less than 2 points', () => {
      assert.equal(generateLinePath([]), '');
      assert.equal(generateLinePath([{ x: 45, y: 100 }]), '');
      assert.equal(generateAreaPath([{ x: 45, y: 100 }], height, padding), '');
    });
  });
});
