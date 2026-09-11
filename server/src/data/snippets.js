/**
 * Curated repository of 72 realistic coding snippets for CodeSpeed typing tests.
 * Exactly 8 languages × 3 difficulty levels × 3 snippets each = 72 snippets.
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

export const DIFFICULTY_LEVELS = [
  { id: 'easy', name: 'Easy' },
  { id: 'medium', name: 'Medium' },
  { id: 'hard', name: 'Hard' },
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
  // ==========================================
  // JAVASCRIPT
  // ==========================================
  // Easy
  {
    id: 'js-easy-01',
    language: 'javascript',
    difficulty: 'easy',
    title: 'Array Filtering & Mapping',
    code: `const filterAndDoubleEvens = (numbers) => {
  return numbers
    .filter(num => num % 2 === 0)
    .map(num => num * 2);
};

const numbers = [1, 2, 3, 4, 5, 6];
console.log(filterAndDoubleEvens(numbers));`,
  },
  {
    id: 'js-easy-02',
    language: 'javascript',
    difficulty: 'easy',
    title: 'String Palindrome Checker',
    code: `function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reversed = clean.split('').reverse().join('');
  return clean === reversed;
}

console.log(isPalindrome('racecar'));`,
  },
  {
    id: 'js-easy-03',
    language: 'javascript',
    difficulty: 'easy',
    title: 'Object Property Counter',
    code: `function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      count += 1;
    }
  }
  return count;
}

const config = { host: 'localhost', port: 5000, secure: true };
console.log(countKeys(config));`,
  },
  // Medium
  {
    id: 'js-medium-01',
    language: 'javascript',
    difficulty: 'medium',
    title: 'Async Fetch with Error Handling',
    code: `async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
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
    id: 'js-medium-02',
    language: 'javascript',
    difficulty: 'medium',
    title: 'Binary Search Implementation',
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
  {
    id: 'js-medium-03',
    language: 'javascript',
    difficulty: 'medium',
    title: 'Debounce Utility Function',
    code: `function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}`,
  },
  // Hard
  {
    id: 'js-hard-01',
    language: 'javascript',
    difficulty: 'hard',
    title: 'Event Emitter Pub/Sub Class',
    code: `class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(eventName, listener) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName).push(listener);
    return () => this.off(eventName, listener);
  }

  emit(eventName, ...args) {
    const listeners = this.events.get(eventName) || [];
    listeners.forEach(fn => fn(...args));
  }

  off(eventName, listener) {
    const listeners = this.events.get(eventName);
    if (!listeners) return;
    this.events.set(eventName, listeners.filter(l => l !== listener));
  }
}`,
  },
  {
    id: 'js-hard-02',
    language: 'javascript',
    difficulty: 'hard',
    title: 'Deep Object Clone with Circular Reference',
    code: `function deepClone(obj, hash = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (hash.has(obj)) {
    return hash.get(obj);
  }

  const copy = Array.isArray(obj) ? [] : {};
  hash.set(obj, copy);

  for (const key of Reflect.ownKeys(obj)) {
    copy[key] = deepClone(obj[key], hash);
  }
  return copy;
}`,
  },
  {
    id: 'js-hard-03',
    language: 'javascript',
    difficulty: 'hard',
    title: 'LRU Cache Implementation',
    code: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}`,
  },

  // ==========================================
  // PYTHON
  // ==========================================
  // Easy
  {
    id: 'py-easy-01',
    language: 'python',
    difficulty: 'easy',
    title: 'List Comprehension & Palindrome',
    code: `def is_palindrome(text):
    clean_text = "".join(ch.lower() for ch in text if ch.isalnum())
    return clean_text == clean_text[::-1]

words = ["radar", "level", "python", "racecar"]
palindromes = [w for w in words if is_palindrome(w)]
print(palindromes)`,
  },
  {
    id: 'py-easy-02',
    language: 'python',
    difficulty: 'easy',
    title: 'Word Frequency Dictionary Counter',
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
    id: 'py-easy-03',
    language: 'python',
    difficulty: 'easy',
    title: 'Temperature Conversion Loop',
    code: `def celsius_to_fahrenheit(celsius):
    return (celsius * 9 / 5) + 32

temps_celsius = [0, 15, 25, 30, 100]
temps_fahrenheit = [celsius_to_fahrenheit(t) for t in temps_celsius]
for c, f in zip(temps_celsius, temps_fahrenheit):
    print(f"{c}C is equal to {f:.1f}F")`,
  },
  // Medium
  {
    id: 'py-medium-01',
    language: 'python',
    difficulty: 'medium',
    title: 'Quick Sort Algorithm',
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
  {
    id: 'py-medium-02',
    language: 'python',
    difficulty: 'medium',
    title: 'Custom Function Timing Decorator',
    code: `import time
from functools import wraps

def timeit_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        duration = time.perf_counter() - start
        print(f"[{func.__name__}] took {duration:.4f}s")
        return result
    return wrapper`,
  },
  {
    id: 'py-medium-03',
    language: 'python',
    difficulty: 'medium',
    title: 'Fibonacci Generator Function',
    code: `def fibonacci_generator(limit):
    a, b = 0, 1
    count = 0
    while count < limit:
        yield a
        a, b = b, a + b
        count += 1

sequence = list(fibonacci_generator(10))
print(f"First 10 Fibonacci numbers: {sequence}")`,
  },
  // Hard
  {
    id: 'py-hard-01',
    language: 'python',
    difficulty: 'hard',
    title: 'Binary Search Tree Insertion',
    code: `class TreeNode:
    def __init__(self, value):
        self.val = value
        self.left = None
        self.right = None

class BST:
    def __init__(self):
        self.root = None

    def insert(self, value):
        if not self.root:
            self.root = TreeNode(value)
            return
        curr = self.root
        while True:
            if value < curr.val:
                if not curr.left:
                    curr.left = TreeNode(value)
                    break
                curr = curr.left
            else:
                if not curr.right:
                    curr.right = TreeNode(value)
                    break
                curr = curr.right`,
  },
  {
    id: 'py-hard-02',
    language: 'python',
    difficulty: 'hard',
    title: 'Matrix Multiplication with Validation',
    code: `def multiply_matrices(matrix_a, matrix_b):
    rows_a = len(matrix_a)
    cols_a = len(matrix_a[0])
    rows_b = len(matrix_b)
    cols_b = len(matrix_b[0])

    if cols_a != rows_b:
        raise ValueError("Incompatible dimensions for multiplication")

    result = [[0] * cols_b for _ in range(rows_a)]
    for i in range(rows_a):
        for j in range(cols_b):
            result[i][j] = sum(
                matrix_a[i][k] * matrix_b[k][j] for k in range(cols_a)
            )
    return result`,
  },
  {
    id: 'py-hard-03',
    language: 'python',
    difficulty: 'hard',
    title: 'Thread-Safe Singleton Class',
    code: `import threading

class ThreadSafeSingleton:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self, config_data):
        self.config = config_data`,
  },

  // ==========================================
  // JAVA
  // ==========================================
  // Easy
  {
    id: 'java-easy-01',
    language: 'java',
    difficulty: 'easy',
    title: 'Factorial Calculator with Recursion',
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
    id: 'java-easy-02',
    language: 'java',
    difficulty: 'easy',
    title: 'Array Reversal In Place',
    code: `public class ArrayReverser {
    public static void reverse(int[] nums) {
        int start = 0;
        int end = nums.length - 1;
        while (start < end) {
            int temp = nums[start];
            nums[start] = nums[end];
            nums[end] = temp;
            start++;
            end--;
        }
    }
}`,
  },
  {
    id: 'java-easy-03',
    language: 'java',
    difficulty: 'easy',
    title: 'Vowel Counter in String',
    code: `public class VowelCounter {
    public static int countVowels(String input) {
        int count = 0;
        String vowels = "aeiouAEIOU";
        for (int i = 0; i < input.length(); i++) {
            if (vowels.indexOf(input.charAt(i)) != -1) {
                count++;
            }
        }
        return count;
    }
}`,
  },
  // Medium
  {
    id: 'java-medium-01',
    language: 'java',
    difficulty: 'medium',
    title: 'Generic Stack Implementation',
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

    public boolean isEmpty() {
        return elements.isEmpty();
    }
}`,
  },
  {
    id: 'java-medium-02',
    language: 'java',
    difficulty: 'medium',
    title: 'Merge Two Sorted Arrays',
    code: `public class SortedArrayMerger {
    public static int[] merge(int[] a, int[] b) {
        int[] merged = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;

        while (i < a.length && j < b.length) {
            if (a[i] <= b[j]) {
                merged[k++] = a[i++];
            } else {
                merged[k++] = b[j++];
            }
        }
        while (i < a.length) merged[k++] = a[i++];
        while (j < b.length) merged[k++] = b[j++];
        return merged;
    }
}`,
  },
  {
    id: 'java-medium-03',
    language: 'java',
    difficulty: 'medium',
    title: 'Synchronized Bank Account',
    code: `public class BankAccount {
    private double balance;

    public BankAccount(double initialBalance) {
        this.balance = initialBalance;
    }

    public synchronized void deposit(double amount) {
        if (amount > 0) {
            this.balance += amount;
        }
    }

    public synchronized boolean withdraw(double amount) {
        if (amount > 0 && this.balance >= amount) {
            this.balance -= amount;
            return true;
        }
        return false;
    }
}`,
  },
  // Hard
  {
    id: 'java-hard-01',
    language: 'java',
    difficulty: 'hard',
    title: 'Singly Linked List with Reverse',
    code: `public class LinkedListReverser<T> {
    static class Node<T> {
        T data;
        Node<T> next;
        Node(T val) { this.data = val; }
    }

    public static <T> Node<T> reverse(Node<T> head) {
        Node<T> prev = null;
        Node<T> current = head;
        while (current != null) {
            Node<T> nextNode = current.next;
            current.next = prev;
            prev = current;
            current = nextNode;
        }
        return prev;
    }
}`,
  },
  {
    id: 'java-hard-02',
    language: 'java',
    difficulty: 'hard',
    title: 'Producer Consumer with BlockingQueue',
    code: `import java.util.concurrent.BlockingQueue;

public class TaskProcessor implements Runnable {
    private final BlockingQueue<String> queue;
    private volatile boolean running = true;

    public TaskProcessor(BlockingQueue<String> queue) {
        this.queue = queue;
    }

    @Override
    public void run() {
        while (running) {
            try {
                String task = queue.take();
                System.out.println("Processing: " + task);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}`,
  },
  {
    id: 'java-hard-03',
    language: 'java',
    difficulty: 'hard',
    title: 'Dijkstra Priority Queue Algorithm',
    code: `import java.util.*;

public class ShortestPathFinder {
    static class Edge {
        int to, weight;
        Edge(int to, int weight) { this.to = to; this.weight = weight; }
    }

    public static int[] dijkstra(List<List<Edge>> graph, int source, int n) {
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[source] = 0;

        PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[1]));
        pq.offer(new int[]{source, 0});

        while (!pq.isEmpty()) {
            int[] curr = pq.poll();
            int u = curr[0], d = curr[1];
            if (d > dist[u]) continue;

            for (Edge e : graph.get(u)) {
                if (dist[u] + e.weight < dist[e.to]) {
                    dist[e.to] = dist[u] + e.weight;
                    pq.offer(new int[]{e.to, dist[e.to]});
                }
            }
        }
        return dist;
    }
}`,
  },

  // ==========================================
  // C++
  // ==========================================
  // Easy
  {
    id: 'cpp-easy-01',
    language: 'cpp',
    difficulty: 'easy',
    title: 'Vector Sorting & Output',
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
    id: 'cpp-easy-02',
    language: 'cpp',
    difficulty: 'easy',
    title: 'String Palindrome with Iterators',
    code: `#include <iostream>
#include <string>
#include <algorithm>

bool isPalindrome(const std::string& str) {
    auto left = str.begin();
    auto right = str.end() - 1;
    while (left < right) {
        if (*left != *right) return false;
        ++left;
        --right;
    }
    return true;
}`,
  },
  {
    id: 'cpp-easy-03',
    language: 'cpp',
    difficulty: 'easy',
    title: 'Point Coordinate Structure',
    code: `#include <iostream>
#include <cmath>

struct Point {
    double x, y;
};

double calculateDistance(const Point& p1, const Point& p2) {
    double dx = p1.x - p2.x;
    double dy = p1.y - p2.y;
    return std::sqrt(dx * dx + dy * dy);
}`,
  },
  // Medium
  {
    id: 'cpp-medium-01',
    language: 'cpp',
    difficulty: 'medium',
    title: 'Fibonacci Dynamic Programming',
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
  {
    id: 'cpp-medium-02',
    language: 'cpp',
    difficulty: 'medium',
    title: 'RAII Resource Handle Wrapper',
    code: `#include <iostream>
#include <memory>

class FileHandle {
    FILE* file;
public:
    explicit FileHandle(const char* filename, const char* mode) {
        file = fopen(filename, mode);
    }
    ~FileHandle() {
        if (file) fclose(file);
    }
    FILE* get() const { return file; }
};`,
  },
  {
    id: 'cpp-medium-03',
    language: 'cpp',
    difficulty: 'medium',
    title: 'Binary Tree In-Order Traversal',
    code: `#include <iostream>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    explicit TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

void inOrderTraversal(TreeNode* root) {
    if (!root) return;
    inOrderTraversal(root->left);
    std::cout << root->val << " ";
    inOrderTraversal(root->right);
}`,
  },
  // Hard
  {
    id: 'cpp-hard-01',
    language: 'cpp',
    difficulty: 'hard',
    title: 'Template Dynamic Vector Container',
    code: `#include <cstddef>
#include <utility>

template <typename T>
class SimpleVector {
    T* data;
    size_t cap;
    size_t sz;
public:
    SimpleVector() : data(nullptr), cap(0), sz(0) {}
    ~SimpleVector() { delete[] data; }

    void push_back(const T& val) {
        if (sz == cap) {
            size_t newCap = cap == 0 ? 1 : cap * 2;
            T* newData = new T[newCap];
            for (size_t i = 0; i < sz; ++i) newData[i] = std::move(data[i]);
            delete[] data;
            data = newData;
            cap = newCap;
        }
        data[sz++] = val;
    }
    size_t size() const { return sz; }
};`,
  },
  {
    id: 'cpp-hard-02',
    language: 'cpp',
    difficulty: 'hard',
    title: 'Graph Breadth-First Search',
    code: `#include <vector>
#include <queue>

void bfs(int startNode, const std::vector<std::vector<int>>& adj, std::vector<bool>& visited) {
    std::queue<int> q;
    visited[startNode] = true;
    q.push(startNode);

    while (!q.empty()) {
        int u = q.front();
        q.pop();

        for (int neighbor : adj[u]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.push(neighbor);
            }
        }
    }
}`,
  },
  {
    id: 'cpp-hard-03',
    language: 'cpp',
    difficulty: 'hard',
    title: 'Thread Safe Task Queue',
    code: `#include <mutex>
#include <queue>
#include <condition_variable>

template <typename T>
class SafeQueue {
    std::queue<T> q;
    mutable std::mutex m;
    std::condition_variable cv;
public:
    void push(T val) {
        {
            std::lock_guard<std::mutex> lock(m);
            q.push(std::move(val));
        }
        cv.notify_one();
    }

    T pop() {
        std::unique_lock<std::mutex> lock(m);
        cv.wait(lock, [this]() { return !q.empty(); });
        T val = std::move(q.front());
        q.pop();
        return val;
    }
};`,
  },

  // ==========================================
  // C
  // ==========================================
  // Easy
  {
    id: 'c-easy-01',
    language: 'c',
    difficulty: 'easy',
    title: 'Pointer String Reverse',
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
}`,
  },
  {
    id: 'c-easy-02',
    language: 'c',
    difficulty: 'easy',
    title: 'Dynamic Array Allocation',
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
  {
    id: 'c-easy-03',
    language: 'c',
    difficulty: 'easy',
    title: 'Character Occurrence Counter',
    code: `#include <stdio.h>

int count_char(const char *str, char target) {
    int count = 0;
    while (*str != '\\0') {
        if (*str == target) {
            count++;
        }
        str++;
    }
    return count;
}`,
  },
  // Medium
  {
    id: 'c-medium-01',
    language: 'c',
    difficulty: 'medium',
    title: 'Bubble Sort with Pointer Swap',
    code: `#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

void bubble_sort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(&arr[j], &arr[j + 1]);
            }
        }
    }
}`,
  },
  {
    id: 'c-medium-02',
    language: 'c',
    difficulty: 'medium',
    title: 'Linked List Node Creation',
    code: `#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node *next;
};

struct Node* create_node(int value) {
    struct Node *new_node = (struct Node *)malloc(sizeof(struct Node));
    if (new_node == NULL) return NULL;
    new_node->data = value;
    new_node->next = NULL;
    return new_node;
}`,
  },
  {
    id: 'c-medium-03',
    language: 'c',
    difficulty: 'medium',
    title: 'Binary Search Function in C',
    code: `int binary_search(const int arr[], int size, int target) {
    int low = 0;
    int high = size - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`,
  },
  // Hard
  {
    id: 'c-hard-01',
    language: 'c',
    difficulty: 'hard',
    title: 'Doubly Linked List Deletion',
    code: `#include <stdlib.h>

struct DNode {
    int val;
    struct DNode *prev;
    struct DNode *next;
};

void delete_node(struct DNode **head_ref, struct DNode *del) {
    if (*head_ref == NULL || del == NULL) return;
    if (*head_ref == del) *head_ref = del->next;
    if (del->next != NULL) del->next->prev = del->prev;
    if (del->prev != NULL) del->prev->next = del->next;
    free(del);
}`,
  },
  {
    id: 'c-hard-02',
    language: 'c',
    difficulty: 'hard',
    title: 'Static Memory Chunk Allocator',
    code: `#include <stddef.h>

#define POOL_SIZE 4096
static char memory_pool[POOL_SIZE];
static size_t pool_offset = 0;

void* pool_alloc(size_t size) {
    size_t aligned_size = (size + 7) & ~7;
    if (pool_offset + aligned_size > POOL_SIZE) {
        return NULL;
    }
    void *ptr = &memory_pool[pool_offset];
    pool_offset += aligned_size;
    return ptr;
}

void pool_reset(void) {
    pool_offset = 0;
}`,
  },
  {
    id: 'c-hard-03',
    language: 'c',
    difficulty: 'hard',
    title: 'Hash Table with Linear Probing',
    code: `#include <string.h>

#define TABLE_SIZE 128

typedef struct {
    char key[32];
    int value;
    int occupied;
} HashEntry;

static HashEntry table[TABLE_SIZE];

unsigned int hash(const char *key) {
    unsigned int h = 0;
    while (*key) h = (h * 31) + (*key++);
    return h % TABLE_SIZE;
}

void insert_entry(const char *k, int v) {
    unsigned int idx = hash(k);
    while (table[idx].occupied) {
        idx = (idx + 1) % TABLE_SIZE;
    }
    strncpy(table[idx].key, k, 31);
    table[idx].value = v;
    table[idx].occupied = 1;
}`,
  },

  // ==========================================
  // HTML
  // ==========================================
  // Easy
  {
    id: 'html-easy-01',
    language: 'html',
    difficulty: 'easy',
    title: 'Accessible Navbar Structure',
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
    id: 'html-easy-02',
    language: 'html',
    difficulty: 'easy',
    title: 'Semantic Card Element',
    code: `<article class="code-card">
  <header class="card-header">
    <h3>JavaScript Fundamentals</h3>
    <span class="badge">Beginner</span>
  </header>
  <p class="card-body">Practice typing modern ES6 syntax and loops.</p>
  <footer>
    <button type="button">Start Module</button>
  </footer>
</article>`,
  },
  {
    id: 'html-easy-03',
    language: 'html',
    difficulty: 'easy',
    title: 'Simple Data Table',
    code: `<table class="stats-table">
  <thead>
    <tr>
      <th scope="col">Language</th>
      <th scope="col">Average WPM</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Python</td><td>68</td></tr>
    <tr><td>Java</td><td>64</td></tr>
  </tbody>
</table>`,
  },
  // Medium
  {
    id: 'html-medium-01',
    language: 'html',
    difficulty: 'medium',
    title: 'Form with Validation Attributes',
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
  {
    id: 'html-medium-02',
    language: 'html',
    difficulty: 'medium',
    title: 'Accessible Modal Dialog',
    code: `<dialog id="settings-modal" aria-labelledby="modal-title">
  <form method="dialog">
    <h2 id="modal-title">Preferences</h2>
    <label>
      <input type="checkbox" name="sound" checked />
      Enable Keypress Audio
    </label>
    <menu>
      <button value="cancel">Cancel</button>
      <button value="confirm" class="primary">Save Changes</button>
    </menu>
  </form>
</dialog>`,
  },
  {
    id: 'html-medium-03',
    language: 'html',
    difficulty: 'medium',
    title: 'Media Audio Player Element',
    code: `<figure class="audio-widget">
  <figcaption>Keyboard Click Audio Preview</figcaption>
  <audio controls preload="metadata">
    <source src="/audio/click.ogg" type="audio/ogg" />
    <source src="/audio/click.mp3" type="audio/mpeg" />
    Your browser does not support audio playback.
  </audio>
</figure>`,
  },
  // Hard
  {
    id: 'html-hard-01',
    language: 'html',
    difficulty: 'hard',
    title: 'Complex Checkout Layout',
    code: `<form class="checkout-form" novalidate>
  <section class="billing-section">
    <h2>Billing Address</h2>
    <div class="field-row">
      <div class="input-group">
        <label for="fname">First Name</label>
        <input type="text" id="fname" name="firstName" autocomplete="given-name" required />
      </div>
      <div class="input-group">
        <label for="lname">Last Name</label>
        <input type="text" id="lname" name="lastName" autocomplete="family-name" required />
      </div>
    </div>
  </section>
  <section class="payment-section">
    <h2>Payment Method</h2>
    <fieldset class="radio-group">
      <legend class="sr-only">Payment Options</legend>
      <input type="radio" id="card" name="payment" value="card" checked />
      <label for="card">Credit Card</label>
      <input type="radio" id="paypal" name="payment" value="paypal" />
      <label for="paypal">PayPal</label>
    </fieldset>
  </section>
</form>`,
  },
  {
    id: 'html-hard-02',
    language: 'html',
    difficulty: 'hard',
    title: 'Multi-Column Dashboard Layout',
    code: `<div class="dashboard-shell">
  <header class="top-nav" role="banner">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <h1>CodeSpeed Analytics</h1>
  </header>
  <div class="dashboard-body">
    <aside class="sidebar" aria-label="Sidebar Navigation">
      <nav>
        <ul>
          <li><a href="/tests" aria-current="page">Tests</a></li>
          <li><a href="/reports">Reports</a></li>
        </ul>
      </nav>
    </aside>
    <main id="main-content" class="main-stage">
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading">Performance Metric Matrix</h2>
      </section>
    </main>
  </div>
</div>`,
  },
  {
    id: 'html-hard-03',
    language: 'html',
    difficulty: 'hard',
    title: 'Inline SVG Graphic Element',
    code: `<svg viewBox="0 0 100 100" class="speedometer" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>Typing Speed Indicator Gauge</title>
  <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" stroke-width="8" />
  <circle cx="50" cy="50" r="45" fill="none" stroke="#38bdf8" stroke-width="8"
          stroke-dasharray="283" stroke-dashoffset="70" stroke-linecap="round" />
  <text x="50" y="55" text-anchor="middle" font-size="16" fill="#f8fafc">85</text>
</svg>`,
  },

  // ==========================================
  // CSS
  // ==========================================
  // Easy
  {
    id: 'css-easy-01',
    language: 'css',
    difficulty: 'easy',
    title: 'Flexbox Card Component',
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
    id: 'css-easy-02',
    language: 'css',
    difficulty: 'easy',
    title: 'Button Hover and Focus States',
    code: `.cta-button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  background-color: #38bdf8;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cta-button:hover {
  background-color: #7dd3fc;
}

.cta-button:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}`,
  },
  {
    id: 'css-easy-03',
    language: 'css',
    difficulty: 'easy',
    title: 'Typographic Color System',
    code: `:root {
  --font-primary: system-ui, -apple-system, sans-serif;
  --color-primary: #38bdf8;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --bg-surface: #0f172a;
}

body {
  font-family: var(--font-primary);
  background-color: var(--bg-surface);
  color: #f8fafc;
  line-height: 1.6;
}`,
  },
  // Medium
  {
    id: 'css-medium-01',
    language: 'css',
    difficulty: 'medium',
    title: 'CSS Grid Responsive Layout',
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
  {
    id: 'css-medium-02',
    language: 'css',
    difficulty: 'medium',
    title: 'Keyframe Loading Animation',
    code: `@keyframes spinPulse {
  0% {
    transform: rotate(0deg) scale(1);
    opacity: 0.7;
  }
  50% {
    transform: rotate(180deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: rotate(360deg) scale(1);
    opacity: 0.7;
  }
}

.loader-ring {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(56, 189, 248, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spinPulse 1.2s infinite ease-in-out;
}`,
  },
  {
    id: 'css-medium-03',
    language: 'css',
    difficulty: 'medium',
    title: 'Custom Toggle Switch',
    code: `.toggle-switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background-color: #334155;
  border-radius: 28px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

input:checked + .toggle-slider {
  background-color: #38bdf8;
}

input:checked + .toggle-slider::before {
  transform: translateX(24px);
}`,
  },
  // Hard
  {
    id: 'css-hard-01',
    language: 'css',
    difficulty: 'hard',
    title: 'Multi-layer Glassmorphism Card',
    code: `.glass-container {
  position: relative;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.125);
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.glass-container::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(56, 189, 248, 0.15), transparent 60%);
  pointer-events: none;
}`,
  },
  {
    id: 'css-hard-02',
    language: 'css',
    difficulty: 'hard',
    title: 'Collapsible Drawer Transitions',
    code: `.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 380px;
  max-width: 90vw;
  background: #0b0f19;
  border-left: 1px solid #1f2937;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
  z-index: 50;
}

.drawer-panel.open {
  transform: translateX(0);
}

.drawer-backdrop {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.drawer-backdrop.active {
  opacity: 1;
  pointer-events: auto;
}`,
  },
  {
    id: 'css-hard-03',
    language: 'css',
    difficulty: 'hard',
    title: '3D Perspective Tilt Card',
    code: `.tilt-viewport {
  perspective: 1000px;
}

.tilt-card {
  width: 320px;
  height: 200px;
  transform-style: preserve-3d;
  transition: transform 0.25s ease-out;
  border-radius: 14px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
}

.tilt-card:hover {
  transform: rotateX(8deg) rotateY(-12deg) translateZ(10px);
}

.tilt-layer {
  transform: translateZ(30px);
  color: #f8fafc;
}`,
  },

  // ==========================================
  // SQL
  // ==========================================
  // Easy
  {
    id: 'sql-easy-01',
    language: 'sql',
    difficulty: 'easy',
    title: 'Simple SELECT with ORDER BY',
    code: `SELECT user_id, username, email, created_at
FROM users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 20;`,
  },
  {
    id: 'sql-easy-02',
    language: 'sql',
    difficulty: 'easy',
    title: 'Aggregation with COUNT and AVG',
    code: `SELECT language, COUNT(*) AS total_tests, AVG(wpm) AS average_wpm
FROM test_results
GROUP BY language
ORDER BY average_wpm DESC;`,
  },
  {
    id: 'sql-easy-03',
    language: 'sql',
    difficulty: 'easy',
    title: 'Filtering Active Users with LIKE',
    code: `SELECT id, username, email
FROM developers
WHERE email LIKE '%@gmail.com'
  AND registration_date BETWEEN '2026-01-01' AND '2026-12-31';`,
  },
  // Medium
  {
    id: 'sql-medium-01',
    language: 'sql',
    difficulty: 'medium',
    title: 'Aggregating High Scores with JOIN',
    code: `SELECT u.id, u.username, MAX(t.wpm) AS top_wpm, AVG(t.accuracy) AS avg_accuracy
FROM typing_tests t
JOIN users u ON u.id = t.user_id
WHERE t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username
HAVING COUNT(t.id) >= 5
ORDER BY top_wpm DESC
LIMIT 10;`,
  },
  {
    id: 'sql-medium-02',
    language: 'sql',
    difficulty: 'medium',
    title: 'Creating Indexed Table Structure',
    code: `CREATE TABLE IF NOT EXISTS developers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  primary_language VARCHAR(30) DEFAULT 'javascript',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_developers_email ON developers(email);`,
  },
  {
    id: 'sql-medium-03',
    language: 'sql',
    difficulty: 'medium',
    title: 'Multi-Table INNER and LEFT JOIN',
    code: `SELECT o.order_id, c.customer_name, p.product_name, o.quantity * p.unit_price AS total_amount
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id
LEFT JOIN products p ON o.product_id = p.id
WHERE o.status = 'COMPLETED'
ORDER BY total_amount DESC;`,
  },
  // Hard
  {
    id: 'sql-hard-01',
    language: 'sql',
    difficulty: 'hard',
    title: 'Recursive Common Table Expression',
    code: `WITH RECURSIVE employee_hierarchy AS (
  SELECT id, name, manager_id, 1 AS depth
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  SELECT e.id, e.name, e.manager_id, eh.depth + 1
  FROM employees e
  INNER JOIN employee_hierarchy eh ON e.manager_id = eh.id
)
SELECT id, name, depth
FROM employee_hierarchy
ORDER BY depth, id;`,
  },
  {
    id: 'sql-hard-02',
    language: 'sql',
    difficulty: 'hard',
    title: 'Window Functions Ranking and Partitioning',
    code: `SELECT user_id,
       language,
       wpm,
       ROW_NUMBER() OVER (PARTITION BY language ORDER BY wpm DESC) AS rank_in_lang,
       DENSE_RANK() OVER (ORDER BY wpm DESC) AS global_rank,
       AVG(wpm) OVER (PARTITION BY language) AS lang_avg_wpm
FROM typing_records
WHERE accuracy >= 95.0;`,
  },
  {
    id: 'sql-hard-03',
    language: 'sql',
    difficulty: 'hard',
    title: 'Conditional Ledger Aggregation',
    code: `SELECT account_id,
       SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END) AS total_credits,
       SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END) AS total_debits,
       SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE -amount END) AS net_balance
FROM bank_transactions
WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY account_id
HAVING SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE -amount END) < 0;`,
  },
];

/**
 * Get a snippet matching language and difficulty.
 * Avoids picking the exact same snippet as previousSnippetId when multiple options exist.
 *
 * @param {string} language - e.g. 'javascript', 'python', 'java'
 * @param {string} difficulty - e.g. 'easy', 'medium', 'hard'
 * @param {string} [previousSnippetId] - ID to avoid repeating immediately
 * @returns {object} Snippet object
 */
export function getRandomSnippet(language, difficulty = 'medium', previousSnippetId) {
  const normLang = (language || '').toLowerCase().trim();
  const normDiff = (difficulty || 'medium').toLowerCase().trim();

  // First filter by both language and difficulty
  let matching = SNIPPETS.filter(
    (s) => s.language.toLowerCase() === normLang && s.difficulty.toLowerCase() === normDiff
  );

  // Fallback 1: Match by language only if no exact difficulty match found
  if (matching.length === 0) {
    matching = SNIPPETS.filter((s) => s.language.toLowerCase() === normLang);
  }

  // Fallback 2: Universal fallback to all snippets if language is completely unrecognized
  if (matching.length === 0) {
    matching = SNIPPETS;
  }

  // Avoid immediate repetition if multiple candidates exist
  let pool = matching;
  if (matching.length > 1 && previousSnippetId) {
    const withoutPrevious = matching.filter((s) => s.id !== previousSnippetId);
    if (withoutPrevious.length > 0) {
      pool = withoutPrevious;
    }
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

export default SNIPPETS;
