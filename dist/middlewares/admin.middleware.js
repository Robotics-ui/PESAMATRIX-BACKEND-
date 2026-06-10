"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const requireAdmin = (req, res, next) => {
    if (!req.user?.isAdmin) {
        res.status(403).json({ error: 'Admin access required.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
