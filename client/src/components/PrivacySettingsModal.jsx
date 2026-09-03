import React, { useState } from 'react';

export function PrivacySettingsModal({ isOpen, onClose, currentVisibility = 'private', onSave }) {
  const [selectedVisibility, setSelectedVisibility] = useState(currentVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(selectedVisibility);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Practice Privacy Settings</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Control whether your <strong>Unranked Practice</strong> history and progression graph appear on your public profile.
          </p>

          <div className="radio-cards-group">
            <label className={`radio-card ${selectedVisibility === 'private' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="practicePrivacy"
                value="private"
                checked={selectedVisibility === 'private'}
                onChange={() => setSelectedVisibility('private')}
              />
              <div className="radio-card-content">
                <div className="radio-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>Private (Default)</span>
                </div>
                <p className="radio-card-desc">
                  Only you can see your practice statistics and progression. Your public profile displays only verified ranked achievements.
                </p>
              </div>
            </label>

            <label className={`radio-card ${selectedVisibility === 'public' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="practicePrivacy"
                value="public"
                checked={selectedVisibility === 'public'}
                onChange={() => setSelectedVisibility('public')}
              />
              <div className="radio-card-content">
                <div className="radio-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <span>Public</span>
                </div>
                <p className="radio-card-desc">
                  Anyone visiting your public profile URL can see your practice statistics and practice WPM progression graph.
                </p>
              </div>
            </label>
          </div>

          <div className="modal-note">
            <em>Ranked statistics and badges are competitive milestones and are always public.</em>
          </div>

          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrivacySettingsModal;
