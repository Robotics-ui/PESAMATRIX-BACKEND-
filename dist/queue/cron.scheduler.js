"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCronJobs = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const env_1 = require("../config/env");
const cronQueue = env_1.IS_REDIS_CONFIGURED ? new bullmq_1.Queue('CronSchedulerTasks', connection_1.queueConnectionOptions) : null;
const initializeCronJobs = async () => {
    if (!env_1.IS_REDIS_CONFIGURED || !cronQueue) {
        console.warn('[Cron Engine] Redis not configured — skipping cron job setup.');
        return;
    }
    const activeRepeatableJobs = await cronQueue.getRepeatableJobs();
    for (const job of activeRepeatableJobs) {
        await cronQueue.removeRepeatableByKey(job.key);
    }
    await cronQueue.add('SWEEP_EXPIRED_SUBSCRIPTIONS', {}, { repeat: { pattern: '0 * * * *' } });
    console.log('[Cron Engine] Repeatable hourly expiration sweep registered.');
};
exports.initializeCronJobs = initializeCronJobs;
