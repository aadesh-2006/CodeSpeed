# CodeSpeed

> **Type code. Track speed. Improve.**

CodeSpeed is a developer-centric typing speed tracker designed specifically for programmers. Unlike traditional typing platforms that benchmark user speed on English prose, sentences, or random dictionary words, CodeSpeed measures typing proficiency directly against real-world programming code snippets, syntax constructs, symbols, and formatting.

---

## Tech Stack

### Frontend (`client/`)
- **React 19**
- **Vite**
- **JavaScript (ES Modules)**
- **Socket.IO Client (`socket.io-client`)** for real-time room communication
- Modern vanilla CSS design system
- Client API service with JWT authentication state management (`localStorage`)
- Interactive coding typing engine with character-level accuracy and custom `Tab` indentation
- Procedural mechanical keyboard audio system with Web Audio API playback and local volume persistence

### Backend (`server/`)
- **Node.js**
- **Express**
- **Socket.IO (`socket.io`)** for bidirectional, low-latency room event synchronization
- **MongoDB & Mongoose**
- **JSON Web Tokens (jsonwebtoken)**
- **Password Hashing (bcryptjs)**
- **CORS**
- **dotenv**

### Testing
- **Node.js Native Test Runner (`node:test`, `node:assert`)**
- **Backend Tests (`server/tests/`)**: Isolated integration tests using `mongodb-memory-server` for authentication, performance, streak, and multiplayer rooms
- **Frontend Tests (`client/tests/`)**: Unit and component tests for typing engine, audio synthesis, public profiles, streaks, and multiplayer competition rooms

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
│   │   │   ├── rooms/              # Multiplayer Competition Room components
│   │   │   │   ├── RoomLobby.jsx   # Real-time lobby, configuration & host controls
│   │   │   │   ├── RoomRace.jsx    # Live race view, progress bars & anti-tamper client
│   │   │   │   ├── RoomResults.jsx # Post-race leaderboard & winner spotlight
│   │   │   │   ├── RoomsHub.jsx    # Room creation, joining & active rooms dashboard
│   │   │   │   └── RoomView.jsx    # Top-level room state router & socket listener manager
│   │   │   ├── AuthForm.jsx        # Login & Signup interactive form
│   │   │   ├── BadgesGrid.jsx      # Ranked milestone badges & achievements
│   │   │   ├── DailyActivity.jsx   # Daily activity breakdown (Ranked, Practice, Competition)
│   │   │   ├── Dashboard.jsx       # Authenticated home dashboard & metrics
│   │   │   ├── PerformanceHistory.jsx # Filterable, paginated attempt history
│   │   │   ├── PrivacySettingsModal.jsx # Practice privacy settings modal
│   │   │   ├── PublicProfile.jsx   # Shareable public developer profile
│   │   │   ├── Settings.jsx        # Account & profile customization
│   │   │   ├── StreakCard.jsx      # Daily practice streak widget & 52-week heatmap
│   │   │   ├── TestResult.jsx      # Test completion summary card
│   │   │   ├── TestSetup.jsx       # Language & timer selection UI
│   │   │   ├── TypingTest.jsx      # Active typing test, sound controls & code editor
│   │   │   ├── UserSearch.jsx      # Developer discovery & profile search
│   │   │   └── WpmProgressionGraph.jsx # SVG WPM progression graph
│   │   ├── data/
│   │   │   └── snippets.js         # Multiline code snippets (8 languages, 72 total)
│   │   ├── services/
│   │   │   ├── api.js              # Centralized REST API service with JWT management
│   │   │   └── socket.js           # Singleton Socket.IO client manager
│   │   ├── utils/
│   │   │   ├── keyboardSound.js    # Procedural audio engine, buffer cache & volume control
│   │   │   ├── streakCalculator.js # Daily streak & timezone-aware date calculations
│   │   │   └── typingMetrics.js    # Pure WPM, accuracy, & diffing utilities
│   │   ├── App.css                 # Dark-themed styling & responsive design system
│   │   ├── App.jsx                 # App entrypoint & routing state machine
│   │   ├── index.css               # Global reset & baseline styles
│   │   └── main.jsx                # React root entrypoint
│   ├── tests/
│   │   ├── badgeRules.test.js      # Milestone badge verification tests
│   │   ├── components.test.js      # Component prop & rendering tests
│   │   ├── graphMetrics.test.js    # WPM progression graph computation tests
│   │   ├── keyboardSound.test.js   # Audio engine, volume, & buffer lifecycle tests
│   │   ├── publicProfile.test.js   # Public profile and DailyActivity component tests
│   │   ├── rooms.test.js           # Multiplayer competition frontend component & socket tests
│   │   ├── search.test.js          # Search & discovery pure logic tests
│   │   ├── settings.test.js        # Profile validation & security tests
│   │   ├── snippets.test.js        # Snippet dataset & distribution tests
│   │   ├── streak.test.js          # Streak & heatmap pure logic tests
│   │   └── typingMetrics.test.js   # Unit tests for typing engine formulas
│   ├── index.html                  # HTML entrypoint
│   ├── package.json                # Frontend dependencies & test scripts
│   └── vite.config.js              # Vite build configuration
├── server/                         # Node.js + Express backend API
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # Mongoose MongoDB connection config
│   │   ├── controllers/
│   │   │   ├── authController.js   # Auth, public profile & daily activity controllers
│   │   │   ├── performanceController.js # Performance metrics & streak controllers
│   │   │   └── roomController.js   # Competition room creation & results controllers
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification & optional authentication middleware
│   │   ├── models/
│   │   │   ├── CompetitionResult.js # Post-race leaderboard rankings model
│   │   │   ├── CompetitionRoom.js   # Room state, participants, and config model
│   │   │   ├── Performance.js      # Individual attempt performance record model
│   │   │   └── User.js             # Mongoose User schema & password security
│   │   ├── routes/
│   │   │   ├── authRoutes.js       # Auth API route definitions
│   │   │   ├── performanceRoutes.js # Performance API route definitions
│   │   │   ├── roomRoutes.js       # Competition room API route definitions
│   │   │   └── userRoutes.js       # User profile & discovery route definitions
│   │   ├── services/
│   │   │   └── roomManager.js      # In-memory room manager, timer management & lifecycle
│   │   ├── sockets/
│   │   │   └── roomHandler.js      # Socket.IO authentication & event listeners
│   │   ├── utils/
│   │   │   └── streakCalculator.js # Authoritative streak calculation utilities
│   │   └── index.js                # Express app, Socket.IO server & middleware
│   ├── tests/
│   │   ├── auth.test.js            # Integration tests for auth & health APIs
│   │   ├── performance.test.js     # Performance persistence & badges integration tests
│   │   ├── room.test.js            # Full end-to-end competition room socket & REST tests
│   │   └── streak.test.js          # Daily streak, heatmap, and privacy integration tests
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
---

## Real-Time Multiplayer Competition Rooms

CodeSpeed features a real-time multiplayer competition engine allowing developers to create custom rooms, invite peers with a 6-character room code, and compete head-to-head in synchronized typing races.

### Multiplayer Architecture & Lifecycle

```text
Waiting Room (Lobby) ──► Countdown (3-2-1) ──► Active Race ──► Final Leaderboard
  • Host Configuration      • Synchronized Timer   • Live Progress     • Deterministic Ranking
  • 8 Languages, 3 Diff     • Config Frozen        • Speed Ceiling     • MongoDB Persistence
  • 7 Timer Durations       • Canonical Snippet    • Anti-Tamper       • Activity Integration
```

1. **Room Creation & Join Protocol**:
   - Host generates a room with custom configuration (Language, Difficulty, and Timer).
   - Generates an ambiguity-free 6-character room code (e.g., `COMP01`).
   - Reconnection hydration: reconnecting participants seamlessly restore room state without duplicating roster slots.

2. **Server-Authoritative Countdown & Race Timing**:
   - When the host starts the competition, the server establishes `countdownStartsAt`, `raceStartsAt`, and `raceEndsAt`.
   - A deterministic 3-second countdown (`3-2-1`) synchronizes all participants.
   - All race deadlines and elapsed durations are calculated server-side; client clocks are UI-only.
   - Authoritative expiration timer automatically finalizes races when `raceEndsAt` is reached.

3. **Live Progress Broadcasting**:
   - Participants broadcast throttled character-position and live WPM updates over Socket.IO.
   - Real-time opponent progress bars and position indicators display live on all client screens.

4. **Server-Authoritative Anti-Tamper Verification**:
   - Client submission claims (WPM, accuracy, rank, elapsed time) are not trusted.
   - The server computes authoritative elapsed seconds from `raceStartsAt` to submission receipt, verifies characters against the canonical snippet, calculates true WPM and accuracy, and applies physical speed ceilings.

5. **Deterministic Post-Race Leaderboard & Persistence**:
   - **Finished Racers**: Ranked by `elapsedSeconds ASC`, then `finishedAt ASC`.
   - **Incomplete / Timed-Out Racers**: Ranked by `progressPercent DESC`, `wpm DESC`, `accuracy DESC`.
   - Idempotent persistence saves `CompetitionResult` rankings and individual participant `Performance` records (`mode: 'competition'`).

6. **Competition Activity & Heatmap Integration**:
   - Competition attempts contribute directly to the 52-week activity heatmap and daily streaks (`Practice + Ranked + Competition`).
   - Single source of truth: only `Performance(mode='competition')` is counted, preventing double-counting with `CompetitionResult`.
   - Strict mode isolation: Competition attempts do not alter solo Ranked personal bests, Ranked badges, or Practice stats.

---

## Daily Streak & Contribution Heatmap

- **52-Week GitHub/LeetCode-Style Activity Heatmap**: Visualizes completed coding sessions across 52 weeks (364 days).
- **Intensity Levels**:
  - `0 tests` → Level 0 (Neutral)
  - `1 test` → Level 1
  - `2–3 tests` → Level 2
  - `4–7 tests` → Level 3
  - `8–15 tests` → Level 4
  - `16+ tests` → Level 5
- **Timezone-Aware**: All daily streak calculations and heatmap bins respect the profile owner's configured timezone.
- **Privacy Controls**: When practice stats are private, visitors see public Ranked and Competition activity, keeping private practice attempts hidden.

---

## Socket.IO Real-Time Events

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ "code": "ROOM01" }` | Join or reconnect to a competition room |
| `room:leave` | `{ "code": "ROOM01" }` | Leave the current room (triggers host transfer if applicable) |
| `room:update_config` | `{ "code": "ROOM01", "config": { ... } }` | Host updates language, difficulty, or timer in lobby |
| `room:start` | `{ "code": "ROOM01" }` | Host initiates 3-second synchronized countdown |
| `race:progress` | `{ "code": "ROOM01", "progressPercent": 45, "liveWpm": 80 }` | Throttled live race progress broadcast |
| `race:submit` | `{ "code": "ROOM01", "correctChars": 320, "completedSnippet": true }` | Submit completed race for server verification |

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `room:state` | `{ room }` | Full room state delivered upon connection/hydration |
| `room:user_joined` | `{ user, participantCount }` | Broadcast when a new participant enters the lobby |
| `room:user_left` | `{ userId, username, newHost, room }` | Broadcast when a participant leaves or host transfers |
| `room:config_updated` | `{ config, snippet, room }` | Broadcast when host modifies room configuration |
| `room:countdown` | `{ countdownStartsAt, raceStartsAt, raceEndsAt, snippet }` | Synchronized 3-second countdown initiation |
| `room:race_started` | `{ raceStartsAt, raceEndsAt, snippet }` | Broadcast when race timer begins |
| `race:progress_update` | `{ userId, username, progressPercent, liveWpm }` | Live opponent progress update |
| `race:user_finished` | `{ userId, username, rank, wpm, accuracy }` | Broadcast when a competitor completes the snippet |
| `room:finished` | `{ room }` | Broadcast when all racers finish or timer expires |
| `room:cancelled` | `{ message }` | Broadcast when room closes due to participant exit |
| `room:error` | `{ message }` | Error notification sent to client |

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/health` | API health check | None |
| `POST` | `/api/auth/signup` | Register a new user | `{ "username": "...", "email": "...", "password": "..." }` |
| `POST` | `/api/auth/login` | Authenticate user & return JWT | `{ "email": "...", "password": "..." }` |
| `GET` | `/api/users/:username/profile` | Retrieve shareable public profile (Ranked & Competition stats always public; Practice included only if public) | None |
| `GET` | `/api/users/:username/activity/:date` | Retrieve detailed typing attempts for a calendar date (`YYYY-MM-DD`) | None |
| `GET` | `/api/users/search?q=:query` | Search developer profiles by username | None |

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/auth/me` | Fetch authenticated user profile | None |
| `PATCH` | `/api/auth/profile` | Update profile bio, photo data URI, and account details | `{ "bio": "...", "profilePhoto": "..." }` |
| `PATCH` | `/api/auth/privacy` | Update practice statistics visibility | `{ "practiceStatsVisibility": "private" \| "public" }` |
| `POST` | `/api/performances` | Record a completed typing performance with anti-tamper validation | `{ "mode": "practice" \| "ranked", "language": "...", "difficulty": "...", "timerSeconds": 60, "wpm": 75, "accuracy": 98.5, "correctChars": 375, "incorrectChars": 6, "elapsedSeconds": 60, "snippetId": "..." }` |
| `GET` | `/api/performances` | Retrieve user performance history with mode filtering and sorting (`?mode=practice\|ranked\|all&language=...&timerSeconds=...&sort=newest\|wpm_desc\|wpm_asc&page=...&limit=...`) | None |
| `GET` | `/api/performances/graph` | Retrieve chronological WPM progression dataset for mode (`?mode=practice\|ranked&language=...&timerSeconds=...`) | None |
| `GET` | `/api/performances/summary` | Retrieve aggregated dashboard statistics by mode (`?mode=practice\|ranked`) | None |
| `GET` | `/api/performances/badges` | Retrieve server-evaluated ranked milestone badges and streak progress | None |
| `GET` | `/api/performances/streak` | Retrieve current streak, longest streak, and 52-week heatmap activity | None |
| `POST` | `/api/rooms` | Create a new multiplayer competition room | `{ "language": "javascript", "difficulty": "medium", "timerSeconds": 60 }` |
| `GET` | `/api/rooms/:code` | Retrieve competition room metadata and participant state | None |
| `GET` | `/api/rooms/:code/results` | Retrieve durable competition leaderboard results (participants only) | None |

---

## Milestone Progress

### Core Platform & Solo Typing Engine
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

### Real-Time Multiplayer Competition Rooms
- [x] **Multiplayer M1**: Socket.IO server architecture, MongoDB competition schemas (`CompetitionRoom`, `CompetitionResult`, `Performance.mode = 'competition'`), in-memory room manager, canonical snippet distribution, and host transfer handling.
- [x] **Multiplayer M2**: Client Socket.IO service singleton, API client room methods, and Rooms Hub view (`#/rooms`) for room creation, joining by code, and active rooms browsing.
- [x] **Multiplayer M3**: Real-time Room Lobby (`RoomLobby.jsx`), live participant list with avatars/host badge, host configuration controls across all 8 languages, 3 difficulties, and 7 canonical timer durations (30s, 1m, 2m, 3m, 4m, 5m, 10m).
- [x] **Multiplayer M4**: Synchronized 3-second countdown (`3-2-1`), server-authoritative race timestamps (`countdownStartsAt`, `raceStartsAt`, `raceEndsAt`), live opponent progress broadcasting, and race timeout handling.
- [x] **Multiplayer M5**: Post-race Leaderboard & Results (`RoomResults.jsx`), 1st place champion spotlight banner, deterministic server ranking (`elapsedSeconds ASC`, `finishedAt ASC`), participant-only authorization, and durable MongoDB upserts.
- [x] **Multiplayer M6**: Competition Activity Integration, unified activity accounting (`Practice + Ranked + Competition`), 52-week heatmap integration, Daily Activity three-mode breakdown (`DailyActivity.jsx`), and strict privacy preservation.
- [x] **Multiplayer M7**: End-to-End Verification, production-readiness security audits, cross-mode isolation verification, and comprehensive technical documentation.