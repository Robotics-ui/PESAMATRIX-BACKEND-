"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.changePassword = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma = new client_1.PrismaClient();
const hashPassword = (password) => crypto_1.default.createHash('sha256').update(password).digest('hex');
const register = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: 'Email already registered.' });
            return;
        }
        const user = await prisma.user.create({
            data: { email, passwordHash: hashPassword(password) }
        });
        res.status(201).json({ message: 'User registered successfully', userId: user.id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.passwordHash !== hashPassword(password)) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                active: user.subscriptionStatus,
                isAdmin: user.isAdmin,
                forcePasswordChange: user.forcePasswordChange
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.login = login;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current password and new password are required.' });
            return;
        }
        if (newPassword.length < 8) {
            res.status(400).json({ error: 'New password must be at least 8 characters.' });
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || user.passwordHash !== hashPassword(currentPassword)) {
            res.status(401).json({ error: 'Current password is incorrect.' });
            return;
        }
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashPassword(newPassword),
                forcePasswordChange: false
            }
        });
        res.status(200).json({ message: 'Password updated successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.changePassword = changePassword;
const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                isAdmin: true,
                forcePasswordChange: true,
                subscriptionStatus: true,
                subscriptionExpiry: true,
                createdAt: true
            }
        });
        if (!user) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProfile = getProfile;
