"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IS_MPESA_CONFIGURED = exports.IS_METAAPI_CONFIGURED = exports.IS_REDIS_CONFIGURED = exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    PORT: process.env.PORT || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
    METAAPI_TOKEN: process.env.METAAPI_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL || `https://${process.env.REPLIT_DEV_DOMAIN}/api/payments/mpesa-callback`,
    MPESA: {
        CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
        CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
        SHORTCODE: process.env.MPESA_SHORTCODE,
        PASSKEY: process.env.MPESA_PASSKEY,
    }
};
const placeholders = ['your_endpoint.upstash.io', 'your_metaapi', 'your_ultra', 'your_daraja', 'your_token'];
const isPlaceholder = (val) => !val || placeholders.some(p => val.includes(p));
if (isPlaceholder(exports.ENV.UPSTASH_REDIS_URL)) {
    console.warn('[Config] UPSTASH_REDIS_URL not configured — queue workers will be disabled.');
}
if (isPlaceholder(exports.ENV.METAAPI_TOKEN)) {
    console.warn('[Config] METAAPI_TOKEN not configured — MetaApi features will be disabled.');
}
if (isPlaceholder(exports.ENV.JWT_SECRET)) {
    console.warn('[Config] JWT_SECRET not configured — authentication will not work.');
}
if (!exports.ENV.MPESA.CONSUMER_KEY) {
    console.warn('[Config] MPESA credentials not configured — payments will be disabled.');
}
exports.IS_REDIS_CONFIGURED = !isPlaceholder(exports.ENV.UPSTASH_REDIS_URL);
exports.IS_METAAPI_CONFIGURED = !isPlaceholder(exports.ENV.METAAPI_TOKEN);
exports.IS_MPESA_CONFIGURED = !!(exports.ENV.MPESA.CONSUMER_KEY && exports.ENV.MPESA.CONSUMER_SECRET && exports.ENV.MPESA.SHORTCODE && exports.ENV.MPESA.PASSKEY);
