import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`[CodeSpeed Server] running on http://localhost:${PORT}`);
  console.log(`[CodeSpeed Server] Health check available at http://localhost:${PORT}/api/health`);
});
