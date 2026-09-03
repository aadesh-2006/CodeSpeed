/**
 * Utility calculations for WPM Progression Graph.
 * Computes dynamic numeric Y-axis bounds, evenly spaced ticks, and SVG coordinate paths.
 */

/**
 * Calculates dynamic numeric Y-axis bounds and ticks based on actual WPM data.
 * Does not hard-code fixed bounds; dynamically adapts to low, medium, or high WPM datasets.
 *
 * @param {Array<{ wpm: number }>} data
 * @param {number} targetTickCount
 * @returns {{ minY: number, maxY: number, ticks: number[] }}
 */
export function calculateYBounds(data, targetTickCount = 5) {
  if (!data || data.length === 0) {
    return { minY: 0, maxY: 100, ticks: [0, 25, 50, 75, 100] };
  }

  const wpms = data.map((d) => (typeof d.wpm === 'number' ? d.wpm : 0));
  const minWpm = Math.min(...wpms);
  const maxWpm = Math.max(...wpms);

  let minY;
  let maxY;

  if (minWpm === maxWpm) {
    // Single distinct value dataset: create a balanced range around the value
    const delta = Math.max(10, Math.round(minWpm * 0.2));
    minY = Math.max(0, Math.floor((minWpm - delta) / 5) * 5);
    maxY = Math.max(minY + 20, Math.ceil((maxWpm + delta) / 5) * 5);
  } else {
    // Multi-value dataset: add 15% padding above and below
    const span = maxWpm - minWpm;
    const padding = Math.max(5, span * 0.15);
    minY = Math.max(0, Math.floor((minWpm - padding) / 5) * 5);
    maxY = Math.ceil((maxWpm + padding) / 5) * 5;
  }

  // Ensure minimum visual span
  if (maxY - minY < 10) {
    maxY = minY + 10;
  }

  // Generate clean, evenly spaced numeric ticks
  const rawStep = (maxY - minY) / (targetTickCount - 1);
  const step = Math.max(1, Math.round(rawStep));
  const ticks = [];
  for (let val = minY; val <= maxY; val += step) {
    ticks.push(val);
  }

  // Ensure the top bound is present
  if (ticks[ticks.length - 1] < maxY) {
    ticks.push(maxY);
  }

  return { minY, maxY, ticks };
}

/**
 * Computes SVG coordinate positions for each data point in the graph canvas.
 *
 * @param {Array<object>} data
 * @param {number} width
 * @param {number} height
 * @param {{ top: number, right: number, bottom: number, left: number }} padding
 * @param {{ minY: number, maxY: number }} yBounds
 * @returns {Array<object & { x: number, y: number }>}
 */
export function computePointCoordinates(data, width, height, padding, yBounds) {
  if (!data || data.length === 0) return [];

  const innerWidth = Math.max(1, width - padding.left - padding.right);
  const innerHeight = Math.max(1, height - padding.top - padding.bottom);
  const ySpan = Math.max(1, yBounds.maxY - yBounds.minY);

  if (data.length === 1) {
    const p = data[0];
    const x = padding.left + innerWidth / 2;
    const normalizedY = (p.wpm - yBounds.minY) / ySpan;
    const y = height - padding.bottom - normalizedY * innerHeight;
    return [{ ...p, x, y }];
  }

  const xStep = innerWidth / (data.length - 1);

  return data.map((p, index) => {
    const x = padding.left + index * xStep;
    const normalizedY = (p.wpm - yBounds.minY) / ySpan;
    const y = height - padding.bottom - normalizedY * innerHeight;
    return { ...p, x, y };
  });
}

/**
 * Generates an SVG line path command string from coordinate points.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string}
 */
export function generateLinePath(points) {
  if (!points || points.length < 2) return '';
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

/**
 * Generates a closed SVG area path command string for gradient underlay.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} height
 * @param {{ bottom: number }} padding
 * @returns {string}
 */
export function generateAreaPath(points, height, padding) {
  if (!points || points.length < 2) return '';
  const baseY = (height - padding.bottom).toFixed(2);
  const linePart = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const lastX = points[points.length - 1].x.toFixed(2);
  const firstX = points[0].x.toFixed(2);

  return `${linePart} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
}
