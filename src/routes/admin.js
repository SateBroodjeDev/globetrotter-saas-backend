const express = require('express');
const { Op } = require('sequelize');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateAdmin } = require('../middleware/adminAuth');
const { db } = require('../config/database');
const analyticsService = require('../services/analyticsService');
const emailService = require('../services/emailService');
const logger = require('../services/loggerService');

const router = express.Router();

// All admin routes require platform admin auth
router.use(authenticateAdmin);

// ── Platform stats ────────────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await analyticsService.getPlatformStats();
  res.json({ stats });
}));

// ── User growth chart ─────────────────────────────────────────────────────────
router.get('/analytics/user-growth', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const data = await analyticsService.getUserGrowth(days);
  res.json({ data });
}));

// ── Subscription breakdown ───────────────────────────────────────────────────
router.get('/analytics/subscriptions', asyncHandler(async (req, res) => {
  const data = await analyticsService.getSubscriptionBreakdown();
  res.json({ data });
}));

// ── System health ─────────────────────────────────────────────────────────────
router.get('/health', asyncHandler(async (req, res) => {
  const health = await analyticsService.getSystemHealth();
  res.json(health);
}));

// ── User management ───────────────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';

  const where = { isDeleted: false };
  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const { count, rows: users } = await db.User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] },
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']]
  });

  res.json({ users, total: count, page, pages: Math.ceil(count / limit) });
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id, {
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] },
    include: [{ association: 'workspaces' }]
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
}));

router.patch('/users/:id/ban', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await user.update({ isActive: false });
  logger.info('[Admin] User banned', { adminId: req.adminUser.id, targetUserId: user.id });
  res.json({ message: 'User banned', userId: user.id });
}));

router.patch('/users/:id/unban', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await user.update({ isActive: true });
  logger.info('[Admin] User unbanned', { adminId: req.adminUser.id, targetUserId: user.id });
  res.json({ message: 'User unbanned', userId: user.id });
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');

  // Store token in Redis for 1h
  const { redisClient } = require('../config/redis');
  await redisClient.setEx(`pwd_reset:${token}`, 3600, user.id);

  await emailService.sendPasswordResetEmail(user.email, token);
  logger.info('[Admin] Password reset sent', { adminId: req.adminUser.id, targetUserId: user.id });
  res.json({ message: 'Password reset email sent' });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await user.update({ isDeleted: true, deletedAt: new Date() });
  logger.info('[Admin] User deleted', { adminId: req.adminUser.id, targetUserId: user.id });
  res.json({ message: 'User deleted' });
}));

// ── Workspace management ──────────────────────────────────────────────────────
router.get('/workspaces', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const { count, rows: workspaces } = await db.Workspace.findAndCountAll({
    where: { isDeleted: false },
    include: [{ association: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] }],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']]
  });

  res.json({ workspaces, total: count, page, pages: Math.ceil(count / limit) });
}));

// ── Audit logs ────────────────────────────────────────────────────────────────
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const { count, rows: logs } = await db.AuditLog.findAndCountAll({
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']]
  });

  res.json({ logs, total: count, page, pages: Math.ceil(count / limit) });
}));

module.exports = router;
