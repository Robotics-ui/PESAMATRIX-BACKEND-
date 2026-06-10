import dotenv from 'dotenv';

// On Replit, all secrets are injected directly into process.env before startup.
// Only load .env file in local (non-Replit) environments to avoid overriding
// Replit's real DATABASE_URL and other secrets with stale local values.
if (!process.env.REPL_ID) {
  dotenv.config();
}

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL!,
  UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL!,
  METAAPI_TOKEN: process.env.METAAPI_TOKEN!,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-fallback-secret-change-in-production',
  MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL || `https://${process.env.REPLIT_DEV_DOMAIN}/api/payments/mpesa-callback`,
  MPESA: {
    CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY!,
    CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET!,
    SHORTCODE: process.env.MPESA_SHORTCODE!,
    PASSKEY: process.env.MPESA_PASSKEY!,
  }
};

const placeholders = ['your_endpoint.upstash.io', 'your_metaapi', 'your_ultra', 'your_daraja', 'your_token'];
const isPlaceholder = (val?: string) => !val || placeholders.some(p => val.includes(p));

if (isPlaceholder(ENV.UPSTASH_REDIS_URL)) {
  console.warn('[Config] UPSTASH_REDIS_URL not configured — queue workers will be disabled.');
}
if (isPlaceholder(ENV.METAAPI_TOKEN)) {
  console.warn('[Config] METAAPI_TOKEN not configured — MetaApi features will be disabled.');
}
if (isPlaceholder(ENV.JWT_SECRET)) {
  console.warn('[Config] JWT_SECRET not configured — authentication will not work.');
}
if (!ENV.MPESA.CONSUMER_KEY) {
  console.warn('[Config] MPESA credentials not configured — payments will be disabled.');
}

export const IS_REDIS_CONFIGURED = !isPlaceholder(ENV.UPSTASH_REDIS_URL);
export const IS_METAAPI_CONFIGURED = !isPlaceholder(ENV.METAAPI_TOKEN);
export const IS_MPESA_CONFIGURED = !!(ENV.MPESA.CONSUMER_KEY && ENV.MPESA.CONSUMER_SECRET && ENV.MPESA.SHORTCODE && ENV.MPESA.PASSKEY);
