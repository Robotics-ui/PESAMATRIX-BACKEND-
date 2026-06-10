import { ENV } from '../config/env';

export const queueConnectionOptions = {
  connection: {
    url: ENV.UPSTASH_REDIS_URL,
    tls: {},
    keepAlive: 30000,
  }
};
