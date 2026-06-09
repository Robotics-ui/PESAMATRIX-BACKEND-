import express from 'express';
import { ENV } from './config/env';
import { metaApiWorker } from './queue/metaapi.queue';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import copyRoutes from './routes/copy.routes';

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/copy', copyRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'PesaMatrix Engine Core'
  });
});

// Queue Event Monitoring
metaApiWorker.on('completed', (job) => {
  console.log(
    `[Queue Success] Task completed successfully. Job ID: ${job.id}`
  );
});

metaApiWorker.on('failed', (job, err) => {
  console.error(
    `[Queue Failure] Job ID ${job?.id} failed: ${err.message}`
  );
});

// Start Server
app.listen(ENV.PORT, () => {
  console.log(
    `🚀 PesaMatrix Engine Core running on port ${ENV.PORT}`
  );
});
