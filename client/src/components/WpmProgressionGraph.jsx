import React, { useState } from 'react';
import {
  calculateYBounds,
  computePointCoordinates,
  generateLinePath,
  generateAreaPath,
} from '../utils/graphMetrics';
import { SUPPORTED_LANGUAGES, TIMER_OPTIONS } from '../data/snippets';

export function WpmProgressionGraph({ graphData = [], loading = false, totalCount = 0, truncated = false }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const getLanguageName = (langId) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.id.toLowerCase() === (langId || '').toLowerCase());
    return found ? found.name : langId;
  };

  const getTimerLabel = (seconds) => {
    const found = TIMER_OPTIONS.find((t) => t.seconds === Number(seconds));
    return found ? found.label : `${seconds}s`;
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateString);
    }
  };

  // Dimensions & padding
  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 36, left: 46 };

  const yBounds = calculateYBounds(graphData);
  const points = computePointCoordinates(graphData, width, height, padding, yBounds);
  const linePath = generateLinePath(points);
  const areaPath = generateAreaPath(points, height, padding);

  // Determine which X-axis labels to show to prevent crowding
  const getVisibleXIndices = () => {
    const total = points.length;
    if (total <= 12) {
      return points.map((_, i) => i);
    }
    const step = Math.ceil(total / 8);
    const indices = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== total - 1) {
      indices.push(total - 1);
    }
    return indices;
  };

  const visibleXIndices = getVisibleXIndices();

  return (
    <div className="panel graph-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">WPM Progression</h3>
          <p className="panel-subtitle">Chronological typing speed across sequential attempts.</p>
        </div>

        {truncated && (
          <span className="badge-warning" title="Graph capped to most recent 500 attempts for performance">
            Showing latest 500 of {totalCount}
          </span>
        )}
      </div>

      {loading ? (
        <div className="state-panel loading">
          <div className="loading-spinner"></div>
          <p>Loading graph...</p>
        </div>
      ) : graphData.length === 0 ? (
        <div className="state-panel empty graph-empty">
          <div className="empty-glyph">&gt;_</div>
          <p>No attempts recorded for the selected filters.</p>
        </div>
      ) : (
        <div className="graph-wrapper">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="graph-canvas"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="wpmAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Numeric Ticks */}
            {yBounds.ticks.map((tickVal) => {
              const normalizedY = (tickVal - yBounds.minY) / (yBounds.maxY - yBounds.minY || 1);
              const yPos = height - padding.bottom - normalizedY * (height - padding.top - padding.bottom);

              return (
                <g key={tickVal} className="grid-line-group">
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    className="chart-gridline"
                  />
                  <text
                    x={padding.left - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    className="chart-axis-tick"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Baseline */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              className="chart-baseline"
            />

            {/* X-Axis Attempt Number Ticks */}
            {visibleXIndices.map((idx) => {
              const pt = points[idx];
              if (!pt) return null;

              return (
                <text
                  key={idx}
                  x={pt.x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className="chart-axis-tick chart-x-tick"
                >
                  #{pt.attemptNumber}
                </text>
              );
            })}

            {/* Area Fill Gradient (2+ points) */}
            {points.length >= 2 && (
              <path d={areaPath} fill="url(#wpmAreaGradient)" className="chart-area-fill" />
            )}

            {/* Line Path (2+ points) */}
            {points.length >= 2 && (
              <path d={linePath} fill="none" className="chart-line-stroke" />
            )}

            {/* Interactive Data Points */}
            {points.map((pt) => {
              const isHovered = hoveredPoint?.attemptNumber === pt.attemptNumber;

              return (
                <g key={pt.id || pt.attemptNumber} className="chart-point-group">
                  {/* Invisible larger hover trigger */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    fill="transparent"
                    className="chart-hover-trigger"
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                  {/* Outer ring when hovered */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={6}
                      className="chart-point-ring"
                    />
                  )}
                  {/* Main Point Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={points.length === 1 ? 5 : isHovered ? 4.5 : 3}
                    className={`chart-point-dot ${isHovered ? 'hovered' : ''}`}
                  />
                </g>
              );
            })}
          </svg>

          {/* Single-point dataset guidance note */}
          {graphData.length === 1 && (
            <div className="graph-hint">
              <span>1 attempt recorded. Complete more tests to generate your progression trend line.</span>
            </div>
          )}

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="chart-tooltip"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <div className="tooltip-top">
                <span className="tooltip-title">Attempt #{hoveredPoint.attemptNumber}</span>
                <span className="tooltip-time">{formatTimestamp(hoveredPoint.createdAt)}</span>
              </div>
              <div className="tooltip-stats">
                <div className="tooltip-stat">
                  <span className="tooltip-lbl">WPM:</span>
                  <strong className="tooltip-val text-cyan">{hoveredPoint.wpm}</strong>
                </div>
                <div className="tooltip-stat">
                  <span className="tooltip-lbl">Accuracy:</span>
                  <strong className="tooltip-val text-green">{hoveredPoint.accuracy}%</strong>
                </div>
                <div className="tooltip-stat">
                  <span className="tooltip-lbl">Snippet:</span>
                  <span className="tooltip-val">{getLanguageName(hoveredPoint.language)} ({hoveredPoint.difficulty})</span>
                </div>
                <div className="tooltip-stat">
                  <span className="tooltip-lbl">Timer:</span>
                  <span className="tooltip-val">{getTimerLabel(hoveredPoint.timerSeconds)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WpmProgressionGraph;
