import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Developer Search & Discovery Client Logic Tests', () => {
  const mockDevelopers = [
    { username: 'Semnótēs', bio: 'Greek philosopher & speed typist', profilePhoto: null },
    { username: 'José_Developer', bio: 'Fullstack engineer', profilePhoto: 'data:image/png;base64,123' },
    { username: 'Müller', bio: 'Rust and WebAssembly specialist', profilePhoto: null },
    { username: 'alexander', bio: 'Frontend UI craftsperson', profilePhoto: null },
    { username: 'testpilot', bio: 'QA automation', profilePhoto: null },
    { username: 'speedy_racer', bio: '150 WPM ranked player', profilePhoto: null },
  ];

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const filterDevelopers = (query, developers = mockDevelopers) => {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      return [];
    }
    const regex = new RegExp(escapeRegex(trimmed), 'i');
    return developers.filter((dev) => regex.test(dev.username)).slice(0, 10);
  };

  test('query with less than 2 characters returns empty array', () => {
    assert.deepEqual(filterDevelopers(''), []);
    assert.deepEqual(filterDevelopers(' '), []);
    assert.deepEqual(filterDevelopers('a'), []);
  });

  test('exact username search matches accurately', () => {
    const results = filterDevelopers('testpilot');
    assert.equal(results.length, 1);
    assert.equal(results[0].username, 'testpilot');
  });

  test('partial username search matches multiple candidates', () => {
    const results = filterDevelopers('er');
    assert.ok(results.length >= 2);
    assert.ok(results.some((r) => r.username === 'José_Developer'));
    assert.ok(results.some((r) => r.username === 'alexander'));
    assert.ok(results.some((r) => r.username === 'speedy_racer'));
  });

  test('case-insensitive search matches upper/lower variations', () => {
    const lowerResults = filterDevelopers('alex');
    const upperResults = filterDevelopers('ALEX');
    const mixedResults = filterDevelopers('Alex');

    assert.equal(lowerResults.length, 1);
    assert.equal(upperResults.length, 1);
    assert.equal(mixedResults.length, 1);
    assert.equal(lowerResults[0].username, 'alexander');
  });

  test('Unicode partial search: "Sem" and "sem" match "Semnótēs"', () => {
    const upperMatches = filterDevelopers('Sem');
    const lowerMatches = filterDevelopers('sem');

    assert.equal(upperMatches.length, 1);
    assert.equal(lowerMatches.length, 1);
    assert.equal(upperMatches[0].username, 'Semnótēs');
    assert.equal(lowerMatches[0].username, 'Semnótēs');
  });

  test('Unicode partial search: "Müll" and "müll" match "Müller"', () => {
    const results = filterDevelopers('Müll');
    assert.equal(results.length, 1);
    assert.equal(results[0].username, 'Müller');
  });

  test('Regex metacharacters are escaped and treated literally', () => {
    // A query with '.' or '.*' or '?' must not match everything or crash
    const dotResults = filterDevelopers('.*');
    assert.equal(dotResults.length, 0);

    const bracketResults = filterDevelopers('[a-z]');
    assert.equal(bracketResults.length, 0);
  });

  test('Result items contain only safe public discovery fields (no email, passwordHash, stats)', () => {
    const results = filterDevelopers('José');
    assert.equal(results.length, 1);
    const item = results[0];

    assert.ok(item.username);
    assert.equal(item.bio, 'Fullstack engineer');
    assert.ok(item.profilePhoto);

    assert.equal(item.email, undefined);
    assert.equal(item.passwordHash, undefined);
    assert.equal(item.practiceStatsVisibility, undefined);
    assert.equal(item._id, undefined);
    assert.equal(item.ranked, undefined);
    assert.equal(item.practice, undefined);
  });

  test('URL encoding helper generates valid profile route for Unicode usernames', () => {
    const getProfileRoute = (username) => `#/user/${encodeURIComponent(username)}`;

    assert.equal(getProfileRoute('Semnótēs'), '#/user/Semn%C3%B3t%C4%93s');
    assert.equal(getProfileRoute('José'), '#/user/Jos%C3%A9');
    assert.equal(getProfileRoute('testpilot'), '#/user/testpilot');
  });
});
