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
  const height = 280;
  const padding = { top: 25, right: 35, bottom: 42, left: 50 };

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
    <div className="graph-card">
      <div className="graph-header">
        <div>
          <h3 className="graph-title">WPM Progression</h3>
          <p className="graph-subtitle">Chronological typing speed across sequential attempts.</p>
        </div>

        {truncated && (
          <span className="graph-truncated-badge" title="Graph capped to most recent 500 attempts for performance">
            Showing most recent 500 of {totalCount} attempts
          </span>
        )}
      </div>

      {loading ? (
        <div className="graph-state-container loading">
          <div className="skeleton-loader">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
          </div>
          <p>Loading progression graph...</p>
        </div>
      ) : graphData.length === 0 ? (
        <div className="graph-state-container empty">
          <div className="empty-symbol">&gt;_</div>
          <p>No performance attempts to graph for this filter selection.</p>
        </div>
      ) : (
        <div className="graph-canvas-wrapper">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="graph-svg"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="wpmAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Numeric Ticks */}
            {yBounds.ticks.map((tickVal) => {
              const normalizedY = (tickVal - yBounds.minY) / (yBounds.maxY - yBounds.minY || 1);
              const yPos = height - padding.bottom - normalizedY * (height - padding.top - padding.bottom);

              return (
                <g key={tickVal} className="grid-group">
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    className="grid-line"
                  />
                  <text
                    x={padding.left - 10}
                    y={yPos + 4}
                    textAnchor="end"
                    className="axis-tick-label"
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
              className="axis-baseline"
            />

            {/* X-Axis Attempt Number Ticks */}
            {visibleXIndices.map((idx) => {
              const pt = points[idx];
              if (!pt) return null;

              return (
                <text
                  key={idx}
                  x={pt.x}
                  y={height - padding.bottom + 20}
                  textAnchor="middle"
                  className="axis-tick-label x-label"
                >
                  #{pt.attemptNumber}
                </text>
              );
            })}

            {/* Area Fill Gradient (2+ points) */}
            {points.length >= 2 && (
              <path d={areaPath} fill="url(#wpmAreaGradient)" className="graph-area" />
            )}

            {/* Line Path (2+ points) */}
            {points.length >= 2 && (
              <path d={linePath} fill="none" className="graph-line" />
            )}

            {/* Interactive Data Points */}
            {points.map((pt) => {
              const isHovered = hoveredPoint?.attemptNumber === pt.attemptNumber;

              return (
                <g key={pt.id || pt.attemptNumber} className="point-group">
                  {/* Invisible larger hover trigger */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    fill="transparent"
                    className="hover-trigger"
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                  {/* Outer pulse when hovered */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={7}
                      className="point-pulse"
                    />
                  )}
                  {/* Main Point Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={points.length === 1 ? 6 : isHovered ? 5 : 3.5}
                    className={`point-circle ${isHovered ? 'active' : ''}`}
                  />
                </g>
              );
            })}
          </svg>

          {/* Single-point dataset guidance note */}
          {graphData.length === 1 && (
            <div className="graph-single-note">
              <span>&#x2139; 1 attempt recorded. Complete additional tests to view your progression trend line!</span>
            </div>
          )}

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="graph-tooltip"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <div className="tooltip-header">
                <span className="tooltip-attempt">Attempt #{hoveredPoint.attemptNumber}</span>
                <span className="tooltip-date">{formatTimestamp(hoveredPoint.createdAt)}</span>
              </div>
              <div className="tooltip-body">
                <div className="tooltip-row">
                  <span className="tooltip-label">Speed:</span>
                  <strong className="tooltip-val text-cyan">{hoveredPoint.wpm} WPM</strong>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Accuracy:</span>
                  <strong className="tooltip-val text-green">{hoveredPoint.accuracy}%</strong>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Language:</span>
                  <span className="tooltip-val">{getLanguageName(hoveredPoint.language)} ({hoveredPoint.difficulty})</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Duration:</span>
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
