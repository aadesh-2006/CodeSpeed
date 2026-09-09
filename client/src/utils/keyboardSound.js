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

/**
 * Reset audio context singleton (used in test isolation).
 */
export const _resetAudioContext = () => {
  audioCtx = null;
};

/**
 * Explicitly initialize and/or resume the AudioContext from a user interaction.
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
    return ctx.state === 'running';
  } catch {
    return false;
  }
};

export const resumeAudio = initAudio;

// Subtle frequency variations for keypress acoustic diversity
const KEY_VARIATION_PROFILES = [
  { freqOffset: -12, clickFreq: 2100, gainMod: 0.95 },
  { freqOffset: -4,  clickFreq: 2400, gainMod: 1.00 },
  { freqOffset: 6,   clickFreq: 2250, gainMod: 0.92 },
  { freqOffset: 15,  clickFreq: 2550, gainMod: 1.05 },
];

/**
 * Plays a short, subtle mechanical keyboard switch sound for a typed key.
 *
 * @param {string} key - The key that was typed (e.g. 'a', 'Backspace', 'Enter', ' ')
 * @param {object} options - Optional overrides (e.g. custom volume)
 */
export const playKeySound = (key = '', options = {}) => {
  if (!getSoundEnabled()) return false;

  const volPercent = options.volumePercent !== undefined ? options.volumePercent : getSoundVolume();
  if (volPercent <= 0) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const baseVolume = options.volume !== undefined
      ? options.volume
      : (MAX_SAFE_VOLUME * (volPercent / 100));

    if (baseVolume <= 0) return false;

    // Determine sound profile based on key type
    let startFreq = 420;
    let endFreq = 140;
    let duration = 0.034;
    let clickBandpassFreq = 2300;
    let noiseGainAmount = 0.18;

    if (key === 'Backspace' || key === 'Delete') {
      // Slightly softer, deeper thock
      startFreq = 260;
      endFreq = 110;
      duration = 0.038;
      clickBandpassFreq = 1600;
      noiseGainAmount = 0.14;
    } else if (key === 'Enter') {
      // Deeper stabilizer sound
      startFreq = 320;
      endFreq = 95;
      duration = 0.044;
      clickBandpassFreq = 1800;
      noiseGainAmount = 0.22;
    } else if (key === ' ') {
      // Spacebar stabilizer thock
      startFreq = 340;
      endFreq = 120;
      duration = 0.040;
      clickBandpassFreq = 1950;
      noiseGainAmount = 0.20;
    } else {
      // Standard alphanumeric key with subtle randomized variation
      const profile = KEY_VARIATION_PROFILES[Math.floor(Math.random() * KEY_VARIATION_PROFILES.length)];
      startFreq += profile.freqOffset;
      endFreq += Math.round(profile.freqOffset * 0.4);
      clickBandpassFreq = profile.clickFreq;
      noiseGainAmount *= profile.gainMod;
    }

    // Master gain for this keypress
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(baseVolume, now);
    masterGain.connect(ctx.destination);

    // 1. High-frequency click transient (switch mechanism click)
    const bufferSize = Math.floor(ctx.sampleRate * 0.012); // 12ms noise buffer
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(clickBandpassFreq, now);
    noiseFilter.Q.setValueAtTime(3.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(noiseGainAmount, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + 0.015);

    // 2. Low-mid resonant body oscillator (keycap + switch bottom-out "thock")
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.50, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.005);

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
  playKeySound,
};
