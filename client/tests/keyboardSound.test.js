import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSoundEnabled,
  setSoundEnabled,
  toggleSound,
  playKeySound,
} from '../src/utils/keyboardSound.js';

describe('Mechanical Keyboard Sound Utility Tests', () => {
  // Mock localStorage for node environment
  const mockStorage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStorage.get(key) ?? null,
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
  };

  beforeEach(() => {
    mockStorage.clear();
  });

  describe('Sound Preference State & Persistence', () => {
    test('getSoundEnabled defaults to true when no preference is saved', () => {
      assert.equal(getSoundEnabled(), true);
    });

    test('setSoundEnabled(false) saves to storage and returns false', () => {
      const result = setSoundEnabled(false);
      assert.equal(result, false);
      assert.equal(getSoundEnabled(), false);
      assert.equal(mockStorage.get('codespeed_sound_enabled'), 'false');
    });

    test('setSoundEnabled(true) saves to storage and returns true', () => {
      setSoundEnabled(false);
      const result = setSoundEnabled(true);
      assert.equal(result, true);
      assert.equal(getSoundEnabled(), true);
      assert.equal(mockStorage.get('codespeed_sound_enabled'), 'true');
    });

    test('toggleSound cleanly flips between true and false', () => {
      setSoundEnabled(true);
      assert.equal(toggleSound(), false);
      assert.equal(getSoundEnabled(), false);
      assert.equal(toggleSound(), true);
      assert.equal(getSoundEnabled(), true);
    });
  });

  describe('playKeySound Execution & Graceful Fallback', () => {
    test('playKeySound returns false immediately when sound is disabled', () => {
      setSoundEnabled(false);
      const played = playKeySound('a');
      assert.equal(played, false);
    });

    test('playKeySound fails silently and returns false when AudioContext is unavailable', () => {
      setSoundEnabled(true);
      globalThis.window.AudioContext = undefined;
      globalThis.window.webkitAudioContext = undefined;

      assert.doesNotThrow(() => {
        const played = playKeySound('a');
        assert.equal(played, false);
      });
    });

    test('playKeySound synthesizes audio graph correctly when AudioContext is available', () => {
      setSoundEnabled(true);

      let createdOscillator = false;
      let createdGain = false;
      let createdBuffer = false;
      let connectedToDest = false;

      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          };
        }
        connect(target) {
          if (target === 'DESTINATION') connectedToDest = true;
        }
        disconnect() {}
      }

      class MockOscillatorNode {
        constructor() {
          this.frequency = {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          };
          this.type = 'sine';
        }
        connect() {}
        disconnect() {}
        start() {}
        stop() {}
      }

      class MockBiquadFilterNode {
        constructor() {
          this.frequency = { setValueAtTime: () => {} };
          this.Q = { setValueAtTime: () => {} };
          this.type = 'bandpass';
        }
        connect() {}
        disconnect() {}
      }

      class MockAudioBufferSourceNode {
        constructor() {
          this.buffer = null;
        }
        connect() {}
        start() {}
        stop() {}
      }

      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.sampleRate = 44100;
          this.destination = 'DESTINATION';
        }
        createGain() {
          createdGain = true;
          return new MockGainNode();
        }
        createOscillator() {
          createdOscillator = true;
          return new MockOscillatorNode();
        }
        createBiquadFilter() {
          return new MockBiquadFilterNode();
        }
        createBuffer(channels, length, sampleRate) {
          createdBuffer = true;
          return {
            getChannelData: () => new Float32Array(length),
          };
        }
        createBufferSource() {
          return new MockAudioBufferSourceNode();
        }
        resume() {
          return Promise.resolve();
        }
      }

      globalThis.window.AudioContext = MockAudioContext;

      // Test key variations
      const testKeys = ['a', 'Backspace', 'Enter', ' ', 'Tab', '1', ';'];
      for (const k of testKeys) {
        createdOscillator = false;
        createdGain = false;
        createdBuffer = false;
        connectedToDest = false;

        const success = playKeySound(k);
        assert.equal(success, true, `playKeySound should succeed for key: ${k}`);
        assert.equal(createdOscillator, true, 'Should create body oscillator node');
        assert.equal(createdBuffer, true, 'Should create click noise buffer');
        assert.equal(createdGain, true, 'Should create gain envelopes');
        assert.equal(connectedToDest, true, 'Should connect to master destination');
      }
    });
  });
});
