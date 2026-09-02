import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWPM,
  calculateAccuracy,
  formatTime,
  compareCharacters,
} from '../src/utils/typingMetrics.js';

describe('Typing Engine Pure Logic Tests', () => {
  describe('calculateWPM', () => {
    test('300 correct characters in 60 seconds equals 60 WPM', () => {
      assert.equal(calculateWPM(300, 60), 60);
    });

    test('150 correct characters in 30 seconds equals 60 WPM', () => {
      assert.equal(calculateWPM(150, 30), 60);
    });

    test('500 correct characters in 120 seconds equals 50 WPM', () => {
      assert.equal(calculateWPM(500, 120), 50);
    });

    test('returns 0 when correct characters is 0 or negative', () => {
      assert.equal(calculateWPM(0, 60), 0);
      assert.equal(calculateWPM(-10, 60), 0);
    });

    test('returns 0 when elapsed seconds is 0 or negative', () => {
      assert.equal(calculateWPM(100, 0), 0);
      assert.equal(calculateWPM(100, -5), 0);
    });

    test('rounds WPM sensibly to nearest integer', () => {
      // 14 correct chars in 20 seconds: (14 / 5) / (20 / 60) = 2.8 / 0.3333 = 8.4 -> 8
      assert.equal(calculateWPM(14, 20), 8);
      // 16 correct chars in 20 seconds: 3.2 / 0.3333 = 9.6 -> 10
      assert.equal(calculateWPM(16, 20), 10);
    });
  });

  describe('calculateAccuracy', () => {
    test('returns 0 when total typed characters is 0', () => {
      assert.equal(calculateAccuracy(0, 0), 0);
    });

    test('returns 100% when all typed characters are correct', () => {
      assert.equal(calculateAccuracy(100, 100), 100);
    });

    test('calculates accuracy percentage rounded to 1 decimal place', () => {
      assert.equal(calculateAccuracy(96, 100), 96);
      assert.equal(calculateAccuracy(487, 505), 96.4);
      assert.equal(calculateAccuracy(48, 50), 96);
    });

    test('returns 0 when 0 correct characters with non-zero typed', () => {
      assert.equal(calculateAccuracy(0, 25), 0);
    });
  });

  describe('formatTime', () => {
    test('formats standard seconds correctly', () => {
      assert.equal(formatTime(30), '00:30');
      assert.equal(formatTime(60), '01:00');
      assert.equal(formatTime(120), '02:00');
      assert.equal(formatTime(180), '03:00');
      assert.equal(formatTime(240), '04:00');
      assert.equal(formatTime(300), '05:00');
      assert.equal(formatTime(600), '10:00');
    });

    test('handles 0 and negative inputs safely', () => {
      assert.equal(formatTime(0), '00:00');
      assert.equal(formatTime(-10), '00:00');
      assert.equal(formatTime(null), '00:00');
    });

    test('formats odd seconds with leading zeros', () => {
      assert.equal(formatTime(5), '00:05');
      assert.equal(formatTime(65), '01:05');
    });
  });

  describe('compareCharacters', () => {
    test('empty typed string has 0 correct, 0 incorrect, and first char is current', () => {
      const target = 'const x = 10;';
      const result = compareCharacters(target, '');
      assert.equal(result.correctCount, 0);
      assert.equal(result.incorrectCount, 0);
      assert.equal(result.totalTyped, 0);
      assert.equal(result.currentPosition, 0);
      assert.equal(result.isComplete, false);
      assert.equal(result.charStatuses[0].status, 'current');
      assert.equal(result.charStatuses[1].status, 'pending');
    });

    test('correct typing tracks correctCount and sets current cursor', () => {
      const target = 'def hello():\n    return True';
      const typed = 'def hello()';
      const result = compareCharacters(target, typed);
      assert.equal(result.correctCount, 11);
      assert.equal(result.incorrectCount, 0);
      assert.equal(result.totalTyped, 11);
      assert.equal(result.currentPosition, 11);
      assert.equal(result.isComplete, false);
      // character at index 11 is ':'
      assert.equal(result.charStatuses[11].char, ':');
      assert.equal(result.charStatuses[11].status, 'current');
    });

    test('incorrect character is flagged as incorrect', () => {
      const target = 'function add(a, b)';
      const typed = 'function adc';
      const result = compareCharacters(target, typed);
      assert.equal(result.correctCount, 11); // "function ad" is 11 chars
      assert.equal(result.incorrectCount, 1); // 'c' instead of 'd'
      assert.equal(result.totalTyped, 12);
      assert.equal(result.charStatuses[11].status, 'incorrect');
    });

    test('correctly counts spaces, newlines, tabs, and symbols', () => {
      const target = 'SELECT * FROM users\nWHERE id = 1;';
      const typed = 'SELECT * FROM users\nWHERE id = 1;';
      const result = compareCharacters(target, typed);
      assert.equal(result.correctCount, target.length);
      assert.equal(result.incorrectCount, 0);
      assert.equal(result.isComplete, true);
    });

    test('handles excess characters typed beyond target length', () => {
      const target = 'abc';
      const typed = 'abcdef';
      const result = compareCharacters(target, typed);
      assert.equal(result.correctCount, 3);
      assert.equal(result.incorrectCount, 3);
      assert.equal(result.totalTyped, 6);
      assert.equal(result.isComplete, false);
    });
  });
});
