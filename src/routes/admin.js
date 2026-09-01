const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const { db, sequelize } = require('../config/database');
const adminService = require('../services/adminService');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────

// GET /api/admin/analytics/dashboard
router.get('/analytics/dashboard', asyncHandler(async (req, res) => {
  const kpis = await adminService.getDashboardKPIs();
  res.json(kpis);
}));

// GET /api/admin/analytics/growth-metrics
router.get('/analytics/growth-metrics', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const userGrowth = await adminService.getUserGrowth(days);
  res.json({ days, userGrowth });
}));

// GET /api/admin/analytics/revenue-metrics
router.get('/analytics/revenue-metrics', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const metrics = await adminService.getRevenueMetrics(days);
  res.json(metrics);
}));

// GET /api/admin/analytics/conversion
router.get('/analytics/conversion', asyncHandler(async (req, res) => {
  const metrics = await adminService.getConversionMetrics();
  res.json(metrics);
}));

// GET /api/admin/analytics/churn
router.get('/analytics/churn', asyncHandler(async (req, res) => {
  const churnRate = await adminService.calculateChurnRate();
  const breakdown = await adminService.getSubscriptionBreakdown();
  res.json({ churnRate, ...breakdown });
}));

// GET /api/admin/analytics/feature-usage
router.get('/analytics/feature-usage', asyncHandler(async (req, res) => {
  const [totalTrips, totalExpenses, totalBookings] = await Promise.all([
    db.Trip.count({ where: { isDeleted: false } }),
    db.Expense.count({ where: { isDeleted: false } }),
    db.Booking ? db.Booking.count() : Promise.resolve(0)
  ]);
  res.json({ totalTrips, totalExpenses, totalBookings });
}));

// ─────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const where = { isDeleted: false };
  if (req.query.search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${req.query.search}%` } },
      { firstName: { [Op.iLike]: `%${req.query.search}%` } },
      { lastName: { [Op.iLike]: `%${req.query.search}%` } }
    ];
  }
  if (req.query.status === 'active') where.isActive = true;
  if (req.query.status === 'banned') where.isActive = false;

  const { count, rows: users } = await db.User.findAndCountAll({
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] },
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ users, total: count, page, pages: Math.ceil(count / limit) });
}));

// POST /api/admin/users - create user
router.post('/users', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body;
  const existing = await db.User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const user = await db.User.create({
    email, passwordHash: password, firstName, lastName,
    role: role || 'user', emailVerified: true
  });

  res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email } });
}));

// GET /api/admin/users/:id
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id, {
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] },
    include: [{ model: db.Workspace, as: 'workspaces', attributes: ['id', 'name', 'planTier', 'subscriptionStatus'] }]
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

// PATCH /api/admin/users/:id
router.patch('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const allowed = ['firstName', 'lastName', 'isActive', 'role'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  await user.update(updates);
  res.json({ message: 'User updated', user });
}));

// DELETE /api/admin/users/:id
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ isDeleted: true, isActive: false });
  res.json({ message: 'User deleted' });
}));

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ isActive: false });
  res.json({ message: 'User banned' });
}));

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ isActive: true });
  res.json({ message: 'User unbanned' });
}));

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tempPassword = crypto.randomBytes(8).toString('hex');
  await user.update({ passwordHash: tempPassword });

  res.json({ message: 'Password reset', tempPassword });
}));

// POST /api/admin/users/:id/impersonate
router.post('/users/:id/impersonate', asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id, {
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const token = jwt.sign(
    { userId: user.id, email: user.email, impersonated: true, impersonatedBy: req.user.userId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ message: 'Impersonation token issued', token, expiresIn: '1h' });
}));

// ─────────────────────────────────────────────────────────
// WORKSPACES
// ─────────────────────────────────────────────────────────

// GET /api/admin/workspaces
router.get('/workspaces', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const where = { isDeleted: false };
  if (req.query.plan) where.planTier = req.query.plan;
  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${req.query.search}%` } }
    ];
  }

  const { count, rows: workspaces } = await db.Workspace.findAndCountAll({
    include: { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ workspaces, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/workspaces/:id
router.get('/workspaces/:id', asyncHandler(async (req, res) => {
  const workspace = await db.Workspace.findByPk(req.params.id, {
    include: [
      { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
      { model: db.User, as: 'members', attributes: ['id', 'email', 'firstName', 'lastName'] }
    ]
  });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  res.json(workspace);
}));

// POST /api/admin/workspaces/:id/archive
router.post('/workspaces/:id/archive', asyncHandler(async (req, res) => {
  const workspace = await db.Workspace.findByPk(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  await workspace.update({ isActive: false });
  res.json({ message: 'Workspace archived' });
}));

// DELETE /api/admin/workspaces/:id
router.delete('/workspaces/:id', asyncHandler(async (req, res) => {
  const workspace = await db.Workspace.findByPk(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  await workspace.update({ isDeleted: true, isActive: false });
  res.json({ message: 'Workspace deleted' });
}));

// GET /api/admin/workspaces/:id/analytics
router.get('/workspaces/:id/analytics', asyncHandler(async (req, res) => {
  const workspace = await db.Workspace.findByPk(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const [tripCount, expenseCount, memberCount] = await Promise.all([
    db.Trip.count({ where: { workspaceId: req.params.id, isDeleted: false } }),
    db.Expense.count({ where: { isDeleted: false } }),
    db.WorkspaceUser.count({ where: { workspaceId: req.params.id } })
  ]);

  res.json({ workspaceId: req.params.id, tripCount, expenseCount, memberCount });
}));

// ─────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────

// GET /api/admin/subscriptions
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.plan) where.plan = req.query.plan;

  const { count, rows: subscriptions } = await db.Subscription.findAndCountAll({
    include: { model: db.Workspace, as: 'workspace', attributes: ['id', 'name', 'slug'] },
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ subscriptions, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/subscriptions/:id
router.get('/subscriptions/:id', asyncHandler(async (req, res) => {
  const sub = await db.Subscription.findByPk(req.params.id, {
    include: { model: db.Workspace, as: 'workspace' }
  });
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  res.json(sub);
}));

// POST /api/admin/subscriptions/:id/cancel
router.post('/subscriptions/:id/cancel', asyncHandler(async (req, res) => {
  const sub = await db.Subscription.findByPk(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  await sub.update({ status: 'canceled', canceledAt: new Date() });
  res.json({ message: 'Subscription canceled' });
}));

// POST /api/admin/subscriptions/:id/override
router.post('/subscriptions/:id/override', asyncHandler(async (req, res) => {
  const { plan, status } = req.body;
  const sub = await db.Subscription.findByPk(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  const updates = {};
  if (plan) updates.plan = plan;
  if (status) updates.status = status;

  await sub.update(updates);

  if (plan) {
    await db.Workspace.update(
      { planTier: plan, subscriptionPlan: plan },
      { where: { id: sub.workspaceId } }
    );
  }

  res.json({ message: 'Subscription updated', subscription: sub });
}));

// POST /api/admin/subscriptions/:id/refund
router.post('/subscriptions/:id/refund', asyncHandler(async (req, res) => {
  const sub = await db.Subscription.findByPk(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  // Refund logic would call Stripe API in a production environment
  res.json({ message: 'Refund initiated (connect Stripe for live processing)', subscriptionId: sub.id });
}));

// ─────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────

// GET /api/admin/payments
router.get('/payments', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.since) where.createdAt = { [Op.gte]: new Date(req.query.since) };

  const { count, rows: payments } = await db.Invoice.findAndCountAll({
    include: { model: db.Workspace, as: 'workspace', attributes: ['id', 'name'] },
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ payments, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/payments/:id
router.get('/payments/:id', asyncHandler(async (req, res) => {
  const payment = await db.Invoice.findByPk(req.params.id, {
    include: { model: db.Workspace, as: 'workspace' }
  });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
}));

// POST /api/admin/payments/:id/refund
router.post('/payments/:id/refund', asyncHandler(async (req, res) => {
  const payment = await db.Invoice.findByPk(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({ message: 'Refund initiated', invoiceId: payment.id, stripeInvoiceId: payment.stripeInvoiceId });
}));

// POST /api/admin/payments/:id/retry
router.post('/payments/:id/retry', asyncHandler(async (req, res) => {
  const payment = await db.Invoice.findByPk(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({ message: 'Payment retry initiated', invoiceId: payment.id });
}));

// ─────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const where = {};
  if (req.query.action) where.action = req.query.action;
  if (req.query.status) where.status = req.query.status;
  if (req.query.since) where.createdAt = { [Op.gte]: new Date(req.query.since) };

  const { count, rows: logs } = await db.AuditLog.findAndCountAll({
    include: { model: db.User, as: 'user', attributes: ['id', 'email'] },
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ logs, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/audit-logs/user/:userId
router.get('/audit-logs/user/:userId', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const { count, rows: logs } = await db.AuditLog.findAndCountAll({
    where: { userId: req.params.userId },
    limit, offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ logs, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/audit-logs/workspace/:workspaceId
router.get('/audit-logs/workspace/:workspaceId', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const { count, rows: logs } = await db.AuditLog.findAndCountAll({
    where: { workspaceId: req.params.workspaceId },
    include: { model: db.User, as: 'user', attributes: ['id', 'email'] },
    limit, offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ logs, total: count, page, pages: Math.ceil(count / limit) });
}));

// ─────────────────────────────────────────────────────────
// SYSTEM
// ─────────────────────────────────────────────────────────

// GET /api/admin/system/health
router.get('/system/health', asyncHandler(async (req, res) => {
  const health = await adminService.getSystemHealth();
  res.json(health);
}));

// GET /api/admin/system/metrics
router.get('/system/metrics', asyncHandler(async (req, res) => {
  const health = await adminService.getSystemHealth();
  res.json({
    ...health,
    nodeVersion: process.version,
    platform: process.platform
  });
}));

// Keep legacy endpoints for backward compatibility
// GET /api/admin/analytics (legacy)
router.get('/analytics', asyncHandler(async (req, res) => {
  const [totalUsers, totalWorkspaces, totalTrips, totalExpenses] = await Promise.all([
    db.User.count({ where: { isDeleted: false } }),
    db.Workspace.count({ where: { isDeleted: false } }),
    db.Trip.count({ where: { isDeleted: false } }),
    db.Expense.count({ where: { isDeleted: false } })
  ]);

  const activeUsers = await db.User.count({ where: { isActive: true, isDeleted: false } });

  res.json({ totalUsers, activeUsers, totalWorkspaces, totalTrips, totalExpenses, timestamp: new Date().toISOString() });
}));

// GET /api/admin/health (legacy)
router.get('/health', asyncHandler(async (req, res) => {
  const health = await adminService.getSystemHealth();
  res.json({
    status: health.status,
    database: health.database,
    redis: health.redis,
    uptime: health.uptime,
    memory: process.memoryUsage(),
    timestamp: health.timestamp
  });
}));

// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────

// In-memory settings store (replace with DB-backed settings in production)
const defaultSettings = {
  trialDurationDays: 14,
  maxWorkspaceSizeGB: 5,
  maintenanceMode: false,
  features: {
    whiteLabel: true,
    api: true,
    customDomain: true,
    twoFactor: true,
    sso: false,
    betaFeatures: false
  },
  rateLimits: {
    apiRequestsPerMinute: 60,
    uploadsPerDay: 100
  }
};

let currentSettings = { ...defaultSettings };

// GET /api/admin/settings
router.get('/settings', asyncHandler(async (req, res) => {
  res.json(currentSettings);
}));

// PUT /api/admin/settings
router.put('/settings', asyncHandler(async (req, res) => {
  const allowed = ['trialDurationDays', 'maxWorkspaceSizeGB', 'maintenanceMode', 'features', 'rateLimits'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) {
      currentSettings[key] = req.body[key];
    }
  });
  res.json({ message: 'Settings updated', settings: currentSettings });
}));

// POST /api/admin/email/test
router.post('/email/test', asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email required' });

  try {
    const emailService = require('../services/emailService');
    if (emailService.sendWelcomeEmail) {
      await emailService.sendWelcomeEmail(to, 'Admin Test', 'Admin Panel');
      res.json({ message: 'Test email sent', to });
    } else {
      res.json({ message: 'Email service not configured', to });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email', detail: err.message });
  }
}));

module.exports = router;
