/**
 * Pure calculation, indentation, and syntax-aware comparison utilities
 * for the CodeSpeed typing engine.
 *
 * Strictly separates:
 * 1. Editor Indentation (Auto-handled on Enter, does not inflate WPM)
 * 2. Optional Syntax Whitespace (Tolerated around operators, delimiters, braces, etc.)
 * 3. Required Token-Separating Whitespace (Must be typed between lexical tokens/words)
 */

/**
 * Calculate Words Per Minute (WPM).
 * 1 word = 5 characters.
 * WPM = (meaningfulCorrectChars / 5) / elapsedMinutes
 *
 * @param {number} correctChars - Number of meaningful correctly typed characters
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
 * and optional stylistic whitespace vs mandatory token-separating whitespace.
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
        // Leading line indent in C-like languages is handled by editor auto-indent,
        // but in Python leading indentation is structural syntax.
        isOptional = !isPython;
      } else {
        const prevNonSpace = findPrevNonSpace(code, i);
        const nextNonSpace = findNextNonSpace(code, i);

        if (prevNonSpace && nextNonSpace) {
          // Token-separating whitespace: between two word/identifier characters (e.g. "public static", "int x")
          const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);
          const isBetweenWords = isWordChar(prevNonSpace) && isWordChar(nextNonSpace);

          // If between two words/identifiers, it is REQUIRED (NOT optional).
          // If adjacent to operators/delimiters/punctuation (e.g. `+`, `=`, `(`, `)`, `{`, `,`, `;`), it is optional.
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
 * Check if a space typed by the user is an optional stylistic space (e.g. after comma or around operator).
 */
function isUserOptionalSpace(typed, index) {
  const prevChar = findPrevNonSpace(typed, index);
  const nextChar = findNextNonSpace(typed, index);
  if (!prevChar || !nextChar) return true;
  const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);
  // If user typed a space between two words (e.g. "public static"), that's a required space, not optional skipping.
  return !(isWordChar(prevChar) && isWordChar(nextChar));
}

/**
 * Compare user input against target snippet with whitespace tolerance for syntax
 * and strictness for required token-separating spaces.
 *
 * @param {string} targetCode - The full code snippet to be typed
 * @param {string} typedCode - The text typed by the user so far
 * @param {object} options - Optional configuration { language, autoIndentCount }
 * @returns {object} Comparison details: correctCount, meaningfulCorrectCount, incorrectCount, totalTyped, charStatuses, isComplete
 */
export function compareCharacters(targetCode, typedCode, options = {}) {
  const target = targetCode || '';
  const typed = typedCode || '';
  const language = typeof options === 'string' ? options : options?.language || '';

  if (!target) {
    return {
      correctCount: 0,
      meaningfulCorrectCount: 0,
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
  let meaningfulCorrectCount = 0;
  let incorrectCount = 0;

  const charStatuses = new Array(target.length);

  while (targetIndex < target.length && typedIndex < typed.length) {
    const tChar = target[targetIndex];
    const uChar = typed[typedIndex];
    const ctx = context[targetIndex];

    // 1. Exact match
    if (tChar === uChar) {
      charStatuses[targetIndex] = { char: tChar, status: 'correct' };
      correctCount++;
      // Count as meaningful typed character if not auto-indent leading space
      if (!ctx?.isIndent) {
        meaningfulCorrectCount++;
      }
      targetIndex++;
      typedIndex++;
      continue;
    }

    // 2. Target has optional whitespace that user omitted
    // ONLY allowed if ctx.isOptional is TRUE (i.e. NOT between two word tokens, NOT in string, NOT in comment)
    if (tChar === ' ' && ctx?.isOptional) {
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

    // 4. Real mismatch / missing required token-separating space / wrong character
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

  // Set current cursor position in snippet
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
    meaningfulCorrectCount,
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

  // 1. If target snippet has a next line, extract its established leading indentation
  if (nextLineIndex < targetLines.length) {
    const nextTargetLine = targetLines[nextLineIndex];
    const match = nextTargetLine.match(/^[ \t]*/);
    if (match) {
      return match[0];
    }
  }

  // 2. Fallback to syntax-based 2-space indentation rule
  return getSyntaxIndentation(currentTypedCode, language);
}

/**
 * Pure rule-based indentation calculator using 2 spaces per level.
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
  const indentUnit = '  '; // 2 spaces per level

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

  return ' '.repeat(Math.max(0, openBraces) * 2);
}
