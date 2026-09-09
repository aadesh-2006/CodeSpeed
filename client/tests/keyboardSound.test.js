import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSoundEnabled,
  setSoundEnabled,
  toggleSound,
  getSoundVolume,
  setSoundVolume,
  DEFAULT_SOUND_VOLUME,
  MAX_SAFE_VOLUME,
  getAudioContext,
  _resetAudioContext,
  initAudio,
  resumeAudio,
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
    _resetAudioContext();
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

    test('getSoundVolume defaults to DEFAULT_SOUND_VOLUME (70%) when no volume is saved', () => {
      assert.equal(getSoundVolume(), 70);
      assert.equal(DEFAULT_SOUND_VOLUME, 70);
    });

    test('setSoundVolume saves to storage and clamps within 0-100', () => {
      assert.equal(setSoundVolume(50), 50);
      assert.equal(getSoundVolume(), 50);
      assert.equal(mockStorage.get('codespeed_sound_volume'), '50');

      // Clamping upper bound
      assert.equal(setSoundVolume(150), 100);
      assert.equal(getSoundVolume(), 100);

      // Clamping lower bound
      assert.equal(setSoundVolume(-25), 0);
      assert.equal(getSoundVolume(), 0);

      // Valid boundary values
      assert.equal(setSoundVolume(0), 0);
      assert.equal(getSoundVolume(), 0);
      assert.equal(setSoundVolume(100), 100);
      assert.equal(getSoundVolume(), 100);
    });

    test('getSoundVolume gracefully recovers from malformed localStorage values', () => {
      mockStorage.set('codespeed_sound_volume', 'invalid');
      assert.equal(getSoundVolume(), 70);

      mockStorage.set('codespeed_sound_volume', '999');
      assert.equal(getSoundVolume(), 70);

      mockStorage.set('codespeed_sound_volume', '-5');
      assert.equal(getSoundVolume(), 70);
    });
  });

  describe('AudioContext Lifecycle & initAudio / resumeAudio', () => {
    test('initAudio returns true when AudioContext is running', async () => {
      class MockRunningContext {
        constructor() {
          this.state = 'running';
        }
        resume() {
          return Promise.resolve();
        }
      }
      globalThis.window.AudioContext = MockRunningContext;

      const ready = await initAudio();
      assert.equal(ready, true);
    });

    test('initAudio resumes suspended AudioContext and returns true', async () => {
      let resumed = false;
      class MockSuspendedContext {
        constructor() {
          this.state = 'suspended';
        }
        resume() {
          resumed = true;
          this.state = 'running';
          return Promise.resolve();
        }
      }
      globalThis.window.AudioContext = MockSuspendedContext;

      const ready = await resumeAudio();
      assert.equal(ready, true);
      assert.equal(resumed, true);
    });

    test('initAudio catches resume rejections gracefully without throwing', async () => {
      class MockFailingContext {
        constructor() {
          this.state = 'suspended';
        }
        resume() {
          return Promise.reject(new Error('Autoplay blocked'));
        }
      }
      globalThis.window.AudioContext = MockFailingContext;

      const ready = await initAudio();
      assert.equal(ready, false);
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
      let masterGainValue = null;

      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              if (masterGainValue === null) masterGainValue = val;
            },
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
        masterGainValue = null;

        const success = playKeySound(k);
        assert.equal(success, true, `playKeySound should succeed for key: ${k}`);
        assert.equal(createdOscillator, true, 'Should create body oscillator node');
        assert.equal(createdBuffer, true, 'Should create click noise buffer');
        assert.equal(createdGain, true, 'Should create gain envelopes');
        assert.equal(connectedToDest, true, 'Should connect to master destination');
        // Default 70% volume * 0.40 MAX_SAFE_VOLUME = 0.28
        assert.equal(Math.abs(masterGainValue - 0.28) < 0.0001, true, 'Should default master volume to 0.28 at 70% volume');
      }
    });

    test('playKeySound at 0% volume returns false and skips synthesis', () => {
      setSoundEnabled(true);
      setSoundVolume(0);

      let createdGain = false;
      class MockAudioContext {
        constructor() {
          this.state = 'running';
        }
        createGain() {
          createdGain = true;
          return {};
        }
      }
      globalThis.window.AudioContext = MockAudioContext;

      const success = playKeySound('a');
      assert.equal(success, false);
      assert.equal(createdGain, false);
    });

    test('playKeySound at 100% volume scales to MAX_SAFE_VOLUME (0.40)', () => {
      setSoundEnabled(true);
      setSoundVolume(100);
      assert.equal(MAX_SAFE_VOLUME, 0.40);

      let masterGainVal = null;
      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              if (masterGainVal === null) masterGainVal = val;
            },
            exponentialRampToValueAtTime: () => {},
          };
        }
        connect() {}
        disconnect() {}
      }

      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.sampleRate = 44100;
          this.destination = {};
        }
        createGain() { return new MockGainNode(); }
        createOscillator() {
          return {
            frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            type: 'triangle',
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createBiquadFilter() {
          return {
            frequency: { setValueAtTime: () => {} },
            Q: { setValueAtTime: () => {} },
            connect: () => {},
          };
        }
        createBuffer(c, l, s) {
          return { getChannelData: () => new Float32Array(l) };
        }
        createBufferSource() {
          return { connect: () => {}, start: () => {}, stop: () => {} };
        }
      }

      globalThis.window.AudioContext = MockAudioContext;
      const success = playKeySound('a');
      assert.equal(success, true);
      assert.equal(Math.abs(masterGainVal - 0.40) < 0.0001, true);
    });

    test('playKeySound respects volumePercent option override', () => {
      setSoundEnabled(true);
      setSoundVolume(70);

      let masterGainVal = null;
      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              if (masterGainVal === null) masterGainVal = val;
            },
            exponentialRampToValueAtTime: () => {},
          };
        }
        connect() {}
        disconnect() {}
      }

      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.sampleRate = 44100;
          this.destination = {};
        }
        createGain() { return new MockGainNode(); }
        createOscillator() {
          return {
            frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            type: 'triangle',
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createBiquadFilter() {
          return {
            frequency: { setValueAtTime: () => {} },
            Q: { setValueAtTime: () => {} },
            connect: () => {},
          };
        }
        createBuffer(c, l, s) {
          return { getChannelData: () => new Float32Array(l) };
        }
        createBufferSource() {
          return { connect: () => {}, start: () => {}, stop: () => {} };
        }
      }

      globalThis.window.AudioContext = MockAudioContext;
      // 50% of 0.40 MAX_SAFE_VOLUME = 0.20
      const success = playKeySound('a', { volumePercent: 50 });
      assert.equal(success, true);
      assert.equal(Math.abs(masterGainVal - 0.20) < 0.0001, true);
    });

    test('playKeySound respects custom direct volume override option', () => {
      setSoundEnabled(true);
      let capturedVolume = null;

      class MockCustomGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              if (capturedVolume === null) capturedVolume = val;
            },
            exponentialRampToValueAtTime: () => {},
          };
        }
        connect() {}
        disconnect() {}
      }

      class MockCustomAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.sampleRate = 44100;
          this.destination = 'DESTINATION';
        }
        createGain() { return new MockCustomGainNode(); }
        createOscillator() {
          return {
            frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            type: 'triangle',
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createBiquadFilter() {
          return {
            frequency: { setValueAtTime: () => {} },
            Q: { setValueAtTime: () => {} },
            connect: () => {},
          };
        }
        createBuffer(c, l, s) {
          return { getChannelData: () => new Float32Array(l) };
        }
        createBufferSource() {
          return { connect: () => {}, start: () => {}, stop: () => {} };
        }
      }

      globalThis.window.AudioContext = MockCustomAudioContext;
      const success = playKeySound('x', { volume: 0.15 });
      assert.equal(success, true);
      assert.equal(capturedVolume, 0.15);
    });
  });
});

