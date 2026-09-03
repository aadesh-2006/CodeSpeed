import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWPM,
  calculateAccuracy,
  formatTime,
  compareCharacters,
  getNextLineIndent,
  getSyntaxIndentation,
} from '../src/utils/typingMetrics.js';

describe('Typing Engine Pure Logic Tests', () => {
  describe('calculateWPM', () => {
    test('300 correct characters in 60 seconds equals 60 WPM', () => {
      assert.equal(calculateWPM(300, 60), 60);
    });

    test('150 correct characters in 30 seconds equals 60 WPM', () => {
      assert.equal(calculateWPM(150, 30), 60);
    });

    test('500 correct characters in 120 seconds equals 50 WPM', () => {
      assert.equal(calculateWPM(500, 120), 50);
    });

    test('returns 0 when correct characters is 0 or negative', () => {
      assert.equal(calculateWPM(0, 60), 0);
      assert.equal(calculateWPM(-10, 60), 0);
    });

    test('returns 0 when elapsed seconds is 0 or negative', () => {
      assert.equal(calculateWPM(100, 0), 0);
      assert.equal(calculateWPM(100, -5), 0);
    });

    test('rounds WPM sensibly to nearest integer', () => {
      assert.equal(calculateWPM(14, 20), 8);
      assert.equal(calculateWPM(16, 20), 10);
    });
  });

  describe('calculateAccuracy', () => {
    test('returns 0 when total typed characters is 0', () => {
      assert.equal(calculateAccuracy(0, 0), 0);
    });

    test('returns 100% when all typed characters are correct', () => {
      assert.equal(calculateAccuracy(100, 100), 100);
    });

    test('calculates accuracy percentage rounded to 1 decimal place', () => {
      assert.equal(calculateAccuracy(96, 100), 96);
      assert.equal(calculateAccuracy(487, 505), 96.4);
      assert.equal(calculateAccuracy(48, 50), 96);
    });

    test('returns 0 when 0 correct characters with non-zero typed', () => {
      assert.equal(calculateAccuracy(0, 25), 0);
    });
  });

  describe('formatTime', () => {
    test('formats standard seconds correctly', () => {
      assert.equal(formatTime(30), '00:30');
      assert.equal(formatTime(60), '01:00');
      assert.equal(formatTime(120), '02:00');
      assert.equal(formatTime(180), '03:00');
      assert.equal(formatTime(240), '04:00');
      assert.equal(formatTime(300), '05:00');
      assert.equal(formatTime(600), '10:00');
    });

    test('handles 0 and negative inputs safely', () => {
      assert.equal(formatTime(0), '00:00');
      assert.equal(formatTime(-10), '00:00');
      assert.equal(formatTime(null), '00:00');
    });

    test('formats odd seconds with leading zeros', () => {
      assert.equal(formatTime(5), '00:05');
      assert.equal(formatTime(65), '01:05');
    });
  });

  describe('Auto Indentation (Editor Behavior)', () => {
    test('Java: Enter after { indents, nested { indents further, and } dedents', () => {
      const target = `public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < n; i++) {\n      System.out.println(i);\n    }\n  }\n}`;

      // Line 1: After "public class Main {"
      const indent1 = getNextLineIndent(target, 'public class Main {', 'java');
      assert.equal(indent1, '  ');

      // Line 2: After "public static void main..."
      const indent2 = getNextLineIndent(target, 'public class Main {\n  public static void main(String[] args) {', 'java');
      assert.equal(indent2, '    ');

      // Line 3: After "for..."
      const indent3 = getNextLineIndent(target, 'public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < n; i++) {', 'java');
      assert.equal(indent3, '      ');

      // Line 4: After "System.out.println(i);" -> next line in target is "    }"
      const indent4 = getNextLineIndent(target, 'public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < n; i++) {\n      System.out.println(i);', 'java');
      assert.equal(indent4, '    ');

      // Line 5: After closing inner brace "    }" -> next line is "  }"
      const indent5 = getNextLineIndent(target, 'public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < n; i++) {\n      System.out.println(i);\n    }', 'java');
      assert.equal(indent5, '  ');

      // Line 6: After method closing brace "  }" -> next line is "}"
      const indent6 = getNextLineIndent(target, 'public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < n; i++) {\n      System.out.println(i);\n    }\n  }', 'java');
      assert.equal(indent6, '');
    });

    test('C/C++/JavaScript: brace indentation and closing dedent', () => {
      const target = `function test() {\n  if (condition) {\n    console.log("hello");\n  }\n}`;
      const indent1 = getNextLineIndent(target, 'function test() {', 'javascript');
      assert.equal(indent1, '  ');

      const indent2 = getNextLineIndent(target, 'function test() {\n  if (condition) {', 'javascript');
      assert.equal(indent2, '    ');

      const indent3 = getNextLineIndent(target, 'function test() {\n  if (condition) {\n    console.log("hello");', 'javascript');
      assert.equal(indent3, '  ');
    });

    test('Python: colon indentation and nested blocks', () => {
      const target = `def test():\n  if condition:\n    for item in items:\n      print(item)`;
      const indent1 = getNextLineIndent(target, 'def test():', 'python');
      assert.equal(indent1, '  ');

      const indent2 = getNextLineIndent(target, 'def test():\n  if condition:', 'python');
      assert.equal(indent2, '    ');

      const indent3 = getNextLineIndent(target, 'def test():\n  if condition:\n    for item in items:', 'python');
      assert.equal(indent3, '      ');
    });

    test('HTML: opening tag indentation and closing tag alignment', () => {
      const target = `<div>\n  <section>\n    <p>Hello</p>\n  </section>\n</div>`;
      const indent1 = getNextLineIndent(target, '<div>', 'html');
      assert.equal(indent1, '  ');

      const indent2 = getNextLineIndent(target, '<div>\n  <section>', 'html');
      assert.equal(indent2, '    ');

      const indent3 = getNextLineIndent(target, '<div>\n  <section>\n    <p>Hello</p>', 'html');
      assert.equal(indent3, '  ');

      const indent4 = getNextLineIndent(target, '<div>\n  <section>\n    <p>Hello</p>\n  </section>', 'html');
      assert.equal(indent4, '');
    });

    test('CSS: brace-based block indentation', () => {
      const target = `.container {\n  .child {\n    display: block;\n  }\n}`;
      const indent1 = getNextLineIndent(target, '.container {', 'css');
      assert.equal(indent1, '  ');

      const indent2 = getNextLineIndent(target, '.container {\n  .child {', 'css');
      assert.equal(indent2, '    ');
    });

    test('Pure rule fallback: getSyntaxIndentation handles C-like, Python, and HTML with 2 spaces', () => {
      assert.equal(getSyntaxIndentation('int main() {', 'c'), '  ');
      assert.equal(getSyntaxIndentation('def compute():', 'python'), '  ');
      assert.equal(getSyntaxIndentation('<div>', 'html'), '  ');
    });
  });

  describe('Optional Syntax Whitespace (Tolerated Equivalence)', () => {
    test('for (int i = 0; i < n; i++) is equivalent to compact for(int i=0;i<n;i++)', () => {
      const target = 'for (int i = 0; i < n; i++) {';
      const typedCompact = 'for(int i=0;i<n;i++){';
      const result = compareCharacters(target, typedCompact, { language: 'java' });
      assert.equal(result.isComplete, true);
      assert.equal(result.incorrectCount, 0);
      assert.equal(result.correctCount, target.length);
    });

    test('x = 10 is equivalent to x=10', () => {
      const target = 'int x = 10;';
      const typed = 'int x=10;';
      const result = compareCharacters(target, typed, { language: 'c' });
      assert.equal(result.isComplete, true);
      assert.equal(result.incorrectCount, 0);
    });

    test('a, b is equivalent to a,b', () => {
      const target = 'foo(a, b);';
      const typed = 'foo(a,b);';
      const result = compareCharacters(target, typed, { language: 'javascript' });
      assert.equal(result.isComplete, true);
      assert.equal(result.incorrectCount, 0);
    });

    test('if (x > 0) is equivalent to if(x>0)', () => {
      const target = 'if (x > 0) {';
      const typed = 'if(x>0){';
      const result = compareCharacters(target, typed, { language: 'javascript' });
      assert.equal(result.isComplete, true);
      assert.equal(result.incorrectCount, 0);
    });

    test('a + b is equivalent to a+b', () => {
      const target = 'return a + b;';
      const typed = 'return a+b;';
      const result = compareCharacters(target, typed, { language: 'java' });
      assert.equal(result.isComplete, true);
      assert.equal(result.incorrectCount, 0);
    });
  });

  describe('Required Token-Separating Whitespace (User MUST Type)', () => {
    test('publicstatic int fails against public static int', () => {
      const target = 'public static int add(int a, int b)';
      const typed = 'publicstatic int add(int a, int b)';
      const result = compareCharacters(target, typed, { language: 'java' });
      assert.equal(result.isComplete, false);
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('publicint fails against public int', () => {
      const target = 'public int count = 0;';
      const typed = 'publicint count = 0;';
      const result = compareCharacters(target, typed, { language: 'java' });
      assert.equal(result.isComplete, false);
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('returna fails against return a', () => {
      const target = 'return a + b;';
      const typed = 'returna + b;';
      const result = compareCharacters(target, typed, { language: 'java' });
      assert.equal(result.isComplete, false);
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('intx=10 fails on intx against int x = 10', () => {
      const target = 'int x = 10;';
      const typed = 'intx=10;';
      const result = compareCharacters(target, typed, { language: 'c' });
      assert.equal(result.isComplete, false);
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('deffoo fails against def foo in Python', () => {
      const target = 'def foo():';
      const typed = 'deffoo():';
      const result = compareCharacters(target, typed, { language: 'python' });
      assert.equal(result.isComplete, false);
      assert.equal(result.incorrectCount >= 1, true);
    });
  });

  describe('Meaningful Whitespace Preservation', () => {
    test('strings containing spaces must preserve internal whitespace', () => {
      const target = 'String msg = "hello world";';
      const typedNoSpaceInString = 'String msg = "helloworld";';
      const result = compareCharacters(target, typedNoSpaceInString, { language: 'java' });
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('comments preserve meaningful text whitespace', () => {
      const target = '// calculate sum';
      const typedNoSpace = '//calculatesum';
      const result = compareCharacters(target, typedNoSpace, { language: 'javascript' });
      assert.equal(result.incorrectCount >= 1, true);
    });

    test('Python leading indentation is preserved as structural', () => {
      const target = 'def foo():\n  return 42';
      const typedNoIndent = 'def foo():\nreturn 42';
      const result = compareCharacters(target, typedNoIndent, { language: 'python' });
      assert.equal(result.incorrectCount >= 1, true);
    });
  });

  describe('Typing Metrics Integrity & Backend Anti-Tamper Compatibility', () => {
    test('meaningfulCorrectCount excludes auto-indent leading spaces from WPM calculation', () => {
      const target = 'class Main {\n  int x = 1;\n}';
      const typed = 'class Main {\n  int x = 1;\n}';
      const result = compareCharacters(target, typed, { language: 'java' });
      assert.equal(result.isComplete, true);
      assert.equal(result.correctCount, target.length);
      // The 2 leading spaces on line 2 are indent spaces and not counted towards meaningful typing inflation
      assert.equal(result.meaningfulCorrectCount, target.length - 2);
    });

    test('multiline snippet produces WPM and correctChars that satisfy backend anti-tamper constraints', () => {
      const target = `public class Main {\n  public static int add(int a, int b) {\n    return a + b;\n  }\n}`;
      const typed = `public class Main {\n  public static int add(int a, int b) {\n    return a + b;\n  }\n}`;
      const result = compareCharacters(target, typed, { language: 'java' });
      
      const elapsedSeconds = 30;
      const correctChars = result.meaningfulCorrectCount;
      const incorrectChars = result.incorrectCount;
      const wpm = calculateWPM(correctChars, elapsedSeconds);
      const accuracy = calculateAccuracy(correctChars, correctChars + incorrectChars);

      // Backend anti-tamper checks:
      const expectedWpm = (correctChars / 5) / (elapsedSeconds / 60);
      const expectedAccuracy = (correctChars / (correctChars + incorrectChars)) * 100;

      assert.equal(Math.abs(wpm - expectedWpm) <= 4.0, true, `WPM ${wpm} should be within 4.0 of expected ${expectedWpm}`);
      assert.equal(Math.abs(accuracy - expectedAccuracy) <= 2.0, true, `Accuracy ${accuracy} should be within 2.0 of expected ${expectedAccuracy}`);
      assert.equal(result.isComplete, true);
    });

    test('empty typed string has 0 correct and first char current', () => {
      const target = 'const x = 10;';
      const result = compareCharacters(target, '');
      assert.equal(result.correctCount, 0);
      assert.equal(result.incorrectCount, 0);
      assert.equal(result.totalTyped, 0);
      assert.equal(result.currentPosition, 0);
      assert.equal(result.isComplete, false);
      assert.equal(result.charStatuses[0].status, 'current');
    });

    test('handles excess characters typed beyond target length', () => {
      const target = 'abc';
      const typed = 'abcdef';
      const result = compareCharacters(target, typed);
      assert.equal(result.correctCount, 3);
      assert.equal(result.incorrectCount, 3);
      assert.equal(result.totalTyped, 6);
      assert.equal(result.isComplete, false);
    });
  });
});
