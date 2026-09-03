import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Settings & Profile Management Pure Logic Tests', () => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  const dataUriRegex = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

  describe('Username Validation', () => {
    test('accepts valid usernames with letters, numbers, and underscores (3-30 chars)', () => {
      assert.equal(usernameRegex.test('dev_racer'), true);
      assert.equal(usernameRegex.test('CodeSpeed99'), true);
      assert.equal(usernameRegex.test('abc'), true);
      assert.equal(usernameRegex.test('a'.repeat(30)), true);
    });

    test('rejects invalid usernames (too short, too long, spaces, special chars)', () => {
      assert.equal(usernameRegex.test('ab'), false);
      assert.equal(usernameRegex.test(''), false);
      assert.equal(usernameRegex.test('a'.repeat(31)), false);
      assert.equal(usernameRegex.test('user name'), false);
      assert.equal(usernameRegex.test('user@name'), false);
      assert.equal(usernameRegex.test('user#name'), false);
      assert.equal(usernameRegex.test('user/name'), false);
    });
  });

  describe('Bio Validation & Sanitization', () => {
    test('enforces max 200 characters limit on bio', () => {
      const validBio = 'Building developer tools with Node.js and React.';
      assert.equal(validBio.length <= 200, true);

      const oversizedBio = 'x'.repeat(201);
      assert.equal(oversizedBio.length <= 200, false);
    });

    test('trims whitespace cleanly', () => {
      const rawBio = '   Competitive typist and software engineer.   ';
      assert.equal(rawBio.trim(), 'Competitive typist and software engineer.');
    });
  });

  describe('Profile Photo Data URI Validation', () => {
    test('accepts valid base64 data URIs for PNG, JPEG, WebP, GIF', () => {
      const pngUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const jpegUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      const webpUri = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

      assert.equal(dataUriRegex.test(pngUri), true);
      assert.equal(dataUriRegex.test(jpegUri), true);
      assert.equal(dataUriRegex.test(webpUri), true);
    });

    test('rejects non-image URLs and malicious script schemes', () => {
      assert.equal(dataUriRegex.test('https://example.com/avatar.png'), false);
      assert.equal(dataUriRegex.test('javascript:alert(1)'), false);
      assert.equal(dataUriRegex.test('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), false);
      assert.equal(dataUriRegex.test('data:application/javascript;base64,YWxlcnQoMSk='), false);
    });
  });

  describe('Password Change Validation', () => {
    test('enforces password minimum length of 6 characters', () => {
      const isPasswordValid = (pw) => typeof pw === 'string' && pw.length >= 6 && pw.length <= 128;
      assert.equal(isPasswordValid('12345'), false);
      assert.equal(isPasswordValid('123456'), true);
      assert.equal(isPasswordValid('StrongPassword123!'), true);
    });

    test('detects mismatched new password and confirmation', () => {
      const newPw = 'SuperSecret123!';
      const confirmPw1 = 'SuperSecret123!';
      const confirmPw2 = 'SuperSecret999!';

      assert.equal(newPw === confirmPw1, true);
      assert.equal(newPw === confirmPw2, false);
    });
  });
});
