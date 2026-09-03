import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = CLIENT_URL.split(',').map((u) => u.trim());

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not allowed by CORS policy.`));
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/performances', performanceRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'CodeSpeed API is running'
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'CodeSpeed API',
    status: 'running',
    healthCheck: '/api/health'
  });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found'
  });
});

import { fileURLToPath } from 'url';

// Start server if run directly
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  // Connect to MongoDB if URI configured
  connectDB().catch((err) => {
    console.warn(`[MongoDB] Initial connection attempt failed: ${err.message}`);
  });

  app.listen(PORT, () => {
    console.log(`[CodeSpeed Server] running on http://localhost:${PORT}`);
    console.log(`[CodeSpeed Server] Health check available at http://localhost:${PORT}/api/health`);
  });
}

export default app;

