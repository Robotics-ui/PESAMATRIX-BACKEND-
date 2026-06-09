import express from 'express';
import { ENV } from './config/env';
import { metaApiWorker } from './queue/metaapi.queue';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import copyRoutes from './routes/copy.routes';
import paymentRoutes from './routes/payment.routes';

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/copy', copyRoutes);
app.use('/api/payments', paymentRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'PesaMatrix System Core Engine'
  });
});

// MetaApi Queue Monitoring
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

// Server Startup
app.listen(ENV.PORT, () => {
  console.log(`
=================================================
🚀 PesaMatrix System Core Engine Started
📡 Port: ${ENV.PORT}
💳 Payments Module: Active
📈 Copy Trading Module: Active
🔐 Authentication Module: Active
🏦 Account Management Module: Active
=================================================
`);
});
