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

### Backend (`server/`)
- **Node.js**
- **Express**
- **CORS**
- **dotenv**

### Database (Planned)
- MongoDB (to be introduced in later milestones)

---

## Project Structure

```text
CodeSpeed/
├── client/                 # React + Vite frontend application
│   ├── public/             # Static assets & favicons
│   ├── src/                # React source code (components, styles)
│   ├── index.html          # HTML entrypoint
│   ├── package.json        # Frontend dependencies & scripts
│   └── vite.config.js      # Vite build configuration
├── server/                 # Node.js + Express backend API
│   ├── src/
│   │   └── index.js        # Express app entrypoint & health routes
│   └── package.json        # Backend dependencies & scripts
├── .env.example            # Template for environment variables (safe to commit)
├── .gitignore              # Git ignore rules for node_modules, .env, builds, etc.
└── README.md               # Project documentation
```

---

## Security Notice

> [!CAUTION]
> **Zero Secrets Policy**: Never commit `.env`, secret keys, API tokens, database connection strings, or credentials to version control.
>
> - All sensitive configurations belong in local `.env` files.
> - `.env` and related variations are explicitly ignored by `.gitignore`.
> - Always maintain `.env.example` with empty or dummy placeholder values for team reference.
> - Always inspect `git status` and staged files before creating any commit.

---

## Local Setup & Getting Started

### Prerequisites
- **Node.js**: v18+ recommended (tested on v24)
- **npm**: v9+ (tested on v11)

### 1. Clone the Repository
```bash
git clone https://github.com/aadesh-2006/CodeSpeed.git
cd CodeSpeed
```

### 2. Configure Environment Variables
Copy `.env.example` to create local `.env` configurations if needed:
```bash
# Optional root/server configuration
copy .env.example server\.env    # On Windows
# cp .env.example server/.env    # On Linux/macOS
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
- **Health Check Endpoint**: `http://localhost:5000/api/health`

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

## API Health Check Endpoint

- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "status": "ok",
  "message": "CodeSpeed API is running"
}
```

---

## Current Status: Milestone 0 (M0)
- [x] Project architecture and monorepo scaffolding
- [x] Clean client & server separation
- [x] Node.js/Express backend with health check endpoint
- [x] React + Vite frontend with CodeSpeed brand showcase
- [x] Secure gitignore rules & environment variable templates