import Queue from 'bullmq';
import { ENV } from '../config/env';

// Upstash requires explicit configuration via IORedis connection options
export const queueConnectionOptions = {
  connection: {
    url: ENV.UPSTASH_REDIS_URL,
    // Upstash needs these parameters optimized to sustain long-lived serverless/cloud connections safely
    tls: {}, 
    keepAlive: 30000,
  }
};
