import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SNIPPETS,
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  getRandomSnippet,
} from '../src/data/snippets.js';

describe('Snippet System V2 Tests', () => {
  test('total snippet count is exactly 72', () => {
    assert.equal(SNIPPETS.length, 72);
  });

  test('contains exactly 8 supported languages', () => {
    assert.equal(SUPPORTED_LANGUAGES.length, 8);
    const langIds = SUPPORTED_LANGUAGES.map((l) => l.id);
    const expected = ['javascript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'sql'];
    assert.deepEqual(langIds.sort(), expected.sort());
  });

  test('contains exactly 3 canonical difficulty levels', () => {
    assert.equal(DIFFICULTY_LEVELS.length, 3);
    const diffIds = DIFFICULTY_LEVELS.map((d) => d.id);
    assert.deepEqual(diffIds.sort(), ['easy', 'hard', 'medium'].sort());
  });

  test('every language × difficulty combination has exactly 3 snippets', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const diff of DIFFICULTY_LEVELS) {
        const count = SNIPPETS.filter(
          (s) => s.language.toLowerCase() === lang.id && s.difficulty.toLowerCase() === diff.id
        ).length;
        assert.equal(
          count,
          3,
          `Expected exactly 3 snippets for ${lang.id} [${diff.id}], found ${count}`
        );
      }
    }
  });

  test('every snippet has a unique ID and non-empty code', () => {
    const ids = new Set();
    for (const snippet of SNIPPETS) {
      assert.ok(snippet.id, 'Snippet must have an ID');
      assert.equal(ids.has(snippet.id), false, `Duplicate snippet ID found: ${snippet.id}`);
      ids.add(snippet.id);

      assert.ok(typeof snippet.code === 'string' && snippet.code.trim().length > 10, `Code in ${snippet.id} must be non-empty`);
      assert.ok(typeof snippet.title === 'string' && snippet.title.length > 0, `Title in ${snippet.id} must be non-empty`);

      // Verify canonical difficulties
      assert.ok(
        ['easy', 'medium', 'hard'].includes(snippet.difficulty.toLowerCase()),
        `Difficulty ${snippet.difficulty} in ${snippet.id} is not canonical`
      );
    }
  });

  test('getRandomSnippet filters accurately by language and difficulty', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const diff of DIFFICULTY_LEVELS) {
        const picked = getRandomSnippet(lang.id, diff.id);
        assert.ok(picked, `Should return a snippet for ${lang.id} ${diff.id}`);
        assert.equal(picked.language.toLowerCase(), lang.id);
        assert.equal(picked.difficulty.toLowerCase(), diff.id);
      }
    }
  });

  test('getRandomSnippet avoids immediate repetition when multiple options exist', () => {
    const lang = 'javascript';
    const diff = 'easy';
    const first = getRandomSnippet(lang, diff);

    // Call 20 times passing first.id as previousSnippetId; it should never pick first.id
    for (let i = 0; i < 20; i++) {
      const next = getRandomSnippet(lang, diff, first.id);
      assert.notEqual(next.id, first.id, `Immediately repeated snippet ${first.id}`);
    }
  });

  test('getRandomSnippet handles unknown language/difficulty safely with fallback', () => {
    const fallback1 = getRandomSnippet('nonexistent_lang', 'medium');
    assert.ok(fallback1 && fallback1.id, 'Should safely fallback for invalid language');

    const fallback2 = getRandomSnippet('python', 'extreme_unknown');
    assert.ok(fallback2 && fallback2.language === 'python', 'Should safely fallback to language for invalid difficulty');
  });
});
