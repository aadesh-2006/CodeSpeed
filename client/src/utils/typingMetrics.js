/**
 * Pure calculation utilities for the CodeSpeed typing engine.
 */

/**
 * Calculate Words Per Minute (WPM).
 * 1 word = 5 characters.
 * WPM = (correctCharacters / 5) / elapsedMinutes
 *
 * @param {number} correctChars - Total number of correctly typed characters
 * @param {number} elapsedSeconds - Total elapsed time in seconds
 * @returns {number} Rounded WPM
 */
export function calculateWPM(correctChars, elapsedSeconds) {
  if (!correctChars || correctChars <= 0 || !elapsedSeconds || elapsedSeconds <= 0) {
    return 0;
  }
  const elapsedMinutes = elapsedSeconds / 60;
  const words = correctChars / 5;
  const wpm = words / elapsedMinutes;
  return Math.round(wpm);
}

/**
 * Calculate Accuracy percentage.
 * Accuracy = (correctCharacters / totalTypedCharacters) * 100
 *
 * @param {number} correctChars - Number of correctly typed characters
 * @param {number} totalTypedChars - Total characters typed by user
 * @returns {number} Accuracy percentage rounded to 1 decimal place (e.g. 98.5)
 */
export function calculateAccuracy(correctChars, totalTypedChars) {
  if (!totalTypedChars || totalTypedChars <= 0) {
    return 0;
  }
  if (!correctChars || correctChars <= 0) {
    return 0;
  }
  const rawAccuracy = (correctChars / totalTypedChars) * 100;
  return Math.min(100, Math.round(rawAccuracy * 10) / 10);
}

/**
 * Format seconds into MM:SS string representation.
 *
 * @param {number} totalSeconds - Duration in seconds
 * @returns {string} Formatted string like "05:00" or "00:30"
 */
export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Compare user input against target snippet character-by-character.
 *
 * @param {string} targetCode - The full code snippet to be typed
 * @param {string} typedCode - The text typed by the user so far
 * @returns {object} Comparison details: correctCount, incorrectCount, totalTyped, charStatuses, isComplete
 */
export function compareCharacters(targetCode, typedCode) {
  const target = targetCode || '';
  const typed = typedCode || '';

  let correctCount = 0;
  let incorrectCount = 0;

  const totalTyped = typed.length;
  const currentPosition = typed.length;
  const isComplete = typed.length >= target.length && typed === target;

  const charStatuses = [];
  const maxLength = Math.max(target.length, typed.length);

  for (let i = 0; i < target.length; i++) {
    const targetChar = target[i];
    if (i < typed.length) {
      const typedChar = typed[i];
      if (typedChar === targetChar) {
        correctCount++;
        charStatuses.push({
          char: targetChar,
          status: 'correct',
        });
      } else {
        incorrectCount++;
        charStatuses.push({
          char: targetChar,
          typedChar: typedChar,
          status: 'incorrect',
        });
      }
    } else if (i === currentPosition) {
      charStatuses.push({
        char: targetChar,
        status: 'current',
      });
    } else {
      charStatuses.push({
        char: targetChar,
        status: 'pending',
      });
    }
  }

  // Handle any excess characters typed beyond target length
  if (typed.length > target.length) {
    const extraCount = typed.length - target.length;
    incorrectCount += extraCount;
  }

  return {
    correctCount,
    incorrectCount,
    totalTyped,
    currentPosition,
    charStatuses,
    isComplete,
  };
}
