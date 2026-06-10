"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/dashboard-stats', auth_middleware_1.authenticateJWT, analytics_controller_1.getDashboardStats);
router.get('/subscription-stats', auth_middleware_1.authenticateJWT, analytics_controller_1.getSubscriptionStats);
exports.default = router;
