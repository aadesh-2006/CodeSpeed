/**
 * Pure calculation and ergonomics utilities for the CodeSpeed typing engine.
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
 * Analyze code characters to identify string literals, comments, indentation,
 * and optional stylistic whitespace vs structural whitespace.
 *
 * @param {string} code - Target code string
 * @param {string} language - Programming language (e.g. 'java', 'javascript', 'python')
 * @returns {Array<object>} Per-character context info
 */
export function analyzeCodeContext(code, language = '') {
  const len = (code || '').length;
  const context = new Array(len);
  const isPython = (language || '').toLowerCase() === 'python';

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let isLineStart = true;

  for (let i = 0; i < len; i++) {
    const char = code[i];
    const nextChar = i + 1 < len ? code[i + 1] : '';
    const prevChar = i > 0 ? code[i - 1] : '';

    if (char === '\n') {
      inLineComment = false;
      isLineStart = true;
      context[i] = {
        isString: false,
        isComment: false,
        isIndent: false,
        isOptional: false,
      };
      continue;
    }

    // Comment handling
    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (!inLineComment && !inBlockComment) {
        if (char === '/' && nextChar === '/') {
          inLineComment = true;
        } else if (char === '/' && nextChar === '*') {
          inBlockComment = true;
        } else if (char === '#' && isPython) {
          inLineComment = true;
        }
      } else if (inBlockComment && prevChar === '*' && char === '/') {
        inBlockComment = false;
      }
    }

    // String literal handling
    if (!inLineComment && !inBlockComment) {
      if (char === "'" && prevChar !== '\\') {
        if (!inDoubleQuote && !inBacktick) {
          inSingleQuote = !inSingleQuote;
        }
      } else if (char === '"' && prevChar !== '\\') {
        if (!inSingleQuote && !inBacktick) {
          inDoubleQuote = !inDoubleQuote;
        }
      } else if (char === '`' && prevChar !== '\\') {
        if (!inSingleQuote && !inDoubleQuote) {
          inBacktick = !inBacktick;
        }
      }
    }

    const isString = inSingleQuote || inDoubleQuote || inBacktick;
    const isComment = inLineComment || inBlockComment;

    // Leading indentation detection
    let isIndent = false;
    if (isLineStart) {
      if (char === ' ' || char === '\t') {
        isIndent = true;
      } else {
        isLineStart = false;
      }
    }

    // Determine if space is optional / stylistic
    let isOptional = false;
    if (char === ' ' && !isString && !isComment) {
      if (isIndent) {
        // In Python, leading indentation defines block scope and is required.
        // In C-like languages, leading indent is auto-inserted or stylistic.
        isOptional = !isPython;
      } else {
        const prevNonSpace = findPrevNonSpace(code, i);
        const nextNonSpace = findNextNonSpace(code, i);

        if (prevNonSpace && nextNonSpace) {
          const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);
          const isBetweenWords = isWordChar(prevNonSpace) && isWordChar(nextNonSpace);
          isOptional = !isBetweenWords;
        } else {
          isOptional = true;
        }
      }
    }

    context[i] = {
      isString,
      isComment,
      isIndent,
      isOptional,
    };
  }

  return context;
}

function findPrevNonSpace(str, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (str[i] !== ' ' && str[i] !== '\t' && str[i] !== '\n') {
      return str[i];
    }
  }
  return null;
}

function findNextNonSpace(str, index) {
  for (let i = index + 1; i < str.length; i++) {
    if (str[i] !== ' ' && str[i] !== '\t' && str[i] !== '\n') {
      return str[i];
    }
  }
  return null;
}

/**
 * Check if a space typed by the user is an optional stylistic space (e.g. after comma or operator).
 */
function isUserOptionalSpace(typed, index) {
  const prevChar = findPrevNonSpace(typed, index);
  const nextChar = findNextNonSpace(typed, index);
  if (!prevChar || !nextChar) return true;
  const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);
  return !(isWordChar(prevChar) && isWordChar(nextChar));
}

/**
 * Compare user input against target snippet with whitespace tolerance
 * and syntax strictness.
 *
 * @param {string} targetCode - The full code snippet to be typed
 * @param {string} typedCode - The text typed by the user so far
 * @param {object} options - Optional configuration { language }
 * @returns {object} Comparison details: correctCount, incorrectCount, totalTyped, charStatuses, isComplete
 */
export function compareCharacters(targetCode, typedCode, options = {}) {
  const target = targetCode || '';
  const typed = typedCode || '';
  const language = typeof options === 'string' ? options : options?.language || '';

  if (!target) {
    return {
      correctCount: 0,
      incorrectCount: typed.length,
      totalTyped: typed.length,
      currentPosition: 0,
      charStatuses: [],
      isComplete: true,
    };
  }

  const context = analyzeCodeContext(target, language);

  let targetIndex = 0;
  let typedIndex = 0;

  let correctCount = 0;
  let incorrectCount = 0;

  const charStatuses = new Array(target.length);

  while (targetIndex < target.length && typedIndex < typed.length) {
    const tChar = target[targetIndex];
    const uChar = typed[typedIndex];

    // 1. Exact match
    if (tChar === uChar) {
      charStatuses[targetIndex] = { char: tChar, status: 'correct' };
      correctCount++;
      targetIndex++;
      typedIndex++;
      continue;
    }

    // 2. Target has optional whitespace that user skipped
    if (tChar === ' ' && context[targetIndex]?.isOptional) {
      charStatuses[targetIndex] = { char: tChar, status: 'correct' };
      correctCount++;
      targetIndex++;
      continue;
    }

    // 3. User typed an optional whitespace that target did not have
    if (uChar === ' ' && isUserOptionalSpace(typed, typedIndex)) {
      typedIndex++;
      continue;
    }

    // 4. Real mismatch / syntax error
    charStatuses[targetIndex] = {
      char: tChar,
      typedChar: uChar,
      status: 'incorrect',
    };
    incorrectCount++;
    targetIndex++;
    typedIndex++;
  }

  // If user completed typing before target ended, consume any trailing optional spaces
  while (targetIndex < target.length && typedIndex >= typed.length) {
    if (target[targetIndex] === ' ' && context[targetIndex]?.isOptional) {
      charStatuses[targetIndex] = { char: target[targetIndex], status: 'correct' };
      correctCount++;
      targetIndex++;
    } else {
      break;
    }
  }

  const currentPosition = targetIndex;

  // Set current cursor position
  if (targetIndex < target.length) {
    charStatuses[targetIndex] = {
      char: target[targetIndex],
      status: 'current',
    };
  }

  // Mark all remaining characters as 'pending'
  for (let i = targetIndex + 1; i < target.length; i++) {
    if (!charStatuses[i]) {
      charStatuses[i] = {
        char: target[i],
        status: 'pending',
      };
    }
  }

  // Any excess characters typed beyond target length
  if (typedIndex < typed.length) {
    incorrectCount += (typed.length - typedIndex);
  }

  const isComplete =
    charStatuses.length > 0 &&
    charStatuses.every((item) => item && item.status === 'correct') &&
    incorrectCount === 0;

  return {
    correctCount,
    incorrectCount,
    totalTyped: typed.length,
    currentPosition,
    charStatuses,
    isComplete,
  };
}

/**
 * Calculate the expected indentation string for the next line given target code and current typed progress.
 *
 * @param {string} targetCode - The full target code snippet
 * @param {string} currentTypedCode - The code typed up to the newline
 * @param {string} language - The programming language id
 * @returns {string} The whitespace string to indent the next line with
 */
export function getNextLineIndent(targetCode, currentTypedCode, language = '') {
  if (!targetCode) return '';

  const targetLines = targetCode.split('\n');
  const typedLines = (currentTypedCode || '').split('\n');
  const currentLineIndex = typedLines.length - 1;
  const nextLineIndex = currentLineIndex + 1;

  // 1. If target snippet has a next line, extract its leading indentation
  if (nextLineIndex < targetLines.length) {
    const nextTargetLine = targetLines[nextLineIndex];
    const match = nextTargetLine.match(/^[ \t]*/);
    if (match) {
      return match[0];
    }
  }

  // 2. Fallback to syntax-based indentation rule
  return getSyntaxIndentation(currentTypedCode, language);
}

/**
 * Pure rule-based indentation calculator.
 *
 * @param {string} codeSoFar - Code typed so far
 * @param {string} language - Programming language
 * @returns {string} Indentation string
 */
export function getSyntaxIndentation(codeSoFar, language = '') {
  const lang = (language || '').toLowerCase();
  const lines = (codeSoFar || '').split('\n');
  const lastLine = lines[lines.length - 1] || '';
  const trimmed = lastLine.trim();

  const prevIndentMatch = lastLine.match(/^[ \t]*/);
  const prevIndent = prevIndentMatch ? prevIndentMatch[0] : '';
  const indentUnit = '    '; // 4 spaces default

  if (lang === 'python') {
    if (trimmed.endsWith(':')) {
      return prevIndent + indentUnit;
    }
    return prevIndent;
  }

  if (lang === 'html') {
    if (/<[a-zA-Z0-9]+[^>]*[^\/]>/i.test(trimmed) && !/<\/[a-zA-Z0-9]+>/i.test(trimmed)) {
      return prevIndent + indentUnit;
    }
    return prevIndent;
  }

  // C-like languages (Java, C, C++, JavaScript, TypeScript, CSS, SQL)
  let openBraces = 0;
  for (let i = 0; i < (codeSoFar || '').length; i++) {
    if (codeSoFar[i] === '{') openBraces++;
    if (codeSoFar[i] === '}') openBraces--;
  }

  return ' '.repeat(Math.max(0, openBraces) * 4);
}
