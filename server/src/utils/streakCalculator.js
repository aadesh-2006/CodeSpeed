/**
 * High-performance Daily Practice Streak Calculator.
 * Derives consecutive practice calendar days from timestamps with timezone support.
 */

/**
 * Format a Date or timestamp to YYYY-MM-DD string in a specified timezone.
 *
 * @param {Date|number|string} dateInput
 * @param {string} timeZone - IANA timezone identifier (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC')
 * @returns {string} - Date string in 'YYYY-MM-DD' format
 */
export const formatDateInTimezone = (dateInput, timeZone = 'UTC') => {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    // Intl.DateTimeFormat with 'en-CA' gives ISO-style YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    // Fallback to UTC if timezone is invalid
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
};

/**
 * Calculate the difference in calendar days between two YYYY-MM-DD strings.
 *
 * @param {string} dateStrA - 'YYYY-MM-DD'
 * @param {string} dateStrB - 'YYYY-MM-DD'
 * @returns {number} - Difference in days (dateStrB - dateStrA)
 */
export const daysDifference = (dateStrA, dateStrB) => {
  const [yA, mA, dA] = dateStrA.split('-').map(Number);
  const [yB, mB, dB] = dateStrB.split('-').map(Number);

  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);

  const msPerDay = 86400000;
  return Math.round((utcB - utcA) / msPerDay);
};

/**
 * Get date string offset by N days from a reference date string.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} offsetDays
 * @returns {string} - 'YYYY-MM-DD'
 */
export const addDays = (dateStr, offsetDays) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + offsetDays * 86400000;
  const target = new Date(utc);
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const td = String(target.getUTCDate()).padStart(2, '0');
  return `${ty}-${tm}-${td}`;
};

/**
 * Get short day name (e.g. 'Mon', 'Tue') for a YYYY-MM-DD date.
 */
export const getDayLabel = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dateObj.getUTCDay()];
};

/**
 * Calculate full daily streak metrics from an array of practice performance timestamps.
 *
 * @param {Array<Date|string|number>} practiceTimestamps
 * @param {object} options
 * @param {string} options.timeZone - IANA timezone (default 'UTC')
 * @param {Date|string} options.referenceDate - Optional current date override for testing
 * @returns {object} - Streak metrics { currentStreak, longestStreak, practicedToday, today, practicedDates, recentDays }
 */
export const calculateDailyStreak = (practiceTimestamps = [], options = {}) => {
  const timeZone = options.timeZone || 'UTC';
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const todayStr = formatDateInTimezone(now, timeZone);

  if (!practiceTimestamps || practiceTimestamps.length === 0) {
    // Generate 7-day empty window ending today
    const recentDays = [];
    for (let i = 6; i >= 0; i--) {
      const dStr = addDays(todayStr, -i);
      recentDays.push({
        date: dStr,
        dayLabel: getDayLabel(dStr),
        practiced: false,
        isToday: dStr === todayStr,
      });
    }

    return {
      currentStreak: 0,
      longestStreak: 0,
      practicedToday: false,
      today: todayStr,
      recentDays,
      practicedDates: [],
    };
  }

  // 1. Convert all practice timestamps to unique YYYY-MM-DD date strings in user timezone
  const dateSet = new Set();
  for (const ts of practiceTimestamps) {
    const formatted = formatDateInTimezone(ts, timeZone);
    if (formatted) {
      dateSet.add(formatted);
    }
  }

  const sortedDates = Array.from(dateSet).sort();
  const practicedToday = dateSet.has(todayStr);

  // 2. Calculate longest streak across entire history
  let longestStreak = 0;
  let currentRun = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const diff = daysDifference(sortedDates[i - 1], sortedDates[i]);
      if (diff === 1) {
        currentRun += 1;
      } else if (diff > 1) {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  // 3. Calculate current active streak ending today
  // Under standard streak semantics:
  // - If practiced today: count consecutive days backwards starting from today
  // - If not practiced today: current streak is 0
  let currentStreak = 0;
  if (practicedToday) {
    let checkDate = todayStr;
    while (dateSet.has(checkDate)) {
      currentStreak += 1;
      checkDate = addDays(checkDate, -1);
    }
  }

  // 4. Build recent 7-day activity window ending today
  const recentDays = [];
  for (let i = 6; i >= 0; i--) {
    const dStr = addDays(todayStr, -i);
    recentDays.push({
      date: dStr,
      dayLabel: getDayLabel(dStr),
      practiced: dateSet.has(dStr),
      isToday: dStr === todayStr,
    });
  }

  // Return recent practiced dates (last 30 days of activity)
  const thirtyDaysAgo = addDays(todayStr, -30);
  const recentPracticedDates = sortedDates.filter((d) => d >= thirtyDaysAgo);

  return {
    currentStreak,
    longestStreak,
    practicedToday,
    today: todayStr,
    recentDays,
    practicedDates: recentPracticedDates,
  };
};

export default {
  formatDateInTimezone,
  daysDifference,
  addDays,
  getDayLabel,
  calculateDailyStreak,
};
