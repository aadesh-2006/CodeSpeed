# CodeSpeed

> **Type code. Track speed. Improve.**

CodeSpeed is a developer-centric typing speed tracker designed specifically for programmers. Unlike traditional typing platforms that benchmark user speed on English prose, sentences, or random dictionary words, CodeSpeed measures typing proficiency directly against real-world programming code snippets, syntax constructs, symbols, and formatting.

---

## Tech Stack

### Frontend (`client/`)
- **React 19**
- **Vite**
- **JavaScript (ES Modules)**
- Modern vanilla CSS design system
- Client API service with JWT authentication state management (`localStorage`)
- Interactive coding typing engine with character-level accuracy and custom `Tab` indentation
- Procedural mechanical keyboard audio system with Web Audio API playback and local volume persistence

### Backend (`server/`)
- **Node.js**
- **Express**
- **MongoDB & Mongoose**
- **JSON Web Tokens (jsonwebtoken)**
- **Password Hashing (bcryptjs)**
- **CORS**
- **dotenv**

### Testing
- **Node.js Native Test Runner (`node:test`, `node:assert`)**
- **Backend Tests (`server/tests/`)**: Isolated integration tests using `mongodb-memory-server`
- **Frontend Tests (`client/tests/`)**: Unit tests for typing engine formulas, snippet selection, streak logic, and Web Audio synthesis/playback

---

## Project Structure

```text
CodeSpeed/
├── client/                         # React + Vite frontend application
│   ├── public/                     # Static assets & favicons
│   │   └── sounds/
│   │       └── keyboard/           # Procedural mechanical switch WAV assets (~19.9 KB total)
│   ├── src/
│   │   ├── assets/                 # Logos & icons
│   │   ├── components/
│   │   │   ├── AuthForm.jsx        # Login & Signup interactive form
│   │   │   ├── BadgesGrid.jsx      # Ranked milestone badges & achievements
│   │   │   ├── Dashboard.jsx       # Authenticated home dashboard & metrics
│   │   │   ├── PerformanceHistory.jsx # Filterable, paginated attempt history
│   │   │   ├── PrivacySettingsModal.jsx # Practice privacy settings modal
│   │   │   ├── PublicProfile.jsx   # Shareable public developer profile
│   │   │   ├── Settings.jsx        # Account & profile customization
│   │   │   ├── StreakCard.jsx      # Daily practice streak widget & 7-day strip
│   │   │   ├── TestResult.jsx      # Test completion summary card
│   │   │   ├── TestSetup.jsx       # Language & timer selection UI
│   │   │   ├── TypingTest.jsx      # Active typing test, sound controls & code editor
│   │   │   ├── UserSearch.jsx      # Developer discovery & profile search
│   │   │   └── WpmProgressionGraph.jsx # SVG WPM progression graph
│   │   ├── data/
│   │   │   └── snippets.js         # Multiline code snippets (8 languages)
│   │   ├── services/
│   │   │   └── api.js              # Centralized API service with JWT management
│   │   ├── utils/
│   │   │   ├── keyboardSound.js    # Procedural audio engine, buffer cache & volume control
│   │   │   └── typingMetrics.js    # Pure WPM, accuracy, & diffing utilities
│   │   ├── App.css                 # Dark-themed styling & responsive design system
│   │   ├── App.jsx                 # App entrypoint & test state machine
│   │   ├── index.css               # Global reset & baseline styles
│   │   └── main.jsx                # React root entrypoint
│   ├── tests/
│   │   ├── components.test.js      # Component prop & rendering tests
│   │   ├── keyboardSound.test.js   # Audio engine, volume, & buffer lifecycle tests
│   │   ├── search.test.js          # Search & discovery pure logic tests
│   │   ├── settings.test.js        # Profile validation & security tests
│   │   ├── snippets.test.js        # Snippet dataset & distribution tests
│   │   ├── streak.test.js          # Streak calculation pure logic tests
│   │   └── typingMetrics.test.js   # Unit tests for typing engine formulas
│   ├── index.html                  # HTML entrypoint
│   ├── package.json                # Frontend dependencies & test scripts
│   └── vite.config.js              # Vite build configuration
├── server/                         # Node.js + Express backend API
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # Mongoose MongoDB connection config
│   │   ├── controllers/
│   │   │   └── authController.js   # Signup, login, and profile controllers
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification middleware
│   │   ├── models/
│   │   │   └── User.js             # Mongoose User schema & password security
│   │   ├── routes/
│   │   │   └── authRoutes.js       # Auth API route definitions
│   │   └── index.js                # Express app entrypoint & middleware
│   ├── tests/
│   │   └── auth.test.js            # Integration tests for auth & health APIs
│   └── package.json                # Backend dependencies & test scripts
├── .env.example                    # Template for environment variables (safe to commit)
├── .gitignore                      # Git ignore rules for node_modules, .env, builds, etc.
└── README.md                       # Project documentation
```

---

## Security Notice

> [!CAUTION]
> **Zero Secrets Policy**: Never commit `.env`, secret keys, API tokens, database connection strings, or credentials to version control.
>
> - All sensitive configurations belong in local `.env` files.
> - `.env` and related variations are explicitly ignored by `.gitignore`.
> - Always maintain `.env.example` with empty or dummy placeholder values for team reference.
> - Never store plaintext passwords in the database (always use bcrypt hashes).
> - Never expose `passwordHash` in API responses or JWT payloads.
> - Always inspect `git status` and staged files before creating any commit.

---

## Local Setup & Getting Started

### Prerequisites
- **Node.js**: v18+ recommended (tested on v24)
- **npm**: v9+ (tested on v11)
- **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017/codespeed`) or MongoDB Atlas URI for development.

### 1. Clone the Repository
```bash
git clone https://github.com/aadesh-2006/CodeSpeed.git
cd CodeSpeed
```

### 2. Configure Environment Variables
Copy `.env.example` to create your local `.env` in `server/`:
```bash
# On Windows
copy .env.example server\.env

# On Linux/macOS
cp .env.example server/.env
```

Edit `server/.env` with your local values:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/codespeed
JWT_SECRET=your_super_secret_jwt_key_here
```

---

## Running the Application

### Start Backend API Server
In a terminal window:
```bash
cd server
npm install
npm run dev     # or 'npm start'
```
The server will start at:
- **Base URL**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

### Start Frontend Client
In a separate terminal window:
```bash
cd client
npm install
npm run dev
```
The Vite development server will start at:
- **Client URL**: `http://localhost:5173`

---

## Running Tests

### Client Unit Tests (Typing Metrics, Audio Engine & System Logic)
```bash
cd client
npm test
```
Verifies WPM formula, accuracy percentages, character comparison, spaces/newlines/symbols, timer formatting, 72-snippet dataset integrity, difficulty filtering, search/profile logic, daily streak calculation, and procedural Web Audio buffer caching/playback.

### Backend Integration Tests (Authentication & Health)
```bash
cd server
npm test
```
Verifies user registration, login, bcrypt verification, JWT middleware, `/api/auth/me`, and `/api/health`.

---

## Typing Engine & Snippet System Specifications

### Supported Languages
1. **JavaScript**
2. **Python**
3. **Java**
4. **C++**
5. **C**
6. **HTML**
7. **CSS**
8. **SQL**

### Difficulty Levels
- **Easy**: Basic functions, loops, conditionals, simple selectors, fundamental queries
- **Medium**: Common algorithms, data structures, classes, responsive layouts, multi-table JOINs
- **Hard**: Advanced algorithms, recursion, concurrency/threading, complex CSS 3D/glassmorphism, recursive CTEs and window functions

### Snippet Dataset
- Exactly 72 curated snippets (8 languages × 3 difficulties × 3 snippets each).
- Clean metadata: `{ id, language, difficulty, title, code }`.
- Random selection with immediate-repeat avoidance when multiple snippets exist in a category.
- Safe fallbacks for unknown language or difficulty inputs.

### Supported Timers
- **30 seconds** (30s)
- **1 minute** (60s)
- **2 minutes** (120s)
- **3 minutes** (180s)
- **4 minutes** (240s)
- **5 minutes** (300s)
- **10 minutes** (600s)

### WPM Formula
$$\text{WPM} = \frac{\text{correctCharacters} / 5}{\text{elapsedMinutes}}$$
- Standard: 1 word = 5 characters.
- Uses only **correctly typed characters** (not total typed).
- Avoids division by zero and rounds to nearest whole number.

### Accuracy Formula
$$\text{Accuracy} = \left(\frac{\text{correctCharacters}}{\text{totalTypedCharacters}}\right) \times 100$$
- Expressed as a percentage rounded to 1 decimal place.
- Returns 0% if total typed characters is 0.

---

## Procedural Mechanical Keyboard Audio Engine

CodeSpeed features a custom procedural mechanical-keyboard audio system designed to deliver tactile acoustic feedback with zero third-party audio dependencies.

> Rather than shipping large recorded sound libraries, CodeSpeed generates its keyboard audio from mathematical waveform components and compact WAV assets. This keeps the feature lightweight while giving the typing experience a distinctive mechanical character.

### Procedural Waveform Synthesis Architecture
All sound assets are generated programmatically via Node.js mathematical audio synthesis using physical modeling principles rather than external sound packs:

- **Transient & Noise Elements**: Short-duration ($< 2.5\text{ ms}$) noise bursts shaped with sharp exponential decay to emulate switch slider friction and tactile leaf snap.
- **Sinusoidal & Modal Resonances**: Multiple parallel sinusoidal frequency modes ($200\text{ Hz} - 4.2\text{ kHz}$) simulating keycap acoustic cavity resonance and switch housing bottom-out impact.
- **Exponential Envelopes**: Tight, parameterized decay envelopes ($35\text{ ms} - 55\text{ ms}$) preventing acoustic muddiness during high-speed typing runs.
- **Tailored Switch Profiles**:
  - `key-01.wav` & `key-02.wav`: Standard alphanumeric keys with alternating resonant profiles for natural cadence.
  - `space.wav`: Deeper low-mid modal body ($210\text{ Hz}$) with stabilizer wire tick.
  - `enter.wav`: Wide stabilizer impact and acoustic keycap dispersion.
  - `backspace.wav`: Compact modifier switch snap with fast dampening.

### High-Performance Web Audio Playback
- **Ultra-Lightweight Footprint**: The entire procedural sound suite occupies only **~19.9 KB total** across all 5 WAV assets.
- **In-Memory Buffer Caching**: Decoded once into native Web Audio `AudioBuffer` objects on application startup/test initiation for zero runtime network requests and zero latency.
- **Anti-Repetition Micro-Dynamics**: Each keystroke applies subtle randomized micro-jitter to playback rate ($\pm 3\%$) and gain ($\pm 3\%$) to eliminate mechanical "machine gun" repetition artifacts.
- **User Volume Control & Persistence**: Integrated interactive slider ($0\% - 100\%$) in the test toolbar, safely clamped with clipping protection, persisted across sessions via `localStorage` (`codespeed_sound_volume`), with independent mute toggling.

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/health` | API health check | None |
| `POST` | `/api/auth/signup` | Register a new user | `{ "username": "...", "email": "...", "password": "..." }` |
| `POST` | `/api/auth/login` | Authenticate user & return JWT | `{ "email": "...", "password": "..." }` |
| `GET` | `/api/users/:username/profile` | Retrieve shareable public profile (Always public ranked stats & badges; practice stats included only if user set privacy to public) | None |

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/auth/me` | Fetch authenticated user profile | None |
| `PATCH` | `/api/auth/privacy` | Update practice statistics visibility | `{ "practiceStatsVisibility": "private" \| "public" }` |
| `POST` | `/api/performances` | Record a completed typing performance with anti-tamper validation | `{ "mode": "practice" \| "ranked", "language": "...", "difficulty": "...", "timerSeconds": 60, "wpm": 75, "accuracy": 98.5, "correctChars": 375, "incorrectChars": 6, "elapsedSeconds": 60, "snippetId": "..." }` |
| `GET` | `/api/performances` | Retrieve user performance history with mode filtering, query filters, and sorting (`?mode=practice\|ranked\|all&language=...&timerSeconds=...&sort=newest\|wpm_desc\|wpm_asc&page=...&limit=...`) | None |
| `GET` | `/api/performances/graph` | Retrieve chronological WPM progression dataset for mode (`?mode=practice\|ranked&language=...&timerSeconds=...`) | None |
| `GET` | `/api/performances/summary` | Retrieve aggregated dashboard statistics by mode (`?mode=practice\|ranked`) | None |
| `GET` | `/api/performances/badges` | Retrieve server-evaluated ranked milestone badges and streak progress | None |

---

## Milestone Progress

- [x] **Milestone 0 (M0)**: Project initialization, React + Vite scaffolding, Express health check, Git security configuration.
- [x] **Milestone 1 (M1)**: Authentication system, User model, MongoDB connection, bcrypt hashing, JWT issuance & middleware, React Auth UI, automated tests.
- [x] **Milestone 2 (M2)**: Coding typing engine, 8 languages, 7 timer durations, live character-level feedback, Tab indentation, WPM & accuracy metrics, results card, unit test suite.
- [x] **Milestone 3 (M3)**: Snippet System V2, 72 curated realistic coding snippets across 8 languages and 3 difficulties (Easy/Medium/Hard), repeat-avoiding selection logic, difficulty UI controls, metadata display in test & results.
- [x] **Milestone 4 (M4)**: Performance Persistence, MongoDB Performance model with user reference and strict validation, authenticated `POST /api/performances` endpoint with server-derived identity, client deduplication, resilient non-blocking UI, and full integration test coverage.
- [x] **Milestone 5 (M5)**: Performance History, authenticated `GET /api/performances` with server-side query filtering (`language` and `timerSeconds`), pagination, user isolation, PerformanceHistory view with combinable filters, empty/loading/error states, and direct navigation from test results.
- [x] **Milestone 6 (M6)**: Performance Sorting, server-side validated WPM sorting (`newest`, `wpm_desc`, `wpm_asc`) with deterministic secondary tie-breaking, pagination ordering preservation, and interactive Sort By controls in Performance History.
- [x] **Milestone 7 (M7)**: WPM Progression Graph, responsive SVG visualization of typing speed improvement across sequential attempts, chronological ordering (`createdAt ASC`), dynamic numeric Y-axis bounds/ticks, interactive hover tooltips, filter integration, single/multi-point handling, and 500-attempt safety capping with explicit notice.
- [x] **Milestone 8 (M8)**: Dashboard & Final Polish, comprehensive authenticated home dashboard with key summary metrics, deterministic Personal Best tie-breaking, language mastery breakdown with averageWpm, recent activity feed, unified 3-tab navigation (Dashboard, Practice, History), responsive styling refinements, and polished user flows.
- [x] **Milestone 9 (M9)**: Ranked Typing vs Unranked Practice, 14 server-evaluated milestone badges (speed thresholds, 5-attempt streaks, volume, and consistency), anti-tamper metric verification, practice privacy controls (`private` default vs `public`), dedicated shareable public profile view (`#/user/:username`), and standalone legacy record migration script.