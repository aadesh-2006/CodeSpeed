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

/**
 * Controller to retrieve complete chronological data for WPM progression graph.
 * Returns records strictly in createdAt ASC order, respecting language/timer filters,
 * with sequential 1-based attempt numbers and explicit 500-record truncation metadata.
 */
export const getPerformanceGraph = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const { language, timerSeconds } = req.query || {};
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

    const GRAPH_LIMIT = 500;
    const totalCount = await Performance.countDocuments(query);
    const isTruncated = totalCount > GRAPH_LIMIT;

    let records;
    if (isTruncated) {
      // For meaningful progression visualization, retrieve the most recent 500 attempts
      // by querying newest first then reversing to chronological order
      const latestRecords = await Performance.find(query)
        .select('wpm accuracy language difficulty timerSeconds snippetId createdAt')
        .sort({ createdAt: -1 })
        .limit(GRAPH_LIMIT);
      records = latestRecords.reverse();
    } else {
      records = await Performance.find(query)
        .select('wpm accuracy language difficulty timerSeconds snippetId createdAt')
        .sort({ createdAt: 1 });
    }

    const graphData = records.map((p, index) => ({
      id: p._id ? p._id.toString() : p.id,
      attemptNumber: index + 1,
      wpm: p.wpm,
      accuracy: p.accuracy,
      language: p.language,
      difficulty: p.difficulty,
      timerSeconds: p.timerSeconds,
      snippetId: p.snippetId,
      createdAt: p.createdAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        graphData,
        totalCount,
        displayedCount: graphData.length,
        truncated: isTruncated,
      },
    });
  } catch (error) {
    console.error('[Performance Controller] Error fetching performance graph:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching performance graph data.',
    });
  }
};

/**
 * Controller to retrieve aggregate dashboard metrics for the authenticated user.
 * Calculates total tests, total time, average WPM, average accuracy,
 * personal best (with deterministic tie-breaking: wpm DESC, accuracy DESC, createdAt DESC),
 * language breakdown with averageWpm, and 3 most recent attempts.
 */
export const getPerformanceSummary = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. User context missing.',
      });
    }

    const records = await Performance.find({ userId }).sort({ createdAt: -1 });

    if (!records || records.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          totalTests: 0,
          totalTimeTypedSeconds: 0,
          averageWpm: 0,
          averageAccuracy: 0,
          personalBest: null,
          languageBreakdown: [],
          recentAttempts: [],
        },
      });
    }

    const totalTests = records.length;
    const totalTimeTypedSeconds = records.reduce((acc, r) => acc + (r.elapsedSeconds || 0), 0);

    const sumWpm = records.reduce((acc, r) => acc + (r.wpm || 0), 0);
    const averageWpm = Math.round(sumWpm / totalTests);

    const sumAccuracy = records.reduce((acc, r) => acc + (r.accuracy || 0), 0);
    const averageAccuracy = Math.round((sumAccuracy / totalTests) * 10) / 10;

    // Deterministic Personal Best selection:
    // 1. highest WPM
    // 2. highest accuracy
    // 3. newest createdAt
    const sortedForPb = [...records].sort((a, b) => {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const pbRecord = sortedForPb[0];
    const personalBest = {
      id: pbRecord._id.toString(),
      wpm: pbRecord.wpm,
      accuracy: pbRecord.accuracy,
      language: pbRecord.language,
      difficulty: pbRecord.difficulty,
      timerSeconds: pbRecord.timerSeconds,
      snippetId: pbRecord.snippetId,
      createdAt: pbRecord.createdAt,
    };

    // Language Breakdown
    const langMap = {};
    for (const r of records) {
      const l = r.language;
      if (!langMap[l]) {
        langMap[l] = { language: l, testCount: 0, sumWpm: 0, bestWpm: 0 };
      }
      langMap[l].testCount += 1;
      langMap[l].sumWpm += r.wpm || 0;
      if (r.wpm > langMap[l].bestWpm) {
        langMap[l].bestWpm = r.wpm;
      }
    }

    const languageBreakdown = Object.values(langMap)
      .map((item) => ({
        language: item.language,
        testCount: item.testCount,
        bestWpm: item.bestWpm,
        averageWpm: Math.round(item.sumWpm / item.testCount),
      }))
      .sort((a, b) => b.testCount - a.testCount || b.averageWpm - a.averageWpm);

    // Recent 3 attempts
    const recentAttempts = records.slice(0, 3).map((r) => ({
      id: r._id.toString(),
      wpm: r.wpm,
      accuracy: r.accuracy,
      language: r.language,
      difficulty: r.difficulty,
      timerSeconds: r.timerSeconds,
      snippetId: r.snippetId,
      createdAt: r.createdAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        totalTests,
        totalTimeTypedSeconds,
        averageWpm,
        averageAccuracy,
        personalBest,
        languageBreakdown,
        recentAttempts,
      },
    });
  } catch (error) {
    console.error('[Performance Controller] Error fetching performance summary:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching performance summary.',
    });
  }
};
