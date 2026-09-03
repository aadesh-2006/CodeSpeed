import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export function UserSearch({ onSelectUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle debounced search query
  useEffect(() => {
    const trimmed = query.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.searchUsers(trimmed);
        if (res && res.data) {
          setResults(res.data);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('[UserSearch] Search error:', err);
        setError('Unable to search developers.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (username) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    if (onSelectUser) {
      onSelectUser(username);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="user-search-container" ref={containerRef}>
      <div className="user-search-input-wrapper">
        <svg
          className="user-search-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          className="user-search-input"
          placeholder="Search developers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search developers by username"
          autoComplete="off"
          spellCheck="false"
        />

        {query && (
          <button
            type="button"
            className="user-search-clear-btn"
            onClick={handleClear}
            title="Clear search"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="user-search-dropdown" role="listbox">
          {loading && (
            <div className="user-search-state">
              <div className="loading-spinner-sm"></div>
              <span>Searching developers...</span>
            </div>
          )}

          {!loading && error && (
            <div className="user-search-state error">
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="user-search-state empty">
              <span>No developers found.</span>
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="user-search-results-list">
              {results.map((user) => (
                <button
                  key={user.username}
                  type="button"
                  className="user-search-item"
                  onClick={() => handleSelect(user.username)}
                  role="option"
                  aria-selected="false"
                >
                  <div className="user-search-avatar">
                    {user.profilePhoto ? (
                      <img src={user.profilePhoto} alt="" className="user-search-avatar-img" />
                    ) : (
                      (user.username || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="user-search-info">
                    <span className="user-search-username">@{user.username}</span>
                    {user.bio ? (
                      <span className="user-search-bio" title={user.bio}>
                        {user.bio}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserSearch;
