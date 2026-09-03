import Performance, {
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  VALID_TIMERS,
} from '../models/Performance.js';

export const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  wpm_desc: { wpm: -1, createdAt: -1 },
  wpm_asc: { wpm: 1, createdAt: -1 },
};

/**
 * Controller to record a completed typing performance.
 * Derives user identity exclusively from verified JWT (req.user.id).
 * Independently validates all fields before persistence.
 */
export const createPerformance = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const {
      language,
      difficulty,
      timerSeconds,
      wpm,
      accuracy,
      correctChars,
      incorrectChars,
      elapsedSeconds,
      snippetId,
    } = req.body || {};

    // 1. Validate language
    if (typeof language !== 'string' || !language.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid programming language string is required.',
      });
    }
    const normLang = language.toLowerCase().trim();
    if (!SUPPORTED_LANGUAGES.includes(normLang)) {
      return res.status(400).json({
        status: 'error',
        message: `Unsupported language: '${language}'. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }

    // 2. Validate difficulty
    if (typeof difficulty !== 'string' || !difficulty.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid difficulty level string is required.',
      });
    }
    const normDiff = difficulty.toLowerCase().trim();
    if (!DIFFICULTY_LEVELS.includes(normDiff)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid difficulty: '${difficulty}'. Must be one of: ${DIFFICULTY_LEVELS.join(', ')}.`,
      });
    }

    // 3. Validate timerSeconds
    if (typeof timerSeconds !== 'number' || !Number.isInteger(timerSeconds)) {
      return res.status(400).json({
        status: 'error',
        message: 'Timer duration must be an integer.',
      });
    }
    if (!VALID_TIMERS.includes(timerSeconds)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid timer duration: ${timerSeconds}. Must be one of: ${VALID_TIMERS.join(', ')}.`,
      });
    }

    // 4. Validate WPM
    if (typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'WPM must be a non-negative number.',
      });
    }

    // 5. Validate accuracy
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Accuracy must be a number between 0 and 100.',
      });
    }

    // 6. Validate correctChars
    if (typeof correctChars !== 'number' || !Number.isInteger(correctChars) || correctChars < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Correct characters must be a non-negative integer.',
      });
    }

    // 7. Validate incorrectChars
    if (typeof incorrectChars !== 'number' || !Number.isInteger(incorrectChars) || incorrectChars < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Incorrect characters must be a non-negative integer.',
      });
    }

    // 8. Validate elapsedSeconds (must be integer >= 0)
    if (typeof elapsedSeconds !== 'number' || !Number.isInteger(elapsedSeconds) || elapsedSeconds < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Elapsed seconds must be a non-negative integer.',
      });
    }

    // 9. Validate snippetId
    if (typeof snippetId !== 'string' || !snippetId.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Snippet ID is required and must be a non-empty string.',
      });
    }

    // Create and save new Performance record
    const performance = new Performance({
      userId,
      language: normLang,
      difficulty: normDiff,
      timerSeconds,
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy * 10) / 10,
      correctChars,
      incorrectChars,
      elapsedSeconds,
      snippetId: snippetId.trim(),
    });

    const saved = await performance.save();

    return res.status(201).json({
      status: 'success',
      message: 'Performance recorded successfully',
      data: {
        performance: saved.toJSON(),
      },
    });
  } catch (error) {
    console.error('[Performance Controller] Error saving performance:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error saving performance.',
    });
  }
};

/**
 * Controller to retrieve an authenticated user's performance history.
 * Supports combinable server-side filtering by language and timerSeconds,
 * WPM sorting (newest, wpm_desc, wpm_asc), and scalable pagination.
 */
export const getPerformances = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const { language, timerSeconds, sort, page, limit } = req.query || {};

    const query = { userId };

    // 1. Language filter validation
    if (language && language.toLowerCase() !== 'all') {
      const normLang = language.toLowerCase().trim();
      if (!SUPPORTED_LANGUAGES.includes(normLang)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid language filter: '${language}'. Must be 'all' or one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
        });
      }
      query.language = normLang;
    }

    // 2. Timer filter validation
    if (timerSeconds && String(timerSeconds).toLowerCase() !== 'all') {
      const parsedTimer = parseInt(timerSeconds, 10);
      if (isNaN(parsedTimer) || !VALID_TIMERS.includes(parsedTimer)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid timer filter: '${timerSeconds}'. Must be 'all' or one of: ${VALID_TIMERS.join(', ')}.`,
        });
      }
      query.timerSeconds = parsedTimer;
    }

    // 3. Sort configuration validation
    let sortConfig = SORT_OPTIONS.newest;
    if (sort !== undefined && sort !== null && sort !== '') {
      const normSort = sort.toLowerCase().trim();
      if (!SORT_OPTIONS[normSort]) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid sort option: '${sort}'. Must be one of: ${Object.keys(SORT_OPTIONS).join(', ')}.`,
        });
      }
      sortConfig = SORT_OPTIONS[normSort];
    }

    // 4. Pagination setup
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    // 5. Query execution: sort applied before skip & limit for correct pagination
    const [performances, total] = await Promise.all([
      Performance.find(query).sort(sortConfig).skip(skip).limit(parsedLimit),
      Performance.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 1;

    return res.status(200).json({
      status: 'success',
      data: {
        performances: performances.map((p) => p.toJSON()),
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('[Performance Controller] Error fetching performances:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching performance history.',
    });
  }
};
