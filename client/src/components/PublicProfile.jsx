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
    <div className="profile-view">
      {/* Top Bar Navigation */}
      <div className="view-header">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateHome}>
          &larr; Back to App
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={fetchProfile} title="Refresh profile">
          &#x21BB;
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="panel state-panel loading">
          <div className="loading-spinner"></div>
          <p>Loading profile for @{username}...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="panel state-panel error">
          <h3>Profile Not Found</h3>
          <p className="error-text">{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateHome}>
            Return Home
          </button>
        </div>
      )}

      {/* Populated Public Profile */}
      {!loading && !error && profile && (
        <div className="profile-content">
          {/* User Header Panel */}
          <div className="panel profile-header-panel">
            <div className="profile-avatar">
              {(profile.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="profile-user-info">
              <div className="profile-username-row">
                <h1 className="profile-username">@{profile.username}</h1>
                <span className="badge-public">Public Profile</span>
              </div>
              <p className="profile-joined">
                Member since {formatTimestamp(profile.memberSince)}
              </p>
            </div>
          </div>

          {/* Section 1: Ranked Progression & Badges (Always Public) */}
          <div className="profile-section ranked-theme">
            <div className="section-title-bar">
              <div>
                <h2 className="section-heading">Ranked Performance</h2>
                <p className="section-subheading">Verified competitive statistics and milestone achievements.</p>
              </div>
            </div>

            {/* Ranked Metrics Grid */}
            <div className="stats-row">
              <div className="stat-card stat-ranked">
                <span className="stat-label">Ranked Best</span>
                <div className="stat-value-group">
                  <span className="stat-number text-amber">{profile.ranked?.summary?.personalBest?.wpm || 0}</span>
                  <span className="stat-unit">WPM</span>
                </div>
                {profile.ranked?.summary?.personalBest && (
                  <div className="stat-meta">
                    <span className="badge-tag">{profile.ranked.summary.personalBest.language}</span>
                    <span className="stat-meta-text">{profile.ranked.summary.personalBest.accuracy}% acc</span>
                  </div>
                )}
              </div>

              <div className="stat-card">
                <span className="stat-label">Ranked Avg WPM</span>
                <div className="stat-value-group">
                  <span className="stat-number">{profile.ranked?.summary?.averageWpm || 0}</span>
                  <span className="stat-unit">WPM</span>
                </div>
                <span className="stat-meta-text">{profile.ranked?.summary?.totalTests || 0} ranked tests</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Avg Accuracy</span>
                <div className="stat-value-group">
                  <span className="stat-number text-green">{profile.ranked?.summary?.averageAccuracy || 0}%</span>
                </div>
                <span className="stat-meta-text">Ranked precision</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Ranked Tests</span>
                <div className="stat-value-group">
                  <span className="stat-number">{profile.ranked?.summary?.totalTests || 0}</span>
                </div>
                <span className="stat-meta-text">Verified attempts</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Ranked Time</span>
                <div className="stat-value-group">
                  <span className="stat-number text-purple">
                    {formatTime(profile.ranked?.summary?.totalTimeTypedSeconds || 0)}
                  </span>
                </div>
                <span className="stat-meta-text">Total competitive time</span>
              </div>
            </div>

            {/* Ranked Badges Grid */}
            <BadgesGrid badges={profile.ranked?.badges || []} />

            {/* Ranked WPM Progression Graph */}
            {profile.ranked?.graphData && profile.ranked.graphData.length > 0 && (
              <div className="panel profile-graph-panel">
                <div className="panel-header">
                  <h3 className="panel-title">Ranked Progression</h3>
                </div>
                <WpmProgressionGraph
                  graphData={profile.ranked.graphData}
                  totalCount={profile.ranked.graphData.length}
                />
              </div>
            )}
          </div>

          {/* Section 2: Practice Statistics (Conditional on practice privacy) */}
          {profile.practice && (
            <div className="profile-section practice-theme">
              <div className="section-title-bar">
                <div>
                  <h2 className="section-heading">Unranked Practice</h2>
                  <p className="section-subheading">Casual practice performance and typing progression.</p>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-card">
                  <span className="stat-label">Practice Best</span>
                  <div className="stat-value-group">
                    <span className="stat-number text-cyan">{profile.practice.summary?.personalBest?.wpm || 0}</span>
                    <span className="stat-unit">WPM</span>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Practice Avg WPM</span>
                  <div className="stat-value-group">
                    <span className="stat-number">{profile.practice.summary?.averageWpm || 0}</span>
                    <span className="stat-unit">WPM</span>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Practice Accuracy</span>
                  <div className="stat-value-group">
                    <span className="stat-number text-green">{profile.practice.summary?.averageAccuracy || 0}%</span>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Practice Tests</span>
                  <div className="stat-value-group">
                    <span className="stat-number">{profile.practice.summary?.totalTests || 0}</span>
                  </div>
                </div>
              </div>

              {profile.practice.graphData && profile.practice.graphData.length > 0 && (
                <div className="panel profile-graph-panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Practice Progression</h3>
                  </div>
                  <WpmProgressionGraph
                    graphData={profile.practice.graphData}
                    totalCount={profile.practice.graphData.length}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PublicProfile;
