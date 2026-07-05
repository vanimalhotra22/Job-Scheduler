import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import apiRouter from './routes/api';
import { getDb } from './database/db';
import { seedDatabase } from './database/seed';
import { startScheduler, stopScheduler } from './services/scheduler';
import { startReclaimer, stopReclaimer } from './services/reclaimer';
import { startLeaderElection, stopLeaderElection } from './services/leaderElection';
import { setSocketIO, initializeEventSubscriber } from './services/sse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing of JSON request bodies
app.use(cors());
app.use(express.json());

// Main API Router mount
app.use('/api', apiRouter);

// Root landing endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Distributed Job Scheduler Engine API is online',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create HTTP server wrapping Express
const httpServer = createServer(app);

// Initialize Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Bind Socket.io instance to the event broadcast service
setSocketIO(io);

// Initialize real-time message subscriber loop
initializeEventSubscriber();

io.on('connection', (socket) => {
  console.log(`[WebSockets] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[WebSockets] Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    console.log('Initializing database...');
    // Connect database and run schema migration
    await getDb();

    console.log('Seeding initial data...');
    // Seed default administrative details and default queues
    await seedDatabase();

    // Start HA scheduler leader election lease-lock
    await startLeaderElection();

    // Start background services
    startScheduler();
    startReclaimer();

    // Start HTTP and WebSocket listener
    httpServer.listen(PORT, () => {
      console.log(`Express Server & WebSockets running on port ${PORT}`);
      
      // On Render / Production environments, auto-start a worker process locally 
      // to keep everything on the 100% Free tier without a separate worker service.
      if (process.env.NODE_ENV === 'production') {
        console.log('[System] Auto-spawning internal worker node...');
        try {
          const { fork } = require('child_process');
          const path = require('path');
          const workerPath = path.resolve(__dirname, './worker.js');
          
          const workerProcess = fork(workerPath, [], {
            env: {
              ...process.env,
              API_SERVER: `http://localhost:${PORT}/api`
            }
          });
          
          workerProcess.on('error', (err: any) => {
            console.error('[System] Internal worker process error:', err);
          });
        } catch (e) {
          console.error('[System] Failed to auto-spawn internal worker:', e);
        }
      }
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Starting graceful shutdown...`);
      
      // Stop background tickers
      stopScheduler();
      stopReclaimer();
      stopLeaderElection();

      httpServer.close(async () => {
        console.log('HTTP & WebSocket server closed.');
        try {
          const db = await getDb();
          await db.close();
          console.log('Database connection closed.');
          process.exit(0);
        } catch (dbError) {
          console.error('Error closing database during shutdown:', dbError);
          process.exit(1);
        }
      });

      // Force close after 10s
      setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
