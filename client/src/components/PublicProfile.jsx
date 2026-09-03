import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import BadgesGrid from './BadgesGrid';
import WpmProgressionGraph from './WpmProgressionGraph';
import { formatTime } from '../utils/typingMetrics';

export function PublicProfile({ username, onNavigateHome }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPublicProfile(username);
      if (res && res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      console.error('[PublicProfile] Fetch error:', err.message);
      setError(err.message || `Unable to load profile for '${username}'.`);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(dateString);
    }
  };

  return (
    <div className="public-profile-container">
      {/* Top Bar Navigation */}
      <div className="public-profile-nav">
        <button type="button" className="action-btn secondary-btn compact" onClick={onNavigateHome}>
          &larr; Back to App
        </button>
        <button type="button" className="refresh-btn" onClick={fetchProfile} title="Refresh profile">
          &#x21BB;
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="dashboard-state-card loading">
          <div className="skeleton-loader">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
            <div className="skeleton-line row"></div>
          </div>
          <p>Loading profile for @{username}...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="dashboard-state-card error">
          <span className="error-icon">&#x26A0;</span>
          <h3>Profile Not Found</h3>
          <p className="error-text">{error}</p>
          <button type="button" className="action-btn secondary-btn compact" onClick={onNavigateHome}>
            Return Home
          </button>
        </div>
      )}

      {/* Populated Public Profile */}
      {!loading && !error && profile && (
        <div className="public-profile-content">
          {/* User Header Card */}
          <div className="profile-header-card">
            <div className="profile-avatar-box">
              <span className="profile-avatar-letter">
                {(profile.username || 'U').charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="profile-header-info">
              <h2 className="profile-username">
                @{profile.username}
                <span className="profile-public-badge">Public Profile</span>
              </h2>
              <p className="profile-meta">
                Member since {formatTimestamp(profile.memberSince)} &bull; CodeSpeed Coder
              </p>
            </div>
          </div>

          {/* Section 1: Ranked Progression & Badges (Always Public) */}
          <div className="profile-mode-section ranked-section">
            <div className="section-banner ranked-banner">
              <span className="banner-badge">🏆 Ranked Mode</span>
              <span className="banner-sub">Competitive performance records &amp; unlocked badges</span>
            </div>

            {/* Ranked Metrics Grid */}
            <div className="metrics-grid">
              <div className="metric-card pb-card ranked">
                <div className="metric-card-top">
                  <span className="metric-icon">&#x1F3C6;</span>
                  <span className="metric-label">Ranked Best</span>
                </div>
                <div className="metric-value-row">
                  <span className="metric-value text-amber">{profile.ranked?.summary?.personalBest?.wpm || 0}</span>
                  <span className="metric-unit">WPM</span>
                </div>
                {profile.ranked?.summary?.personalBest && (
                  <div className="metric-detail">
                    <span className="lang-tag">{profile.ranked.summary.personalBest.language}</span>
                    <span className="diff-tag">{profile.ranked.summary.personalBest.accuracy}% acc</span>
                  </div>
                )}
              </div>

              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="metric-icon">&#x26A1;</span>
                  <span className="metric-label">Ranked Avg WPM</span>
                </div>
                <div className="metric-value-row">
                  <span className="metric-value">{profile.ranked?.summary?.averageWpm || 0}</span>
                  <span className="metric-unit">WPM</span>
                </div>
                <span className="metric-sub">Across {profile.ranked?.summary?.totalTests || 0} ranked tests</span>
              </div>

              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="metric-icon">&#x25CE;</span>
                  <span className="metric-label">Avg Accuracy</span>
                </div>
                <div className="metric-value-row">
                  <span className="metric-value text-green">{profile.ranked?.summary?.averageAccuracy || 0}%</span>
                </div>
                <span className="metric-sub">Ranked precision</span>
              </div>

              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="metric-icon">&#x2714;</span>
                  <span className="metric-label">Ranked Tests</span>
                </div>
                <div className="metric-value-row">
                  <span className="metric-value">{profile.ranked?.summary?.totalTests || 0}</span>
                  <span className="metric-unit">sessions</span>
                </div>
                <span className="metric-sub">Verified attempts</span>
              </div>

              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="metric-icon">&#x23F1;</span>
                  <span className="metric-label">Ranked Time</span>
                </div>
                <div className="metric-value-row">
                  <span className="metric-value text-purple">
                    {formatTime(profile.ranked?.summary?.totalTimeTypedSeconds || 0)}
                  </span>
                </div>
                <span className="metric-sub">Competitive time</span>
              </div>
            </div>

            {/* Ranked Badges Grid */}
            <BadgesGrid badges={profile.ranked?.badges || []} />

            {/* Ranked WPM Progression Graph */}
            {profile.ranked?.graphData && profile.ranked.graphData.length > 0 && (
              <div className="profile-graph-card">
                <h4 className="graph-card-title">Ranked WPM Progression</h4>
                <WpmProgressionGraph
                  graphData={profile.ranked.graphData}
                  totalCount={profile.ranked.graphData.length}
                />
              </div>
            )}
          </div>

          {/* Section 2: Practice Statistics (Conditional on practice privacy) */}
          <div className="profile-mode-section practice-section">
            <div className="section-banner practice-banner">
              <span className="banner-badge">⌨️ Unranked Practice</span>
              <span className="banner-sub">Casual typing practice and training history</span>
            </div>

            {profile.practice ? (
              <>
                <div className="metrics-grid">
                  <div className="metric-card pb-card">
                    <div className="metric-card-top">
                      <span className="metric-icon">&#x1F3C6;</span>
                      <span className="metric-label">Practice Best</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-value text-cyan">{profile.practice.summary?.personalBest?.wpm || 0}</span>
                      <span className="metric-unit">WPM</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-icon">&#x26A1;</span>
                      <span className="metric-label">Practice Avg WPM</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-value">{profile.practice.summary?.averageWpm || 0}</span>
                      <span className="metric-unit">WPM</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-icon">&#x25CE;</span>
                      <span className="metric-label">Practice Accuracy</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-value text-green">{profile.practice.summary?.averageAccuracy || 0}%</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-icon">&#x2714;</span>
                      <span className="metric-label">Practice Tests</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-value">{profile.practice.summary?.totalTests || 0}</span>
                    </div>
                  </div>
                </div>

                {profile.practice.graphData && profile.practice.graphData.length > 0 && (
                  <div className="profile-graph-card">
                    <h4 className="graph-card-title">Practice WPM Progression</h4>
                    <WpmProgressionGraph
                      graphData={profile.practice.graphData}
                      totalCount={profile.practice.graphData.length}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="private-practice-notice">
                <span className="lock-icon">🔒</span>
                <p>This user's unranked practice statistics are set to private.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicProfile;
