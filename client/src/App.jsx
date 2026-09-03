import { useState, useEffect, useRef } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthForm from './components/AuthForm';
import TestSetup from './components/TestSetup';
import TypingTest from './components/TypingTest';
import TestResult from './components/TestResult';
import PerformanceHistory from './components/PerformanceHistory';
import { SUPPORTED_LANGUAGES, getRandomSnippet } from './data/snippets';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Connecting to API...' });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Top-level authenticated view: 'test' | 'history'
  const [currentView, setCurrentView] = useState('test');

  // Typing engine states: 'IDLE' | 'RUNNING' | 'FINISHED'
  const [testState, setTestState] = useState('IDLE');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [currentSnippet, setCurrentSnippet] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  const attemptSavedRef = useRef(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Check health check status from backend
  useEffect(() => {
    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setApiStatus({ status: 'connected', message: data.message });
      })
      .catch(() => {
        setApiStatus({ status: 'disconnected', message: 'Server not reachable' });
      });
  }, [apiUrl]);

  // Restore authenticated session on initial mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api
      .getMe()
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setCurrentView('test');
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setCurrentView('test');
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
    setSaveStatus(null);
    attemptSavedRef.current = false;
  };

  // Start test with selected language, difficulty, and duration
  const handleStartTest = () => {
    const snippet = getRandomSnippet(selectedLanguage, selectedDifficulty);
    setCurrentSnippet(snippet);
    setTestResults(null);
    setSaveStatus(null);
    attemptSavedRef.current = false;
    setTestState('RUNNING');
  };

  // Complete test and show results
  const handleFinishTest = (results) => {
    setTestResults(results);
    setTestState('FINISHED');

    // Prevent duplicate saves of the same completed attempt
    if (!attemptSavedRef.current && user && results) {
      attemptSavedRef.current = true;
      setSaveStatus('saving');

      api
        .savePerformance({
          language: results.language,
          difficulty: results.difficulty,
          timerSeconds: results.timerSeconds,
          wpm: results.wpm,
          accuracy: results.accuracy,
          correctChars: results.correctChars,
          incorrectChars: results.incorrectChars,
          elapsedSeconds: results.elapsedSeconds,
          snippetId: results.snippetId,
        })
        .then(() => {
          setSaveStatus('saved');
        })
        .catch((err) => {
          console.warn('[CodeSpeed] Failed to save performance:', err.message);
          setSaveStatus('error');
        });
    }
  };

  // Try again with fresh snippet for same language and difficulty
  const handleTryAgain = () => {
    const freshSnippet = getRandomSnippet(selectedLanguage, selectedDifficulty, currentSnippet?.id);
    setCurrentSnippet(freshSnippet);
    setTestResults(null);
    setSaveStatus(null);
    attemptSavedRef.current = false;
    setTestState('RUNNING');
  };

  // Return to configuration setup
  const handleChangeSettings = () => {
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
    setSaveStatus(null);
    attemptSavedRef.current = false;
  };

  const activeLanguageObj = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage);
  const activeLanguageName = activeLanguageObj ? activeLanguageObj.name : selectedLanguage;

  return (
    <div className="app-container">
      <header className="header">
        <div className="badge">Milestone 7 &bull; WPM Progression Graph</div>
      </header>

      <main className="hero">
        <div className="logo-symbol">&gt;_</div>
        <h1 className="title">CodeSpeed</h1>
        <p className="tagline">Type code. Track speed. Improve.</p>

        {authLoading ? (
          <div className="loading-card">
            <p>Loading user session...</p>
          </div>
        ) : user ? (
          /* Authenticated Area */
          <div className="authenticated-wrapper">
            <div className="user-bar">
              <div className="user-greeting">
                <span>Logged in as </span>
                <strong className="username-tag">{user.username}</strong>
                <span className="user-email-tag">({user.email})</span>
              </div>

              <div className="user-bar-actions">
                <div className="view-toggle-group">
                  <button
                    type="button"
                    className={`view-toggle-btn ${currentView === 'test' ? 'active' : ''}`}
                    onClick={() => setCurrentView('test')}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn ${currentView === 'history' ? 'active' : ''}`}
                    onClick={() => setCurrentView('history')}
                  >
                    History
                  </button>
                </div>

                <button type="button" className="logout-compact-btn" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </div>

            {/* View: Performance History */}
            {currentView === 'history' && (
              <PerformanceHistory onNavigateToPractice={() => setCurrentView('test')} />
            )}

            {/* View: Typing Practice & Test */}
            {currentView === 'test' && (
              <>
                {testState === 'IDLE' && (
                  <TestSetup
                    selectedLanguage={selectedLanguage}
                    setSelectedLanguage={setSelectedLanguage}
                    selectedDifficulty={selectedDifficulty}
                    setSelectedDifficulty={setSelectedDifficulty}
                    selectedDuration={selectedDuration}
                    setSelectedDuration={setSelectedDuration}
                    onStartTest={handleStartTest}
                  />
                )}

                {testState === 'RUNNING' && currentSnippet && (
                  <TypingTest
                    snippet={currentSnippet}
                    durationSeconds={selectedDuration}
                    languageName={activeLanguageName}
                    onFinish={handleFinishTest}
                    onCancel={handleChangeSettings}
                    onRestart={handleTryAgain}
                  />
                )}

                {testState === 'FINISHED' && testResults && (
                  <TestResult
                    results={testResults}
                    saveStatus={saveStatus}
                    onTryAgain={handleTryAgain}
                    onChangeSettings={handleChangeSettings}
                    onViewHistory={() => setCurrentView('history')}
                  />
                )}
              </>
            )}
          </div>
        ) : (
          /* Unauthenticated Auth UI */
          <AuthForm onAuthSuccess={handleAuthSuccess} />
        )}

        <div className="info-card">
          <div className="status-indicator">
            <span className={`status-dot ${apiStatus.status}`}></span>
            <span className="status-text">
              Backend Status: <strong>{apiStatus.message}</strong>
            </span>
          </div>
          <p className="milestone-note">
            Milestone 7 WPM Progression Graph active. Visualize typing speed trends across attempts with dynamic scaling and chronological progression.
          </p>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} CodeSpeed &bull; Built with React &amp; Express</p>
      </footer>
    </div>
  );
}

export default App;
