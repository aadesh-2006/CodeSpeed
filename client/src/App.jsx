import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Connecting to API...' })
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  useEffect(() => {
    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        setApiStatus({ status: 'connected', message: data.message })
      })
      .catch((err) => {
        setApiStatus({ status: 'disconnected', message: 'Server not reachable' })
      })
  }, [apiUrl])

  return (
    <div className="app-container">
      <header className="header">
        <div className="badge">Milestone 0 &bull; Foundation</div>
      </header>

      <main className="hero">
        <div className="logo-symbol">&gt;_</div>
        <h1 className="title">CodeSpeed</h1>
        <p className="tagline">Type code. Track speed. Improve.</p>

        <div className="info-card">
          <div className="status-indicator">
            <span className={`status-dot ${apiStatus.status}`}></span>
            <span className="status-text">Backend Status: <strong>{apiStatus.message}</strong></span>
          </div>
          <p className="milestone-note">
            Core full-stack architecture initialized. Coding typing tests and analytics coming in future milestones.
          </p>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} CodeSpeed &bull; Built with React &amp; Express</p>
      </footer>
    </div>
  )
}

export default App

