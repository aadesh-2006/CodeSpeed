import { useState, useEffect, useRef } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
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

  // Top-level authenticated view: 'dashboard' | 'test' | 'history'
  const [currentView, setCurrentView] = useState('dashboard');

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
        if (data.status === 'ok') {
          setApiStatus({ status: 'connected', message: 'Connected to API' });
        } else {
          setApiStatus({ status: 'disconnected', message: 'API responded with non-ok status' });
        }
      })
      .catch((err) => {
        setApiStatus({ status: 'disconnected', message: err.message || 'Cannot reach API' });
      });
  }, [apiUrl]);

  // Check for stored token and restore session
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api
      .getMe()
      .then((res) => {
        if (res && res.data && res.data.user) {
          setUser(res.data.user);
        } else {
          clearToken();
        }
      })
      .catch((err) => {
        console.error('[Session Check] Failed to restore session:', err.message);
        clearToken();
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
    setSaveStatus(null);
    setCurrentView('dashboard');
  };

  // Start a new test with selected language, difficulty, and duration
  const handleStartTest = () => {
    const snippet = getRandomSnippet(selectedLanguage, selectedDifficulty, currentSnippet?.id);
    setCurrentSnippet(snippet);
    setTestResults(null);
    setSaveStatus(null);
    attemptSavedRef.current = false;
    setTestState('RUNNING');
  };

  // Test finished: calculate metrics, update state, and trigger persistence
  const handleFinishTest = (metrics) => {
    setTestResults(metrics);
    setTestState('FINISHED');

    // Trigger non-blocking asynchronous persistence for authenticated user
    if (user && !attemptSavedRef.current && currentSnippet) {
      attemptSavedRef.current = true;
      setSaveStatus('saving');

      const performancePayload = {
        language: selectedLanguage,
        difficulty: selectedDifficulty,
        timerSeconds: selectedDuration,
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        correctChars: metrics.correctChars,
        incorrectChars: metrics.incorrectChars,
        elapsedSeconds: metrics.elapsedSeconds,
        snippetId: currentSnippet.id,
      };

      api
        .savePerformance(performancePayload)
        .then((res) => {
          if (res && res.status === 'success') {
            setSaveStatus('saved');
          } else {
            console.warn('[Performance Save] Non-success response:', res);
            setSaveStatus('error');
          }
        })
        .catch((err) => {
          console.error('[Performance Save] Error:', err.message);
          setSaveStatus('error');
        });
    }
  };

  // Restart current test with a new snippet of same language/difficulty
  const handleTryAgain = () => {
    const nextSnippet = getRandomSnippet(selectedLanguage, selectedDifficulty, currentSnippet?.id);
    setCurrentSnippet(nextSnippet);
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
        <div className="badge">CodeSpeed &bull; Polished Final Release</div>
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
                    className={`view-toggle-btn ${currentView === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setCurrentView('dashboard')}
                  >
                    Dashboard
                  </button>
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

            {/* View: User Dashboard */}
            {currentView === 'dashboard' && (
              <Dashboard
                user={user}
                onNavigateToPractice={() => setCurrentView('test')}
                onNavigateToHistory={() => setCurrentView('history')}
              />
            )}

            {/* View: Performance History & Graph */}
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
                    onViewDashboard={() => setCurrentView('dashboard')}
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
            Milestone 8 Final Release active. Practice coding typing speed, monitor personal bests and language stats on the dashboard, and analyze progression over time.
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
