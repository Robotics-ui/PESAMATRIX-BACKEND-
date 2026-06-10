import express from 'express';
import cors from 'cors';
import { ENV, IS_REDIS_CONFIGURED } from './config/env';

import { metaApiWorker } from './queue/metaapi.queue';
import { enforcementWorker } from './queue/enforcement.worker';
import { initializeCronJobs } from './queue/cron.scheduler';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import copyRoutes from './routes/copy.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();

const corsOptions: cors.CorsOptions = {
  origin: ['https://pesamatrix-signal-fx-f--signalfx.replit.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/copy', copyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'PesaMatrix Cloud Engine',
    architecture: 'MetaApi CopyFactory Cloud-to-Cloud',
    redisConfigured: IS_REDIS_CONFIGURED,
    modules: {
      authentication: 'ACTIVE',
      accounts: 'ACTIVE',
      copyTrading: 'ACTIVE',
      payments: 'ACTIVE',
      analytics: 'ACTIVE',
      enforcement: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
      scheduling: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG'
    }
  });
});

if (IS_REDIS_CONFIGURED && metaApiWorker) {
  metaApiWorker.on('completed', (job: any) => {
    console.log(`[MetaApi Queue] Task completed. Job ID: ${job.id}`);
  });
  metaApiWorker.on('failed', (job: any, err: any) => {
    console.error(`[MetaApi Queue Failure] Job ID ${job?.id} failed: ${err.message}`);
  });
}

if (IS_REDIS_CONFIGURED && enforcementWorker) {
  enforcementWorker.on('completed', (job: any) => {
    console.log(`[Enforcement Queue] Sweep completed. Job ID: ${job.id}`);
  });
  enforcementWorker.on('failed', (job: any, err: any) => {
    console.error(`[Enforcement Queue Failure] Job ID ${job?.id} failed: ${err.message}`);
  });
}

app.listen(Number(ENV.PORT), '0.0.0.0', async () => {
  console.log(`
=============================================================
  PESAMATRIX CLOUD ENGINE STARTED
  Port: ${ENV.PORT}
  Architecture: MetaApi CopyFactory Cloud-to-Cloud
  Database: PostgreSQL + Prisma ORM
  Queue Engine: ${IS_REDIS_CONFIGURED ? 'Upstash Redis + BullMQ (ACTIVE)' : 'Redis NOT configured (add UPSTASH_REDIS_URL)'}
=============================================================
`);

  if (IS_REDIS_CONFIGURED) {
    try {
      await initializeCronJobs();
      console.log('[Cron] Background cron schedules initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed initializing background cron schedules:', error);
    }
  }
});
