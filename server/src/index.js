import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { setupRoomSocket } from './sockets/roomHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://code-speed-five.vercel.app',
];

const clientEnvOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean)
  : [];

const allowedOrigins = [...new Set([...defaultOrigins, ...clientEnvOrigins])];

export const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/$/, '');
  if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
    return true;
  }
  // Allow all Vercel deployment and preview subdomains
  if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin)) {
    return true;
  }
  return false;
};

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/performances', performanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'CodeSpeed API is running',
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'CodeSpeed API',
    status: 'running',
    healthCheck: '/api/health',
  });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found',
  });
});

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupRoomSocket(io);

import { fileURLToPath } from 'url';

// Start server if run directly
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  // Connect to MongoDB if URI configured
  connectDB().catch((err) => {
    console.warn(`[MongoDB] Initial connection attempt failed: ${err.message}`);
  });

  server.listen(PORT, () => {
    console.log(`[CodeSpeed Server] running on http://localhost:${PORT}`);
    console.log(`[CodeSpeed Server] Health check available at http://localhost:${PORT}/api/health`);
  });
}

export { server, io };
export default app;
