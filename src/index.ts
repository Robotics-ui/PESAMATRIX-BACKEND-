import express from 'express';
import { ENV } from './config/env';

import { metaApiWorker } from './queue/metaapi.queue';
import { enforcementWorker } from './queue/enforcement.worker';
import { initializeCronJobs } from './queue/cron.scheduler';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import copyRoutes from './routes/copy.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/copy', copyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'PesaMatrix Cloud Engine',
    architecture: 'MetaApi CopyFactory Cloud-to-Cloud',
    modules: {
      authentication: 'ACTIVE',
      accounts: 'ACTIVE',
      copyTrading: 'ACTIVE',
      payments: 'ACTIVE',
      analytics: 'ACTIVE',
      enforcement: 'ACTIVE',
      scheduling: 'ACTIVE'
    }
  });
});

// MetaApi Queue Monitoring
metaApiWorker.on('completed', (job) => {
  console.log(
    `[MetaApi Queue] Task completed successfully. Job ID: ${job.id}`
  );
});

metaApiWorker.on('failed', (job, err) => {
  console.error(
    `[MetaApi Queue Failure] Job ID ${job?.id} failed: ${err.message}`
  );
});

// Enforcement Queue Monitoring
enforcementWorker.on('completed', (job) => {
  console.log(
    `[Enforcement Queue] Verification sweep completed. Job ID: ${job.id}`
  );
});

enforcementWorker.on('failed', (job, err) => {
  console.error(
    `[Enforcement Queue Failure] Job ID ${job?.id} failed: ${err.message}`
  );
});

// Server Startup
app.listen(ENV.PORT, async () => {
  console.log(`
=============================================================
🚀 PESAMATRIX CLOUD ENGINE STARTED
📡 Port: ${ENV.PORT}
🔒 Architecture: MetaApi CopyFactory Cloud-to-Cloud
💾 Database: PostgreSQL + Prisma ORM
⚡ Queue Engine: Upstash Redis + BullMQ
🔐 Authentication Module: Active
🏦 Account Management Module: Active
📈 Copy Trading Module: Active
💳 Payments Module: Active
📊 Analytics Module: Active
🛡️ Enforcement Engine: Active
⏰ Cron Scheduler: Initializing
=============================================================
`);

  try {
    await initializeCronJobs();
    console.log('✅ Background cron schedules initialized successfully');
  } catch (error) {
    console.error(
      '❌ Failed initializing background cron schedules:',
      error
    );
  }
});
