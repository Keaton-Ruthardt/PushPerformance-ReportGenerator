import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
// import pool from './config/database.js'; // Deprecated - using BigQuery
import { testConnection } from './config/bigquery.js';
// import syncPercentiles from './scripts/syncPercentiles.js';

// Import routes
import authRoutes from './routes/auth.js';
import athleteRoutes from './routes/athletes.js';
import reportRoutes from './routes/reportRoutes.js'; // Using reportRoutes.js with CMJ comparison
import athletePerformanceRoutes from './routes/athletePerformance.js';
import cmjRoutes from './routes/cmj.js';
import pdfRoutes from './routes/pdf.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Push Performance API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/performance', athletePerformanceRoutes);
app.use('/api/cmj', cmjRoutes);
app.use('/api/pdf', pdfRoutes);

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from Vite build (dist folder)
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Handle React routing - return all requests to React app (Express v5 compatible)
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
} else {
  console.log('🔧 Running in development mode - React dev server should be running separately');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize BigQuery connection
const initializeDatabase = async () => {
  try {
    const connected = await testConnection();
    if (connected) {
      console.log('✅ BigQuery connection established successfully');
    } else {
      console.error('❌ Failed to connect to BigQuery');
    }
  } catch (error) {
    console.error('❌ Error connecting to BigQuery:', error.message);
  }
};

// Schedule percentile sync (optional - commented out for now)
// const PERCENTILE_SYNC_SCHEDULE = process.env.PERCENTILE_SYNC_SCHEDULE || '0 3 * * *';
// cron.schedule(PERCENTILE_SYNC_SCHEDULE, () => {
//   console.log('Running scheduled percentile sync...');
//   syncPercentiles().catch(error => {
//     console.error('Scheduled percentile sync failed:', error);
//   });
// });

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`\n🚀 Push Performance Server is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`☁️  Using BigQuery dataset: ${process.env.BIGQUERY_DATASET}`);
      console.log('\nPress Ctrl+C to stop the server\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
