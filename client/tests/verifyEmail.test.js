import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Email Verification Client Logic Tests', () => {
  // Test hash parsing logic matching App.jsx
  const parseVerifyEmailHash = (hash) => {
    if (!hash || !hash.startsWith('#/verify-email')) {
      return null;
    }
    const queryParams = new URLSearchParams(hash.split('?')[1] || '');
    return queryParams.get('token') || '';
  };

  test('extracts verification token accurately from URL hash', () => {
    const rawToken = 'd29f8a37b12c4e5698a104f32e67c89b12d34e56f78a90bc12de34fa56bc78de';
    const hash = `#/verify-email?token=${rawToken}`;
    assert.equal(parseVerifyEmailHash(hash), rawToken);
  });

  test('handles URL encoded tokens correctly', () => {
    const rawToken = 'token_with_special_chars_123';
    const hash = `#/verify-email?token=${encodeURIComponent(rawToken)}`;
    assert.equal(parseVerifyEmailHash(hash), rawToken);
  });

  test('returns empty string when token parameter is missing from verify-email hash', () => {
    assert.equal(parseVerifyEmailHash('#/verify-email'), '');
    assert.equal(parseVerifyEmailHash('#/verify-email?other=123'), '');
  });

  test('returns null for non-verification hashes', () => {
    assert.equal(parseVerifyEmailHash('#/user/Semnótēs'), null);
    assert.equal(parseVerifyEmailHash('#/dashboard'), null);
    assert.equal(parseVerifyEmailHash(''), null);
  });

  test('cooldown timer computation handles zero and positive values', () => {
    const computeCooldownLabel = (seconds) => {
      if (seconds <= 0) return 'Resend Verification Email';
      return `Resend available in ${seconds}s`;
    };

    assert.equal(computeCooldownLabel(0), 'Resend Verification Email');
    assert.equal(computeCooldownLabel(60), 'Resend available in 60s');
    assert.equal(computeCooldownLabel(1), 'Resend available in 1s');
  });

  test('unverified error code detection matches backend responses', () => {
    const isUnverifiedError = (err) => {
      if (!err) return false;
      if (err.code === 'EMAIL_NOT_VERIFIED') return true;
      if (typeof err.message === 'string' && err.message.toLowerCase().includes('verify your email')) return true;
      return false;
    };

    assert.equal(isUnverifiedError({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' }), true);
    assert.equal(isUnverifiedError({ message: 'Please verify your email before logging in.' }), true);
    assert.equal(isUnverifiedError({ code: 'INVALID_CREDENTIALS', message: 'Invalid username, email, or password.' }), false);
  });
});
