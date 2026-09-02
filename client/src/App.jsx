import { useState, useEffect } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthForm from './components/AuthForm';
import TestSetup from './components/TestSetup';
import TypingTest from './components/TypingTest';
import TestResult from './components/TestResult';
import { SUPPORTED_LANGUAGES, getRandomSnippet } from './data/snippets';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Connecting to API...' });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Typing engine states: 'IDLE' | 'RUNNING' | 'FINISHED'
  const [testState, setTestState] = useState('IDLE');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [currentSnippet, setCurrentSnippet] = useState(null);
  const [testResults, setTestResults] = useState(null);

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
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
  };

  // Start test with selected language, difficulty, and duration
  const handleStartTest = () => {
    const snippet = getRandomSnippet(selectedLanguage, selectedDifficulty);
    setCurrentSnippet(snippet);
    setTestResults(null);
    setTestState('RUNNING');
  };

  // Complete test and show results
  const handleFinishTest = (results) => {
    setTestResults(results);
    setTestState('FINISHED');
  };

  // Try again with fresh snippet for same language and difficulty
  const handleTryAgain = () => {
    const freshSnippet = getRandomSnippet(selectedLanguage, selectedDifficulty, currentSnippet?.id);
    setCurrentSnippet(freshSnippet);
    setTestResults(null);
    setTestState('RUNNING');
  };

  // Return to configuration setup
  const handleChangeSettings = () => {
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
  };

  const activeLanguageObj = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage);
  const activeLanguageName = activeLanguageObj ? activeLanguageObj.name : selectedLanguage;

  return (
    <div className="app-container">
      <header className="header">
        <div className="badge">Milestone 3 &bull; Snippet System V2</div>
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
          /* Authenticated Area: Typing Engine */
          <div className="authenticated-wrapper">
            <div className="user-bar">
              <div className="user-greeting">
                <span>Logged in as </span>
                <strong className="username-tag">{user.username}</strong>
                <span className="user-email-tag">({user.email})</span>
              </div>
              <button type="button" className="logout-compact-btn" onClick={handleLogout}>
                Log Out
              </button>
            </div>

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
                onTryAgain={handleTryAgain}
                onChangeSettings={handleChangeSettings}
              />
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
            Milestone 3 Snippet System V2 active (72 snippets across 8 languages &amp; 3 difficulties). Performance persistence coming in Milestone 4.
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
