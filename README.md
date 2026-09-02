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

### Backend (`server/`)
- **Node.js**
- **Express**
- **MongoDB & Mongoose**
- **JSON Web Tokens (jsonwebtoken)**
- **Password Hashing (bcryptjs)**
- **CORS**
- **dotenv**

### Testing (`server/tests/`)
- **Node.js Test Runner (`node:test`, `node:assert`)**
- **In-Memory MongoDB (`mongodb-memory-server`)** for isolated integration tests

---

## Project Structure

```text
CodeSpeed/
├── client/                     # React + Vite frontend application
│   ├── public/                 # Static assets & favicons
│   ├── src/
│   │   ├── assets/             # Logos & icons
│   │   ├── components/
│   │   │   └── AuthForm.jsx    # Login & Signup interactive form component
│   │   ├── services/
│   │   │   └── api.js          # Centralized API service with JWT management
│   │   ├── App.css             # Dark-themed styling
│   │   ├── App.jsx             # Main application component & auth state
│   │   ├── index.css           # Global reset & baseline styles
│   │   └── main.jsx            # React root entrypoint
│   ├── index.html              # HTML entrypoint
│   ├── package.json            # Frontend dependencies & scripts
│   └── vite.config.js          # Vite build configuration
├── server/                     # Node.js + Express backend API
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js           # Mongoose MongoDB connection config
│   │   ├── controllers/
│   │   │   └── authController.js # Signup, login, and profile controllers
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification middleware
│   │   ├── models/
│   │   │   └── User.js         # Mongoose User schema & password security
│   │   ├── routes/
│   │   │   └── authRoutes.js   # Auth API route definitions
│   │   └── index.js            # Express app entrypoint & middleware
│   ├── tests/
│   │   └── auth.test.js        # Integration tests for auth & health APIs
│   └── package.json            # Backend dependencies, scripts & test runner
├── .env.example                # Template for environment variables (safe to commit)
├── .gitignore                  # Git ignore rules for node_modules, .env, builds, etc.
└── README.md                   # Project documentation
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
- **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017/codespeed`) or a free MongoDB Atlas connection string.

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

## Running Automated Tests

Run the backend integration test suite:
```bash
cd server
npm test
```
The tests execute against an isolated in-memory MongoDB instance and verify:
- User signup (validation, hashing, duplicate email & username prevention)
- User login (valid credentials, incorrect passwords, nonexistent accounts)
- JWT authentication (valid token, missing token, malformed/expired token)
- Protected `/api/auth/me` endpoint (ensuring `passwordHash` is never leaked)
- System health check `/api/health`

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/health` | API health check | None |
| `POST` | `/api/auth/signup` | Register a new user | `{ "username": "...", "email": "...", "password": "..." }` |
| `POST` | `/api/auth/login` | Authenticate user & return JWT | `{ "email": "...", "password": "..." }` |

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/me` | Fetch authenticated user profile |

---

## Milestone Progress

- [x] **Milestone 0 (M0)**: Project initialization, React + Vite scaffolding, Express health check, Git security configuration.
- [x] **Milestone 1 (M1)**: Authentication system, User model, MongoDB connection, bcrypt hashing, JWT issuance & middleware, React Auth UI, automated tests.