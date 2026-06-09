import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL!,
  METAAPI_TOKEN: process.env.METAAPI_TOKEN!,
  JWT_SECRET: process.env.JWT_SECRET!,
  MPESA: {
    CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY!,
    CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET!,
    SHORTCODE: process.env.MPESA_SHORTCODE!,
    PASSKEY: process.env.MPESA_PASSKEY!,
  }
};

// Validate that crucial strings are loaded
if (!ENV.DATABASE_URL || !ENV.UPSTASH_REDIS_URL || !ENV.METAAPI_TOKEN) {
  throw new Error('Missing critical environment configuration keys.');
}
