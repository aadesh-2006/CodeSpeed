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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Practice Stats Privacy</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Choose whether your <strong>Unranked Practice</strong> statistics and progression graphs are publicly visible on your shareable profile.
          </p>

          <div className="privacy-options-group">
            <label className={`privacy-option-card ${selectedVisibility === 'private' ? 'active' : ''}`}>
              <input
                type="radio"
                name="practicePrivacy"
                value="private"
                checked={selectedVisibility === 'private'}
                onChange={() => setSelectedVisibility('private')}
              />
              <div className="privacy-option-text">
                <div className="privacy-option-header">
                  <strong>🔒 Private (Default)</strong>
                </div>
                <p>
                  Only you can see your practice statistics and graph. Your public profile will only show your ranked achievements.
                </p>
              </div>
            </label>

            <label className={`privacy-option-card ${selectedVisibility === 'public' ? 'active' : ''}`}>
              <input
                type="radio"
                name="practicePrivacy"
                value="public"
                checked={selectedVisibility === 'public'}
                onChange={() => setSelectedVisibility('public')}
              />
              <div className="privacy-option-text">
                <div className="privacy-option-header">
                  <strong>🌐 Public</strong>
                </div>
                <p>
                  Anyone viewing your profile can see your practice statistics and practice progression graph.
                </p>
              </div>
            </label>
          </div>

          <div className="privacy-note">
            <em>Note: Ranked statistics and badges are competitive milestones and are always public.</em>
          </div>

          {error && <p className="modal-error-text">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="action-btn secondary-btn compact" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="action-btn primary-btn compact" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrivacySettingsModal;
