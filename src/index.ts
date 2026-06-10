import express from 'express';
import cors from 'cors';
import path from 'path';
import { ENV, IS_REDIS_CONFIGURED } from './config/env';

import { metaApiWorker } from './queue/metaapi.queue';
import { enforcementWorker } from './queue/enforcement.worker';
import { paymentWorker } from './queue/payment.worker';
import { analyticsWorker } from './queue/analytics.worker';
import { initializeCronJobs } from './queue/cron.scheduler';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import copyRoutes from './routes/copy.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';

import { seedAdminUser } from './utils/seed';

const app = express();

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      'https://pesamatrix-signal-fx-f--signalfx.replit.app',
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null
    ].filter(Boolean);
    if (!origin || allowed.includes(origin as string)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/copy', copyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'PesaMatrix Cloud Engine',
    version: '2.0.0',
    architecture: 'MetaApi CopyFactory Cloud-to-Cloud',
    redisConfigured: IS_REDIS_CONFIGURED,
    modules: {
      authentication: 'ACTIVE',
      accounts: 'ACTIVE',
      copyTrading: 'ACTIVE',
      payments: 'ACTIVE',
      analytics: 'ACTIVE',
      admin: 'ACTIVE',
      enforcement: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
      paymentWorker: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
      analyticsWorker: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
      scheduling: IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG'
    }
  });
});

// Worker event listeners
if (IS_REDIS_CONFIGURED) {
  if (metaApiWorker) {
    metaApiWorker.on('completed', (job: any) => {
      console.log(`[MetaApi Queue] Job completed. ID: ${job.id}`);
    });
    metaApiWorker.on('failed', (job: any, err: any) => {
      console.error(`[MetaApi Queue] Job ${job?.id} failed: ${err.message}`);
    });
  }

  if (enforcementWorker) {
    enforcementWorker.on('completed', (job: any) => {
      console.log(`[Enforcement Queue] Sweep completed. ID: ${job.id}`);
    });
    enforcementWorker.on('failed', (job: any, err: any) => {
      console.error(`[Enforcement Queue] Job ${job?.id} failed: ${err.message}`);
    });
  }

  if (paymentWorker) {
    paymentWorker.on('completed', (job: any) => {
      console.log(`[Payment Worker] Job completed. ID: ${job.id}`);
    });
    paymentWorker.on('failed', (job: any, err: any) => {
      console.error(`[Payment Worker] Job ${job?.id} failed: ${err.message}`);
    });
  }

  if (analyticsWorker) {
    analyticsWorker.on('completed', (job: any) => {
      console.log(`[Analytics Worker] Job completed. ID: ${job.id}`);
    });
    analyticsWorker.on('failed', (job: any, err: any) => {
      console.error(`[Analytics Worker] Job ${job?.id} failed: ${err.message}`);
    });
  }
}

app.listen(Number(ENV.PORT), '0.0.0.0', async () => {
  console.log(`
=============================================================
  PESAMATRIX CLOUD ENGINE v2.0
  Port: ${ENV.PORT}
  Architecture: MetaApi CopyFactory Cloud-to-Cloud
  Database: PostgreSQL + Prisma ORM
  Queue Engine: ${IS_REDIS_CONFIGURED ? 'Upstash Redis + BullMQ (ACTIVE)' : 'Redis NOT configured'}
  Workers: MetaApi | Enforcement | Payment | Analytics
=============================================================
`);

  // Seed admin user and default settings on every startup (idempotent)
  await seedAdminUser();

  if (IS_REDIS_CONFIGURED) {
    try {
      await initializeCronJobs();
      console.log('[Cron] Background cron schedules initialized.');
    } catch (error) {
      console.error('[Cron] Failed initializing cron schedules:', error);
    }
  }
});
