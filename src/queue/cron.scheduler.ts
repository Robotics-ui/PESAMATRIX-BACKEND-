import { Queue } from 'bullmq';
import { queueConnectionOptions } from './connection';
import { IS_REDIS_CONFIGURED } from '../config/env';

const cronQueue = IS_REDIS_CONFIGURED ? new Queue('CronSchedulerTasks', queueConnectionOptions) : null;

export const initializeCronJobs = async () => {
  if (!IS_REDIS_CONFIGURED || !cronQueue) {
    console.warn('[Cron Engine] Redis not configured — skipping cron job setup.');
    return;
  }

  const activeRepeatableJobs = await cronQueue.getRepeatableJobs();
  for (const job of activeRepeatableJobs) {
    await cronQueue.removeRepeatableByKey(job.key);
  }

  await cronQueue.add(
    'SWEEP_EXPIRED_SUBSCRIPTIONS',
    {},
    { repeat: { pattern: '0 * * * *' } }
  );

  console.log('[Cron Engine] Repeatable hourly expiration sweep registered.');
};
