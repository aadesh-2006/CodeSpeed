import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

/**
 * Helper to recursively search React element tree for elements matching predicate
 */
function findReactElements(node, predicate, results = []) {
  if (!node) return results;
  if (Array.isArray(node)) {
    for (const child of node) {
      findReactElements(child, predicate, results);
    }
    return results;
  }
  if (predicate(node)) {
    results.push(node);
  }
  if (node.props && node.props.children) {
    findReactElements(node.props.children, predicate, results);
  }
  return results;
}

describe('Component-Level Regression Tests', () => {
  let viteServer;
  let TestSetup;
  let TypingTest;

  before(async () => {
    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    const testSetupModule = await viteServer.ssrLoadModule('./src/components/TestSetup.jsx');
    TestSetup = testSetupModule.TestSetup;

    const typingTestModule = await viteServer.ssrLoadModule('./src/components/TypingTest.jsx');
    TypingTest = typingTestModule.TypingTest;
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  describe('TestSetup Component Props & Click Handlers', () => {
    test('renders with canonical props and triggers callbacks with correct arguments when clicked', () => {
      let modeSelected = null;
      let languageSelected = null;
      let difficultySelected = null;
      let durationSelected = null;
      let startTriggered = false;

      const vdom = TestSetup({
        mode: 'practice',
        language: 'javascript',
        difficulty: 'medium',
        duration: 60,
        onModeChange: (m) => { modeSelected = m; },
        onLanguageChange: (l) => { languageSelected = l; },
        onDifficultyChange: (d) => { difficultySelected = d; },
        onDurationChange: (dur) => { durationSelected = dur; },
        onStart: () => { startTriggered = true; },
      });

      assert.ok(vdom, 'TestSetup should return valid React element');

      // 1. Find all buttons in the rendered tree
      const buttons = findReactElements(vdom, (el) => el && el.type === 'button');
      assert.ok(buttons.length >= 10, 'Should render mode, language, difficulty, duration, and start buttons');

      // 2. Test Mode Click (Ranked)
      const rankedBtn = buttons.find((b) => b.props.children === 'Ranked');
      assert.ok(rankedBtn, 'Should find Ranked button');
      assert.doesNotThrow(() => rankedBtn.props.onClick(), 'Clicking Ranked button must not throw TypeError');
      assert.equal(modeSelected, 'ranked');

      // 3. Test Mode Click (Practice)
      const practiceBtn = buttons.find((b) => b.props.children === 'Practice');
      assert.ok(practiceBtn, 'Should find Practice button');
      assert.doesNotThrow(() => practiceBtn.props.onClick(), 'Clicking Practice button must not throw TypeError');
      assert.equal(modeSelected, 'practice');

      // 4. Test Language Click (Python, Java, C++, etc.)
      const pythonBtn = buttons.find((b) => b.props.children === 'Python');
      assert.ok(pythonBtn, 'Should find Python button');
      assert.doesNotThrow(() => pythonBtn.props.onClick(), 'Clicking Python button must not throw TypeError');
      assert.equal(languageSelected, 'python');

      const cppBtn = buttons.find((b) => b.props.children === 'C++');
      assert.ok(cppBtn, 'Should find C++ button');
      assert.doesNotThrow(() => cppBtn.props.onClick(), 'Clicking C++ button must not throw TypeError');
      assert.equal(languageSelected, 'cpp');

      // 5. Test Difficulty Click (Hard)
      const hardBtn = buttons.find((b) => {
        const textChild = Array.isArray(b.props.children)
          ? b.props.children.find((c) => c === 'Hard')
          : b.props.children;
        return textChild === 'Hard';
      });
      assert.ok(hardBtn, 'Should find Hard difficulty button');
      assert.doesNotThrow(() => hardBtn.props.onClick(), 'Clicking Hard difficulty button must not throw TypeError');
      assert.equal(difficultySelected, 'hard');

      // 6. Test Duration Click (1 minute -> 60s, 30 seconds -> 30s)
      const oneMinBtn = buttons.find((b) => b.props.children === '1 minute');
      assert.ok(oneMinBtn, 'Should find 1 minute button');
      assert.doesNotThrow(() => oneMinBtn.props.onClick(), 'Clicking 1 minute duration button must not throw TypeError');
      assert.equal(durationSelected, 60);

      const thirtySecBtn = buttons.find((b) => b.props.children === '30 seconds');
      assert.ok(thirtySecBtn, 'Should find 30 seconds button');
      assert.doesNotThrow(() => thirtySecBtn.props.onClick(), 'Clicking 30 seconds duration button must not throw TypeError');
      assert.equal(durationSelected, 30);

      // 7. Test Start Button Click
      const startBtn = buttons.find((b) => b.props.children === 'Start Practice Test');
      assert.ok(startBtn, 'Should find Start Practice Test button');
      assert.doesNotThrow(() => startBtn.props.onClick(), 'Clicking Start button must not throw TypeError');
      assert.equal(startTriggered, true);
    });

    test('renders in ranked mode with correct label and button text', () => {
      let startTriggered = false;
      const vdom = TestSetup({
        mode: 'ranked',
        language: 'python',
        difficulty: 'hard',
        duration: 120,
        onModeChange: () => {},
        onLanguageChange: () => {},
        onDifficultyChange: () => {},
        onDurationChange: () => {},
        onStart: () => { startTriggered = true; },
      });

      const buttons = findReactElements(vdom, (el) => el && el.type === 'button');
      const startBtn = buttons.find((b) => b.props.children === 'Start Ranked Test');
      assert.ok(startBtn, 'Should find Start Ranked Test button in ranked mode');
      assert.doesNotThrow(() => startBtn.props.onClick());
      assert.equal(startTriggered, true);
    });
  });

  describe('TypingTest Component Props & Rendering', () => {
    test('renders with canonical duration and language props, correctly rendering timer and language', () => {
      const sampleSnippet = {
        id: 'js-easy-01',
        title: 'Arrow Functions',
        language: 'javascript',
        difficulty: 'easy',
        code: 'const add = (a, b) => a + b;',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(TypingTest, {
          snippet: sampleSnippet,
          duration: 45,
          language: 'javascript',
          onFinish: () => {},
          onCancel: () => {},
          onRestart: () => {},
        })
      );

      assert.ok(html, 'TypingTest should render to valid HTML markup');

      // 1. Verify timer display consumes duration: 45s -> 00:45
      assert.ok(html.includes('00:45'), 'Rendered HTML should display formatted 00:45 timer from duration prop');

      // 2. Verify meta badges display language and difficulty
      assert.ok(html.includes('javascript'), 'Rendered HTML should display javascript language badge');
      assert.ok(html.includes('easy'), 'Rendered HTML should display easy difficulty badge');
      assert.ok(html.includes('Arrow Functions'), 'Rendered HTML should display snippet title');

      // 3. Verify action buttons (Restart & Settings/Cancel)
      assert.ok(html.includes('Restart'), 'Rendered HTML should include Restart button');
      assert.ok(html.includes('Settings'), 'Rendered HTML should include Settings button');
    });

    test('renders with 120s duration prop correctly formatting 02:00', () => {
      const sampleSnippet = {
        id: 'py-hard-01',
        title: 'Binary Tree Traversal',
        language: 'python',
        difficulty: 'hard',
        code: 'def inorder(root):\n  return inorder(root.left) + [root.val] + inorder(root.right) if root else []',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(TypingTest, {
          snippet: sampleSnippet,
          duration: 120,
          language: 'python',
          onFinish: () => {},
          onCancel: () => {},
          onRestart: () => {},
        })
      );

      assert.ok(html.includes('02:00'), 'Rendered HTML should format 120s duration as 02:00');
      assert.ok(html.includes('python'), 'Rendered HTML should display python badge');
      assert.ok(html.includes('hard'), 'Rendered HTML should display hard badge');
    });
  });
});
