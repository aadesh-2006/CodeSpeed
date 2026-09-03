import React, { useState, useRef } from 'react';
import { api } from '../services/api';

export function Settings({ user, onUserUpdated, onNavigateBack }) {
  // Profile state
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || null);
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhoto || null);
  const [practiceStatsVisibility, setPracticeStatsVisibility] = useState(user?.practiceStatsVisibility || 'private');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback states
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fileInputRef = useRef(null);

  // Helper to resize/compress image before sending to MongoDB
  const processImageFile = (file) => {
    return new Promise((resolve, reject) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        return reject(new Error('Supported image formats: PNG, JPEG, WebP, GIF.'));
      }

      if (file.size > 2 * 1024 * 1024) {
        return reject(new Error('Image must be smaller than 2MB before compression.'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;
          let { width, height } = img;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export as compressed WebP or JPEG
          const compressedDataUri = canvas.toDataURL('image/webp', 0.85);
          resolve(compressedDataUri);
        };
        img.onerror = () => reject(new Error('Failed to decode image file.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProfileError('');
      const compressedUri = await processImageFile(file);
      setProfilePhoto(compressedUri);
      setPhotoPreview(compressedUri);
    } catch (err) {
      setProfileError(err.message || 'Error processing image.');
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const payload = {
        username: username.trim(),
        bio: bio.trim(),
        profilePhoto: profilePhoto,
        practiceStatsVisibility,
      };

      const res = await api.updateProfile(payload);
      if (res && res.data && res.data.user) {
        setProfileSuccess('Profile updated successfully.');
        if (onUserUpdated) {
          onUserUpdated(res.data.user);
        }
      }
    } catch (err) {
      console.error('[Settings] Update profile error:', err);
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res && res.status === 'success') {
        setPasswordSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('[Settings] Change password error:', err);
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Top Header */}
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">Manage your profile identity, privacy preferences, and security credentials.</p>
        </div>
        {onNavigateBack && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateBack}>
            &larr; Back
          </button>
        )}
      </div>

      <div className="settings-grid">
        {/* 1. Profile Information Section */}
        <section className="panel settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Profile Information</h2>
            <p className="settings-section-description">Your public persona and developer details across CodeSpeed.</p>
          </div>

          {profileSuccess && <div className="notification notification-success">{profileSuccess}</div>}
          {profileError && <div className="notification notification-error">{profileError}</div>}

          <form onSubmit={handleSaveProfile} className="settings-form">
            {/* Avatar & Photo Picker */}
            <div className="settings-photo-row">
              <div className="settings-avatar-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="Avatar Preview" className="settings-avatar-img" />
                ) : (
                  <div className="settings-avatar-fallback">
                    {(username || user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="settings-photo-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-red"
                    onClick={handleRemovePhoto}
                  >
                    Remove Photo
                  </button>
                )}
                <span className="form-hint">Supported: PNG, JPEG, WebP, GIF (Max 2MB).</span>
              </div>
            </div>

            {/* Username */}
            <div className="form-group">
              <label htmlFor="settings-username" className="form-label">
                Username
              </label>
              <input
                id="settings-username"
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                placeholder="Enter username"
              />
              <span className="form-hint">
                Public profile will be accessible at: <code>/user/{username.trim() || 'username'}</code>
              </span>
            </div>

            {/* Bio */}
            <div className="form-group">
              <div className="label-with-counter">
                <label htmlFor="settings-bio" className="form-label">
                  Bio (Optional)
                </label>
                <span className="char-counter">{bio.length}/200</span>
              </div>
              <textarea
                id="settings-bio"
                className="input-field textarea-field"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 200))}
                rows={3}
                maxLength={200}
                placeholder="Tell other developers about your stack, goals, or favorite languages..."
              />
            </div>

            {/* Privacy Section Integration */}
            <div className="form-group">
              <label className="form-label">Practice Statistics Visibility</label>
              <p className="form-hint" style={{ marginBottom: '0.5rem' }}>
                Control whether other developers can view your casual practice tests and metrics. Ranked tests are always public.
              </p>
              <div className="segmented-control" role="group" aria-label="Practice Stats Privacy">
                <button
                  type="button"
                  className={`segment-btn ${practiceStatsVisibility === 'private' ? 'active' : ''}`}
                  onClick={() => setPracticeStatsVisibility('private')}
                >
                  Private
                </button>
                <button
                  type="button"
                  className={`segment-btn ${practiceStatsVisibility === 'public' ? 'active' : ''}`}
                  onClick={() => setPracticeStatsVisibility('public')}
                >
                  Public
                </button>
              </div>
            </div>

            <div className="settings-form-actions">
              <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* 2. Security / Password Section */}
        <section className="panel settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Change Password</h2>
            <p className="settings-section-description">Ensure your account is protected with a secure password.</p>
          </div>

          {passwordSuccess && <div className="notification notification-success">{passwordSuccess}</div>}
          {passwordError && <div className="notification notification-error">{passwordError}</div>}

          <form onSubmit={handleChangePassword} className="settings-form">
            <div className="form-group">
              <label htmlFor="settings-current-password" className="form-label">
                Current Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="input-field"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showCurrentPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="settings-new-password" className="form-label">
                New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={128}
                  placeholder="Enter new password (min 6 characters)"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showNewPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="settings-confirm-password" className="form-label">
                Confirm New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={128}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showConfirmPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="settings-form-actions">
              <button type="submit" className="btn btn-secondary" disabled={passwordLoading}>
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Settings;
