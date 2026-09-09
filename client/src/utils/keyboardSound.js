/**
 * High-performance Web Audio API mechanical keyboard sound synthesizer.
 * Generates crisp, subtle mechanical switch sounds without external audio assets.
 */

const STORAGE_KEY = 'codespeed_sound_enabled';
const VOLUME_STORAGE_KEY = 'codespeed_sound_volume';

export const DEFAULT_SOUND_VOLUME = 70;
export const MAX_SAFE_VOLUME = 0.40;

// Singleton AudioContext reference
let audioCtx = null;

/**
 * Check if sound is enabled (defaults to true).
 */
export const getSoundEnabled = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
};

/**
 * Set sound enabled state and persist to localStorage.
 */
export const setSoundEnabled = (enabled) => {
  const state = Boolean(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(state));
    } catch {
      // Ignore localStorage errors (e.g. private mode quota)
    }
  }
  return state;
};

/**
 * Toggle sound enabled state.
 */
export const toggleSound = () => {
  const next = !getSoundEnabled();
  return setSoundEnabled(next);
};

/**
 * Get sound volume level (0 - 100, defaults to 70).
 */
export const getSoundVolume = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SOUND_VOLUME;
  }
  try {
    const saved = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved === null) return DEFAULT_SOUND_VOLUME;
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= 0 && parsed <= 100 ? parsed : DEFAULT_SOUND_VOLUME;
  } catch {
    return DEFAULT_SOUND_VOLUME;
  }
};

/**
 * Set sound volume level (0 - 100) and persist to localStorage.
 */
export const setSoundVolume = (vol) => {
  const num = Number(vol);
  const clamped = Math.max(0, Math.min(100, isNaN(num) ? DEFAULT_SOUND_VOLUME : Math.round(num)));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore localStorage errors
    }
  }
  return clamped;
};

/**
 * Lazily initialize and return the AudioContext singleton.
 */
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx || audioCtx.state === 'closed' || !(audioCtx instanceof AudioContextClass)) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
};

// In-memory decoded AudioBuffer cache
const audioBuffers = new Map();
let isPreloading = false;

// Sample file definitions (located in public/sounds/keyboard/)
const SAMPLE_FILES = {
  'key-01': '/sounds/keyboard/key-01.wav',
  'key-02': '/sounds/keyboard/key-02.wav',
  'space': '/sounds/keyboard/space.wav',
  'enter': '/sounds/keyboard/enter.wav',
  'backspace': '/sounds/keyboard/backspace.wav',
};

// Round-robin counter for alphanumeric keys
let alphaKeyCounter = 0;

/**
 * Preload and decode all mechanical keyboard audio samples into memory.
 * Safe to call multiple times; returns cached promise if already preloading.
 */
export const preloadKeyboardSounds = async () => {
  if (typeof window === 'undefined') return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  if (audioBuffers.size >= Object.keys(SAMPLE_FILES).length) {
    return true;
  }

  if (isPreloading) return true;
  isPreloading = true;

  try {
    const loadPromises = Object.entries(SAMPLE_FILES).map(async ([key, url]) => {
      if (audioBuffers.has(key)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        audioBuffers.set(key, decoded);
      } catch {
        // Silently handle individual sample load/decode failure
      }
    });

    await Promise.all(loadPromises);
    return audioBuffers.size > 0;
  } catch {
    return false;
  } finally {
    isPreloading = false;
  }
};

/**
 * Explicitly initialize and/or resume the AudioContext from a user interaction
 * and preload the audio buffers.
 * Returns a Promise that resolves to true if running.
 */
export const initAudio = async () => {
  if (typeof window === 'undefined') return false;
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Trigger sample preloading in background
    preloadKeyboardSounds().catch(() => {});

    return ctx.state === 'running';
  } catch {
    return false;
  }
};

export const resumeAudio = initAudio;

/**
 * Reset audio context and buffer cache (used in test isolation).
 */
export const _resetAudioContext = () => {
  audioCtx = null;
  audioBuffers.clear();
  isPreloading = false;
  alphaKeyCounter = 0;
};

/**
 * Injects a pre-decoded AudioBuffer into the cache (used for tests).
 */
export const _setAudioBuffer = (key, buffer) => {
  audioBuffers.set(key, buffer);
};

/**
 * Plays an authentic mechanical keyboard switch sound for a typed key.
 *
 * @param {string} key - The key that was typed (e.g. 'a', 'Backspace', 'Enter', ' ')
 * @param {object} options - Optional overrides (e.g. custom volume, volumePercent)
 */
export const playKeySound = (key = '', options = {}) => {
  if (!getSoundEnabled()) return false;

  const volPercent = options.volumePercent !== undefined ? options.volumePercent : getSoundVolume();
  if (volPercent <= 0) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  // Determine sound sample key based on key type
  let sampleKey = 'key-01';
  if (key === ' ' || key === 'Spacebar' || key === 'Space') {
    sampleKey = 'space';
  } else if (key === 'Enter') {
    sampleKey = 'enter';
  } else if (key === 'Backspace' || key === 'Delete') {
    sampleKey = 'backspace';
  } else {
    // Alternate between key-01 and key-02 for organic typing acoustic diversity
    alphaKeyCounter = (alphaKeyCounter + 1) % 2;
    sampleKey = alphaKeyCounter === 0 ? 'key-01' : 'key-02';
  }

  const buffer = audioBuffers.get(sampleKey) || audioBuffers.get('key-01');
  if (!buffer) {
    // If buffers are not loaded yet, initiate background preload and skip gracefully
    preloadKeyboardSounds().catch(() => {});
    return false;
  }

  try {
    const now = ctx.currentTime;

    // Subtle micro-dynamics and pitch variation to prevent "machine gun" effect
    const pitchJitter = 1.0 + (Math.random() * 0.06 - 0.03); // ±3% pitch
    const gainJitter = 1.0 + (Math.random() * 0.06 - 0.03);  // ±3% gain

    const baseVolume = (options.volume !== undefined
      ? options.volume
      : (MAX_SAFE_VOLUME * (volPercent / 100))) * gainJitter;

    if (baseVolume <= 0) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (source.playbackRate && source.playbackRate.setValueAtTime) {
      source.playbackRate.setValueAtTime(pitchJitter, now);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(baseVolume, now);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(now);

    return true;
  } catch {
    return false;
  }
};

export default {
  getSoundEnabled,
  setSoundEnabled,
  toggleSound,
  getSoundVolume,
  setSoundVolume,
  DEFAULT_SOUND_VOLUME,
  MAX_SAFE_VOLUME,
  getAudioContext,
  initAudio,
  resumeAudio,
  preloadKeyboardSounds,
  playKeySound,
};
