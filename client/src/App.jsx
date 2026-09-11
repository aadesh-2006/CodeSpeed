import { useState, useEffect, useRef } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import TestSetup from './components/TestSetup';
import TypingTest from './components/TypingTest';
import TestResult from './components/TestResult';
import PerformanceHistory from './components/PerformanceHistory';
import PublicProfile from './components/PublicProfile';
import DailyActivity from './components/DailyActivity';
import Settings from './components/Settings';
import UserSearch from './components/UserSearch';
import RoomsHub from './components/rooms/RoomsHub';
import RoomView from './components/rooms/RoomView';
import socketService from './services/socket';
import { SUPPORTED_LANGUAGES, getRandomSnippet } from './data/snippets';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Connecting to API...' });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Top-level view: 'dashboard' | 'test' | 'history' | 'settings' | 'rooms'
  const [currentView, setCurrentView] = useState('dashboard');
  const [historyInitialMode, setHistoryInitialMode] = useState('practice');

  // Shareable Public Profile, Daily Activity & Competition Room routing state
  const [publicProfileUsername, setPublicProfileUsername] = useState(null);
  const [dailyActivityRoute, setDailyActivityRoute] = useState(null);
  const [activeRoomCode, setActiveRoomCode] = useState(null);

  // Typing engine & mode states
  const [selectedMode, setSelectedMode] = useState('practice'); // 'practice' | 'ranked'
  const [testState, setTestState] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'FINISHED'
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [currentSnippet, setCurrentSnippet] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  const attemptSavedRef = useRef(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Listen to URL hash routing for #/user/:username, #/user/:username/activity/:date, #/rooms, and #/room/:code
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '';

      // Match #/room/:code
      const roomMatch = hash.match(/^#\/room\/([^/?#]+)/);
      if (roomMatch && roomMatch[1]) {
        setPublicProfileUsername(null);
        setDailyActivityRoute(null);
        setActiveRoomCode(decodeURIComponent(roomMatch[1]).toUpperCase());
        return;
      }

      // Match #/rooms
      if (hash === '#/rooms' || hash === '#rooms') {
        setPublicProfileUsername(null);
        setDailyActivityRoute(null);
        setActiveRoomCode(null);
        setCurrentView('rooms');
        return;
      }

      // Match #/user/:username/activity/:date or /user/:username/activity/:date
      const activityMatch = hash.match(/^#\/user\/([^/?#]+)\/activity\/([^/?#]+)/);
      if (activityMatch && activityMatch[1] && activityMatch[2]) {
        setPublicProfileUsername(null);
        setActiveRoomCode(null);
        setDailyActivityRoute({
          username: decodeURIComponent(activityMatch[1]),
          date: decodeURIComponent(activityMatch[2]),
        });
        return;
      }

      const userMatch = hash.match(/^#\/user\/([^/?#]+)/);
      if (userMatch && userMatch[1]) {
        setDailyActivityRoute(null);
        setActiveRoomCode(null);
        setPublicProfileUsername(decodeURIComponent(userMatch[1]));
      } else {
        setDailyActivityRoute(null);
        setPublicProfileUsername(null);
        setActiveRoomCode(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          setApiStatus({ status: 'connected', message: 'API connected' });
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
        if (res && res.user) {
          setUser(res.user);
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
    socketService.disconnectSocket();
    clearToken();
    setUser(null);
    setActiveRoomCode(null);
    setTestState('IDLE');
    setCurrentSnippet(null);
    setTestResults(null);
    setSaveStatus(null);
    setCurrentView('dashboard');
  };

  // Start a new test with selected mode, language, difficulty, and duration
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
        mode: selectedMode,
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
        .then(() => {
          setSaveStatus('saved');
        })
        .catch((err) => {
          console.error('[Persistence] Failed to save test attempt:', err.message);
          setSaveStatus('error');
        });
    }
  };

  const handleTryAgain = () => {
    handleStartTest();
  };

  const handleChangeSettings = () => {
    setTestState('IDLE');
  };

  const handleClosePublicProfile = () => {
    setPublicProfileUsername(null);
    window.location.hash = '';
    setCurrentView('dashboard');
  };

  const handleOpenSettingsFromProfile = () => {
    setPublicProfileUsername(null);
    window.location.hash = '';
    setCurrentView('settings');
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="navbar">
        <div className="navbar-container">
          <div
            className="navbar-brand"
            onClick={() => {
              setCurrentView('dashboard');
              setPublicProfileUsername(null);
              window.location.hash = '';
            }}
          >
            <img src="/codespeed-logo.png" alt="CodeSpeed Logo" className="brand-logo" />
            <span className="brand-name">CodeSpeed</span>
          </div>

          {user && !publicProfileUsername && (
            <nav className="navbar-nav">
              <button
                type="button"
                className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={`nav-link ${currentView === 'test' && selectedMode === 'practice' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMode('practice');
                  setTestState('IDLE');
                  setCurrentView('test');
                }}
              >
                Practice
              </button>
              <button
                type="button"
                className={`nav-link ${currentView === 'test' && selectedMode === 'ranked' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMode('ranked');
                  setTestState('IDLE');
                  setCurrentView('test');
                }}
              >
                Ranked
              </button>
              <button
                type="button"
                className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentView('history')}
              >
                History
              </button>
              <button
                type="button"
                className={`nav-link ${currentView === 'rooms' && !activeRoomCode ? 'active' : ''}`}
                onClick={() => {
                  setActiveRoomCode(null);
                  setCurrentView('rooms');
                  window.location.hash = '/rooms';
                }}
              >
                Rooms
              </button>
              <button
                type="button"
                className={`nav-link ${currentView === 'settings' ? 'active' : ''}`}
                onClick={() => setCurrentView('settings')}
              >
                Settings
              </button>
            </nav>
          )}

          <div className="navbar-right">
            {user ? (
              <>
                <UserSearch
                  onSelectUser={(un) => {
                    window.location.hash = `/user/${encodeURIComponent(un)}`;
                  }}
                />
                <div className="user-profile-menu">
                  <button
                    type="button"
                    className="user-nav-btn"
                    onClick={() => {
                      window.location.hash = `/user/${encodeURIComponent(user.username)}`;
                    }}
                    title="View your public profile"
                  >
                    <span className="user-nav-avatar">
                      {user.profilePhoto ? (
                        <img src={user.profilePhoto} alt="" className="user-nav-photo" />
                      ) : (
                        (user.username || 'U')[0].toUpperCase()
                      )}
                    </span>
                    <span className="user-nav-name">{user.username}</span>
                  </button>
                  <button
                    type="button"
                    className="logout-text-btn"
                    onClick={handleLogout}
                    title="Log out"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Active Room View (#/room/:code) */}
        {activeRoomCode ? (
          <RoomView
            roomCode={activeRoomCode}
            onNavigateBack={() => {
              setActiveRoomCode(null);
              setCurrentView('rooms');
              window.location.hash = '/rooms';
            }}
          />
        ) : dailyActivityRoute ? (
          <DailyActivity
            username={dailyActivityRoute.username}
            date={dailyActivityRoute.date}
            onNavigateBack={() => {
              window.location.hash = `/user/${encodeURIComponent(dailyActivityRoute.username)}`;
            }}
            onNavigateHome={handleClosePublicProfile}
          />
        ) : publicProfileUsername ? (
          <PublicProfile
            username={publicProfileUsername}
            onNavigateHome={handleClosePublicProfile}
            onNavigateSettings={handleOpenSettingsFromProfile}
          />
        ) : authLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading session...</p>
          </div>
        ) : user ? (
          <div className="content-view">
            {/* View: User Dashboard */}
            {currentView === 'dashboard' && (
              <Dashboard
                user={user}
                onNavigateToPractice={() => {
                  setSelectedMode('practice');
                  setTestState('IDLE');
                  setCurrentView('test');
                }}
                onNavigateToRanked={() => {
                  setSelectedMode('ranked');
                  setTestState('IDLE');
                  setCurrentView('test');
                }}
                onNavigateToHistory={(mode) => {
                  setHistoryInitialMode(mode);
                  setCurrentView('history');
                }}
                onViewPublicProfile={(un) => {
                  window.location.hash = `/user/${un}`;
                }}
                onUserUpdate={(updatedUser) => setUser(updatedUser)}
              />
            )}

            {/* View: Performance History & Graph */}
            {currentView === 'history' && (
              <PerformanceHistory
                initialMode={historyInitialMode}
                onNavigateToPractice={() => {
                  setSelectedMode('practice');
                  setTestState('IDLE');
                  setCurrentView('test');
                }}
              />
            )}

            {/* View: Multiplayer Competition Rooms Hub */}
            {currentView === 'rooms' && (
              <RoomsHub
                onNavigateToRoom={(code) => {
                  setActiveRoomCode(code);
                  window.location.hash = `/room/${code}`;
                }}
              />
            )}

            {/* View: Account & Profile Settings */}
            {currentView === 'settings' && (
              <Settings
                user={user}
                onUserUpdated={(updatedUser) => setUser(updatedUser)}
                onNavigateBack={() => setCurrentView('dashboard')}
              />
            )}

            {/* View: Typing Test Engine */}
            {currentView === 'test' && (
              <div className="test-view-container">
                {testState === 'IDLE' && (
                  <TestSetup
                    mode={selectedMode}
                    language={selectedLanguage}
                    difficulty={selectedDifficulty}
                    duration={selectedDuration}
                    onModeChange={setSelectedMode}
                    onLanguageChange={setSelectedLanguage}
                    onDifficultyChange={setSelectedDifficulty}
                    onDurationChange={setSelectedDuration}
                    onStart={handleStartTest}
                  />
                )}

                {testState === 'RUNNING' && currentSnippet && (
                  <TypingTest
                    snippet={currentSnippet}
                    duration={selectedDuration}
                    language={selectedLanguage}
                    onFinish={handleFinishTest}
                    onCancel={handleChangeSettings}
                    onRestart={handleTryAgain}
                  />
                )}

                {testState === 'FINISHED' && testResults && (
                  <TestResult
                    mode={selectedMode}
                    results={testResults}
                    saveStatus={saveStatus}
                    onTryAgain={handleTryAgain}
                    onChangeSettings={handleChangeSettings}
                    onViewDashboard={() => setCurrentView('dashboard')}
                    onViewHistory={() => setCurrentView('history')}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          /* Unauthenticated Landing / Auth UI */
          <div className="unauth-landing">
            <div className="hero-branding">
              <div className="brand-logo-icon">&gt;_</div>
              <h1 className="hero-title">CodeSpeed</h1>
              <p className="hero-tagline">Type code. Track speed. Improve.</p>
            </div>
            <AuthForm onAuthSuccess={handleAuthSuccess} />
          </div>
        )}
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="footer">
        <div className="footer-container">
          <span className="footer-copy">CodeSpeed &bull; Developer Typing Platform</span>
          <span className="footer-sub">&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
