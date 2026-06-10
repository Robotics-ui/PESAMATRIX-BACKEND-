"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const metaapi_queue_1 = require("./queue/metaapi.queue");
const enforcement_worker_1 = require("./queue/enforcement.worker");
const payment_worker_1 = require("./queue/payment.worker");
const analytics_worker_1 = require("./queue/analytics.worker");
const cron_scheduler_1 = require("./queue/cron.scheduler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const account_routes_1 = __importDefault(require("./routes/account.routes"));
const copy_routes_1 = __importDefault(require("./routes/copy.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const seed_1 = require("./utils/seed");
const app = (0, express_1.default)();
const corsOptions = {
    origin: (origin, callback) => {
        const allowed = [
            'https://pesamatrix-signal-fx-f--signalfx.replit.app',
            process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null
        ].filter(Boolean);
        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use('/api/auth', auth_routes_1.default);
app.use('/api/accounts', account_routes_1.default);
app.use('/api/copy', copy_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        service: 'PesaMatrix Cloud Engine',
        version: '2.0.0',
        architecture: 'MetaApi CopyFactory Cloud-to-Cloud',
        redisConfigured: env_1.IS_REDIS_CONFIGURED,
        modules: {
            authentication: 'ACTIVE',
            accounts: 'ACTIVE',
            copyTrading: 'ACTIVE',
            payments: 'ACTIVE',
            analytics: 'ACTIVE',
            admin: 'ACTIVE',
            enforcement: env_1.IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
            paymentWorker: env_1.IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
            analyticsWorker: env_1.IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG',
            scheduling: env_1.IS_REDIS_CONFIGURED ? 'ACTIVE' : 'AWAITING_CONFIG'
        }
    });
});
// Worker event listeners
if (env_1.IS_REDIS_CONFIGURED) {
    if (metaapi_queue_1.metaApiWorker) {
        metaapi_queue_1.metaApiWorker.on('completed', (job) => {
            console.log(`[MetaApi Queue] Job completed. ID: ${job.id}`);
        });
        metaapi_queue_1.metaApiWorker.on('failed', (job, err) => {
            console.error(`[MetaApi Queue] Job ${job?.id} failed: ${err.message}`);
        });
    }
    if (enforcement_worker_1.enforcementWorker) {
        enforcement_worker_1.enforcementWorker.on('completed', (job) => {
            console.log(`[Enforcement Queue] Sweep completed. ID: ${job.id}`);
        });
        enforcement_worker_1.enforcementWorker.on('failed', (job, err) => {
            console.error(`[Enforcement Queue] Job ${job?.id} failed: ${err.message}`);
        });
    }
    if (payment_worker_1.paymentWorker) {
        payment_worker_1.paymentWorker.on('completed', (job) => {
            console.log(`[Payment Worker] Job completed. ID: ${job.id}`);
        });
        payment_worker_1.paymentWorker.on('failed', (job, err) => {
            console.error(`[Payment Worker] Job ${job?.id} failed: ${err.message}`);
        });
    }
    if (analytics_worker_1.analyticsWorker) {
        analytics_worker_1.analyticsWorker.on('completed', (job) => {
            console.log(`[Analytics Worker] Job completed. ID: ${job.id}`);
        });
        analytics_worker_1.analyticsWorker.on('failed', (job, err) => {
            console.error(`[Analytics Worker] Job ${job?.id} failed: ${err.message}`);
        });
    }
}
app.listen(Number(env_1.ENV.PORT), '0.0.0.0', async () => {
    console.log(`
=============================================================
  PESAMATRIX CLOUD ENGINE v2.0
  Port: ${env_1.ENV.PORT}
  Architecture: MetaApi CopyFactory Cloud-to-Cloud
  Database: PostgreSQL + Prisma ORM
  Queue Engine: ${env_1.IS_REDIS_CONFIGURED ? 'Upstash Redis + BullMQ (ACTIVE)' : 'Redis NOT configured'}
  Workers: MetaApi | Enforcement | Payment | Analytics
=============================================================
`);
    // Seed admin user and default settings on every startup (idempotent)
    await (0, seed_1.seedAdminUser)();
    if (env_1.IS_REDIS_CONFIGURED) {
        try {
            await (0, cron_scheduler_1.initializeCronJobs)();
            console.log('[Cron] Background cron schedules initialized.');
        }
        catch (error) {
            console.error('[Cron] Failed initializing cron schedules:', error);
        }
    }
});
