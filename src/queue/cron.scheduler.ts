import { Queue } from 'bullmq';
import { queueConnectionOptions } from './connection';

export const cronQueue = new Queue('CronSchedulerTasks', queueConnectionOptions);

export const initializeCronJobs = async () => {
  // Remove preexisting instances of this cron pattern to avoid duplication on server restarts
  const activeRepeatableJobs = await cronQueue.getRepeatableJobs();
  for (const job of activeRepeatableJobs) {
    await cronQueue.removeRepeatableByKey(job.key);
  }

  // Add the recurring sweep event using standard crontab execution patterns
  // '0 * * * *' = Triggers the process cleanly once every single hour
  await cronQueue.add(
    'SWEEP_EXPIRED_SUBSCRIPTIONS',
    {},
    {
      repeat: {
        pattern: '0 * * * *'
      }
    }
  );

  console.log('⏰ [Cron Engine] Repeatable hourly expiration sweep registered in Redis grid.');
};
