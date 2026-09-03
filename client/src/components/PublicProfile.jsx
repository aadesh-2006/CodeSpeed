import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import BadgesGrid from './BadgesGrid';
import WpmProgressionGraph from './WpmProgressionGraph';
import { formatTime } from '../utils/typingMetrics';

export function PublicProfile({ username, onNavigateHome, onNavigateSettings }) {
  const [profile, setProfile] = useState(null);
  const [profileMode, setProfileMode] = useState('ranked'); // 'ranked' | 'practice' (defaults to ranked)
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

  const isRanked = profileMode === 'ranked';

  return (
    <div className={`profile-view ${isRanked ? 'ranked-theme' : 'practice-theme'}`}>
      {/* Top Bar Navigation */}
      <div className="view-header">
        <div className="view-header-left">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateHome}>
            &larr; Back to App
          </button>
          {profile?.isOwner && onNavigateSettings && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateSettings}>
              Settings
            </button>
          )}
        </div>
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
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt={`@${profile.username}`} className="profile-avatar-img" />
              ) : (
                (profile.username || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="profile-user-info">
              <div className="profile-username-row">
                <h1 className="profile-username">@{profile.username}</h1>
                {profile.isOwner && <span className="badge-owner">You</span>}
              </div>
              {profile.bio ? (
                <p className="profile-bio">{profile.bio}</p>
              ) : null}
              <p className="profile-joined">
                Member since {formatTimestamp(profile.memberSince)}
              </p>
            </div>
          </div>

          {/* Mode-Specific Performance Section */}
          <div className={`profile-section ${isRanked ? 'ranked-theme' : 'practice-theme'}`}>
            <div className="section-title-bar profile-mode-header">
              <div>
                <h2 className="section-heading">
                  {isRanked ? 'Ranked Performance' : 'Practice Performance'}
                </h2>
                <p className="section-subheading">
                  {isRanked
                    ? 'Verified competitive statistics and milestone achievements.'
                    : 'Casual practice statistics and typing progression.'}
                </p>
              </div>

              {/* Mode Toggle: [ Ranked ] [ Practice ] */}
              <div className="segmented-control" role="group" aria-label="Profile Mode">
                <button
                  type="button"
                  className={`segment-btn ${isRanked ? 'active ranked' : ''}`}
                  onClick={() => setProfileMode('ranked')}
                >
                  Ranked
                </button>
                <button
                  type="button"
                  className={`segment-btn ${!isRanked ? 'active' : ''}`}
                  onClick={() => setProfileMode('practice')}
                >
                  Practice
                </button>
              </div>
            </div>

            {/* RANKED MODE VIEW */}
            {isRanked && (
              <>
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

                {/* Ranked Badges Grid (Ranked only) */}
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
              </>
            )}

            {/* PRACTICE MODE VIEW */}
            {!isRanked && (
              <>
                {profile.practice ? (
                  <>
                    {/* Practice Metrics Grid */}
                    <div className="stats-row">
                      <div className="stat-card">
                        <span className="stat-label">Practice Best</span>
                        <div className="stat-value-group">
                          <span className="stat-number text-blue">{profile.practice.summary?.personalBest?.wpm || 0}</span>
                          <span className="stat-unit">WPM</span>
                        </div>
                        {profile.practice.summary?.personalBest && (
                          <div className="stat-meta">
                            <span className="badge-tag">{profile.practice.summary.personalBest.language}</span>
                            <span className="stat-meta-text">{profile.practice.summary.personalBest.accuracy}% acc</span>
                          </div>
                        )}
                      </div>

                      <div className="stat-card">
                        <span className="stat-label">Practice Avg WPM</span>
                        <div className="stat-value-group">
                          <span className="stat-number">{profile.practice.summary?.averageWpm || 0}</span>
                          <span className="stat-unit">WPM</span>
                        </div>
                        <span className="stat-meta-text">{profile.practice.summary?.totalTests || 0} practice tests</span>
                      </div>

                      <div className="stat-card">
                        <span className="stat-label">Practice Accuracy</span>
                        <div className="stat-value-group">
                          <span className="stat-number text-green">{profile.practice.summary?.averageAccuracy || 0}%</span>
                        </div>
                        <span className="stat-meta-text">Practice precision</span>
                      </div>

                      <div className="stat-card">
                        <span className="stat-label">Practice Tests</span>
                        <div className="stat-value-group">
                          <span className="stat-number">{profile.practice.summary?.totalTests || 0}</span>
                        </div>
                        <span className="stat-meta-text">Completed sessions</span>
                      </div>

                      <div className="stat-card">
                        <span className="stat-label">Practice Time</span>
                        <div className="stat-value-group">
                          <span className="stat-number text-purple">
                            {formatTime(profile.practice.summary?.totalTimeTypedSeconds || 0)}
                          </span>
                        </div>
                        <span className="stat-meta-text">Total practice time</span>
                      </div>
                    </div>

                    {/* Practice Progression Graph */}
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
                  </>
                ) : (
                  /* Practice Private State */
                  <div className="panel private-stats-panel">
                    <div className="private-stats-lock">&#x1F512;</div>
                    <h3 className="private-stats-title">Practice statistics are private.</h3>
                    <p className="private-stats-subtitle">
                      This user has chosen to keep their practice attempts private.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicProfile;
