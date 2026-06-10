"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueConnectionOptions = void 0;
const env_1 = require("../config/env");
exports.queueConnectionOptions = {
    connection: {
        url: env_1.ENV.UPSTASH_REDIS_URL,
        tls: {},
        keepAlive: 30000,
    }
};
