/**
 * Centralized API helper for CodeSpeed frontend.
 * Manages JWT tokens in localStorage and attaches them to requests.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'codespeed_token';

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Generic request wrapper.
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If unauthorized, clear invalid/expired token from local storage
      if (response.status === 401) {
        clearToken();
      }
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkError = new Error('Cannot connect to the server. Please ensure the backend is running.');
      networkError.status = 0;
      throw networkError;
    }
    throw err;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  // Auth specific shortcuts
  signup: (userData) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/api/auth/me', { method: 'GET' }),

  // Performance persistence
  savePerformance: (performanceData) =>
    request('/api/performances', {
      method: 'POST',
      body: JSON.stringify(performanceData),
    }),
};

export default api;
