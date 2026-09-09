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
  _setAudioBuffer,
  preloadKeyboardSounds,
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

  describe('AudioContext Lifecycle & Sample Preloading', () => {
    test('initAudio returns true and triggers sample preloading', async () => {
      let decodeCount = 0;
      class MockRunningContext {
        constructor() {
          this.state = 'running';
        }
        resume() {
          return Promise.resolve();
        }
        decodeAudioData(buffer) {
          decodeCount++;
          return Promise.resolve({ length: 100 });
        }
      }
      globalThis.window.AudioContext = MockRunningContext;
      globalThis.fetch = () => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      });

      const ready = await initAudio();
      assert.equal(ready, true);
    });

    test('preloadKeyboardSounds fetches and decodes all 5 switch samples into cache', async () => {
      const decodedMap = new Map();
      class MockContext {
        constructor() {
          this.state = 'running';
        }
        decodeAudioData(buf) {
          return Promise.resolve({ length: 44100 * 0.04 });
        }
      }
      globalThis.window.AudioContext = MockContext;
      let fetchCount = 0;
      globalThis.fetch = (url) => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(128)),
        });
      };

      const loaded = await preloadKeyboardSounds();
      assert.equal(loaded, true);
      assert.equal(fetchCount, 5, 'Should fetch all 5 distinct switch samples');
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
        decodeAudioData() {
          return Promise.resolve({});
        }
      }
      globalThis.window.AudioContext = MockSuspendedContext;
      globalThis.fetch = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

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

  describe('playKeySound Sample Playback, Key Mapping & Volume Control', () => {
    const createMockSampleBuffer = (name) => ({ name, duration: 0.045 });

    beforeEach(() => {
      _setAudioBuffer('key-01', createMockSampleBuffer('key-01'));
      _setAudioBuffer('key-02', createMockSampleBuffer('key-02'));
      _setAudioBuffer('space', createMockSampleBuffer('space'));
      _setAudioBuffer('enter', createMockSampleBuffer('enter'));
      _setAudioBuffer('backspace', createMockSampleBuffer('backspace'));
    });

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

    test('playKeySound fails gracefully without error when buffer is not yet loaded', () => {
      _resetAudioContext(); // clears buffers
      class MockContext {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
      }
      globalThis.window.AudioContext = MockContext;
      globalThis.fetch = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

      const played = playKeySound('a');
      assert.equal(played, false);
    });

    test('playKeySound plays sample and routes special keys accurately', () => {
      setSoundEnabled(true);

      const playedBuffers = [];
      let connectedToDest = false;
      let startedSource = false;
      let masterGainValue = null;

      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              if (masterGainValue === null) masterGainValue = val;
            },
          };
        }
        connect(target) {
          if (target === 'DESTINATION') connectedToDest = true;
        }
      }

      class MockBufferSourceNode {
        constructor() {
          this.buffer = null;
          this.playbackRate = {
            setValueAtTime: () => {},
          };
        }
        connect() {}
        start() {
          startedSource = true;
          if (this.buffer) playedBuffers.push(this.buffer.name);
        }
      }

      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.destination = 'DESTINATION';
        }
        createGain() { return new MockGainNode(); }
        createBufferSource() { return new MockBufferSourceNode(); }
      }

      globalThis.window.AudioContext = MockAudioContext;

      // 1. Space key -> space buffer
      playKeySound(' ');
      assert.equal(playedBuffers[playedBuffers.length - 1], 'space');

      // 2. Enter key -> enter buffer
      playKeySound('Enter');
      assert.equal(playedBuffers[playedBuffers.length - 1], 'enter');

      // 3. Backspace key -> backspace buffer
      playKeySound('Backspace');
      assert.equal(playedBuffers[playedBuffers.length - 1], 'backspace');

      // 4. Alphanumerics alternate between key-01 and key-02
      playedBuffers.length = 0;
      playKeySound('h');
      playKeySound('e');
      playKeySound('l');
      playKeySound('l');
      playKeySound('o');
      assert.ok(playedBuffers.includes('key-01'));
      assert.ok(playedBuffers.includes('key-02'));
    });

    test('playKeySound at 0% volume returns false and skips playback', () => {
      setSoundEnabled(true);
      setSoundVolume(0);

      let createdSource = false;
      class MockAudioContext {
        constructor() { this.state = 'running'; }
        createBufferSource() {
          createdSource = true;
          return {};
        }
      }
      globalThis.window.AudioContext = MockAudioContext;

      const success = playKeySound('a');
      assert.equal(success, false);
      assert.equal(createdSource, false);
    });

    test('playKeySound scales gain according to user volume setting (70% and 100%)', () => {
      setSoundEnabled(true);
      let capturedGain = null;

      class MockGainNode {
        constructor() {
          this.gain = {
            setValueAtTime: (val) => {
              capturedGain = val;
            },
          };
        }
        connect() {}
      }

      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.destination = 'DEST';
        }
        createGain() { return new MockGainNode(); }
        createBufferSource() {
          return {
            connect: () => {},
            start: () => {},
            playbackRate: { setValueAtTime: () => {} },
          };
        }
      }

      globalThis.window.AudioContext = MockAudioContext;

      // 100% volume -> ~0.40 (with ±3% micro-jitter)
      setSoundVolume(100);
      playKeySound('a');
      assert.ok(capturedGain >= 0.38 && capturedGain <= 0.42, `Gain at 100% should be ~0.40, got ${capturedGain}`);

      // 50% volume -> ~0.20 (with ±3% micro-jitter)
      setSoundVolume(50);
      playKeySound('a');
      assert.ok(capturedGain >= 0.18 && capturedGain <= 0.22, `Gain at 50% should be ~0.20, got ${capturedGain}`);
    });
  });
});


