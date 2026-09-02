/**
 * Static repository of coding snippets for CodeSpeed typing tests.
 * Covers all supported languages with realistic programming structures.
 */

export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'c', name: 'C' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'sql', name: 'SQL' },
];

export const TIMER_OPTIONS = [
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 120, label: '2 minutes' },
  { seconds: 180, label: '3 minutes' },
  { seconds: 240, label: '4 minutes' },
  { seconds: 300, label: '5 minutes' },
  { seconds: 600, label: '10 minutes' },
];

export const SNIPPETS = [
  // --- JavaScript ---
  {
    id: 'js-1',
    language: 'javascript',
    title: 'Array Filtering & Mapping',
    difficulty: 'easy',
    code: `const filterAndDoubleEvens = (numbers) => {
  return numbers
    .filter(num => num % 2 === 0)
    .map(num => num * 2);
};

const numbers = [1, 2, 3, 4, 5, 6];
console.log(filterAndDoubleEvens(numbers));`,
  },
  {
    id: 'js-2',
    language: 'javascript',
    title: 'Async Fetch with Error Handling',
    difficulty: 'medium',
    code: `async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error.message);
    return null;
  }
}`,
  },
  {
    id: 'js-3',
    language: 'javascript',
    title: 'Binary Search Implementation',
    difficulty: 'medium',
    code: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
  },

  // --- Python ---
  {
    id: 'py-1',
    language: 'python',
    title: 'List Comprehension & Palindrome',
    difficulty: 'easy',
    code: `def is_palindrome(text):
    clean_text = "".join(ch.lower() for ch in text if ch.isalnum())
    return clean_text == clean_text[::-1]

words = ["radar", "level", "python", "racecar"]
palindromes = [w for w in words if is_palindrome(w)]
print(palindromes)`,
  },
  {
    id: 'py-2',
    language: 'python',
    title: 'Dictionary Frequency Counter',
    difficulty: 'easy',
    code: `def count_word_frequencies(sentence):
    frequencies = {}
    tokens = sentence.lower().split()
    for token in tokens:
        frequencies[token] = frequencies.get(token, 0) + 1
    return frequencies

sample = "code fast type code improve speed"
print(count_word_frequencies(sample))`,
  },
  {
    id: 'py-3',
    language: 'python',
    title: 'Quick Sort Algorithm',
    difficulty: 'medium',
    code: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

numbers = [38, 27, 43, 3, 9, 82, 10]
print(quick_sort(numbers))`,
  },

  // --- Java ---
  {
    id: 'java-1',
    language: 'java',
    title: 'Main Class & Factorial',
    difficulty: 'easy',
    code: `public class FactorialCalculator {
    public static long compute(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * compute(n - 1);
    }

    public static void main(String[] args) {
        int target = 6;
        System.out.println("Factorial: " + compute(target));
    }
}`,
  },
  {
    id: 'java-2',
    language: 'java',
    title: 'Generic Stack Implementation',
    difficulty: 'medium',
    code: `import java.util.ArrayList;

public class CustomStack<T> {
    private ArrayList<T> elements = new ArrayList<>();

    public void push(T item) {
        elements.add(item);
    }

    public T pop() {
        if (elements.isEmpty()) {
            throw new IllegalStateException("Stack is empty");
        }
        return elements.remove(elements.size() - 1);
    }
}`,
  },

  // --- C++ ---
  {
    id: 'cpp-1',
    language: 'cpp',
    title: 'Vector Sorting & Output',
    difficulty: 'easy',
    code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> numbers = {5, 2, 8, 1, 9, 3};
    std::sort(numbers.begin(), numbers.end());

    for (const auto& num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
    return 0;
}`,
  },
  {
    id: 'cpp-2',
    language: 'cpp',
    title: 'Fibonacci with Dynamic Programming',
    difficulty: 'medium',
    code: `#include <iostream>
#include <vector>

long long fibonacci(int n) {
    if (n <= 1) return n;
    std::vector<long long> dp(n + 1);
    dp[0] = 0;
    dp[1] = 1;
    for (int i = 2; i <= n; ++i) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
}

int main() {
    std::cout << "Fib 15: " << fibonacci(15) << std::endl;
    return 0;
}`,
  },

  // --- C ---
  {
    id: 'c-1',
    language: 'c',
    title: 'Pointer String Reverse',
    difficulty: 'medium',
    code: `#include <stdio.h>
#include <string.h>

void reverse_string(char *str) {
    int length = strlen(str);
    char *start = str;
    char *end = str + length - 1;

    while (start < end) {
        char temp = *start;
        *start = *end;
        *end = temp;
        start++;
        end--;
    }
}

int main() {
    char msg[] = "CodeSpeed";
    reverse_string(msg);
    printf("Reversed: %s\\n", msg);
    return 0;
}`,
  },
  {
    id: 'c-2',
    language: 'c',
    title: 'Dynamic Array Allocation',
    difficulty: 'easy',
    code: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n = 5;
    int *arr = (int *)malloc(n * sizeof(int));
    if (arr == NULL) return 1;

    for (int i = 0; i < n; i++) {
        arr[i] = (i + 1) * 10;
        printf("%d ", arr[i]);
    }
    printf("\\n");
    free(arr);
    return 0;
}`,
  },

  // --- HTML ---
  {
    id: 'html-1',
    language: 'html',
    title: 'Accessible Navbar & Hero',
    difficulty: 'easy',
    code: `<nav class="navbar" role="navigation">
  <div class="logo">
    <a href="/">CodeSpeed</a>
  </div>
  <ul class="nav-links">
    <li><a href="/practice">Practice</a></li>
    <li><a href="/leaderboard">Leaderboard</a></li>
    <li><button type="button" class="btn">Sign In</button></li>
  </ul>
</nav>`,
  },
  {
    id: 'html-2',
    language: 'html',
    title: 'Form with Validation Attributes',
    difficulty: 'easy',
    code: `<form id="user-profile" action="/submit" method="POST">
  <fieldset>
    <legend>Account Details</legend>
    <label for="username">Username:</label>
    <input type="text" id="username" name="username" required minlength="3" />

    <label for="user-email">Email Address:</label>
    <input type="email" id="user-email" name="email" required />

    <button type="submit">Update Profile</button>
  </fieldset>
</form>`,
  },

  // --- CSS ---
  {
    id: 'css-1',
    language: 'css',
    title: 'Modern Flexbox Card Component',
    difficulty: 'easy',
    code: `.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  background-color: #1e293b;
  border-radius: 12px;
  border: 1px solid #334155;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease-in-out;
}

.profile-card:hover {
  transform: translateY(-4px);
}`,
  },
  {
    id: 'css-2',
    language: 'css',
    title: 'CSS Grid Responsive Layout',
    difficulty: 'medium',
    code: `.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 1rem;
  }
}`,
  },

  // --- SQL ---
  {
    id: 'sql-1',
    language: 'sql',
    title: 'Aggregating High Scores',
    difficulty: 'easy',
    code: `SELECT user_id, username, MAX(wpm) AS top_wpm, AVG(accuracy) AS avg_accuracy
FROM typing_tests
JOIN users ON users.id = typing_tests.user_id
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, username
HAVING COUNT(test_id) >= 5
ORDER BY top_wpm DESC
LIMIT 10;`,
  },
  {
    id: 'sql-2',
    language: 'sql',
    title: 'Creating Indexed Users Table',
    difficulty: 'easy',
    code: `CREATE TABLE IF NOT EXISTS developers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  primary_language VARCHAR(30) DEFAULT 'javascript',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_developers_email ON developers(email);`,
  },
];

/**
 * Get a snippet for the requested language.
 * Avoids picking the exact same snippet repeatedly if multiple options exist.
 *
 * @param {string} languageId - e.g. 'javascript', 'python'
 * @param {string} [previousId] - The ID of the snippet to avoid repeating
 * @returns {object} Snippet object
 */
export function getRandomSnippet(languageId, previousId) {
  const matching = SNIPPETS.filter((s) => s.language.toLowerCase() === languageId.toLowerCase());
  if (matching.length === 0) {
    return SNIPPETS[0];
  }
  if (matching.length === 1) {
    return matching[0];
  }
  const filtered = matching.filter((s) => s.id !== previousId);
  const pool = filtered.length > 0 ? filtered : matching;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

export default SNIPPETS;
