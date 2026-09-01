const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { db, sequelize } = require('../config/database');

const router = express.Router();

// Middleware: only allow admin/superadmin users
const requireAdmin = async (req, res, next) => {
  const user = await db.User.findByPk(req.user.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/users - paginated list of all users
router.get('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: users } = await db.User.findAndCountAll({
    attributes: { exclude: ['passwordHash', 'twoFactorSecret'] },
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ users, total: count, page, pages: Math.ceil(count / limit) });
}));

// POST /api/admin/users - create user
router.post('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body;
  const existing = await db.User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  // passwordHash is hashed by User model's beforeCreate hook
  const user = await db.User.create({
    email, passwordHash: password, firstName, lastName,
    role: role || 'user', emailVerified: true
  });

  res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email } });
}));

// PATCH /api/admin/users/:id - update user
router.patch('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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

// DELETE /api/admin/users/:id - delete user
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ isDeleted: true, isActive: false });
  res.json({ message: 'User deleted' });
}));

// POST /api/admin/users/:id/reset-password - force reset password
router.post('/users/:id/reset-password', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const crypto = require('crypto');
  const tempPassword = crypto.randomBytes(8).toString('hex');
  // User model's beforeUpdate hook hashes passwordHash automatically
  await user.update({ passwordHash: tempPassword });

  res.json({ message: 'Password reset', tempPassword });
}));

// PATCH /api/admin/users/:id/ban - ban or unban user
router.patch('/users/:id/ban', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await db.User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const banned = req.body.banned !== false;
  await user.update({ isActive: !banned });

  res.json({ message: banned ? 'User banned' : 'User unbanned', user });
}));

// GET /api/admin/workspaces - list all workspaces
router.get('/workspaces', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: workspaces } = await db.Workspace.findAndCountAll({
    include: { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ workspaces, total: count, page, pages: Math.ceil(count / limit) });
}));

// GET /api/admin/analytics - dashboard metrics
router.get('/analytics', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [totalUsers, totalWorkspaces, totalTrips, totalExpenses] = await Promise.all([
    db.User.count({ where: { isDeleted: false } }),
    db.Workspace.count({ where: { isDeleted: false } }),
    db.Trip.count({ where: { isDeleted: false } }),
    db.Expense.count({ where: { isDeleted: false } })
  ]);

  const activeUsers = await db.User.count({
    where: { isActive: true, isDeleted: false }
  });

  res.json({
    totalUsers,
    activeUsers,
    totalWorkspaces,
    totalTrips,
    totalExpenses,
    timestamp: new Date().toISOString()
  });
}));

// GET /api/admin/health - system status
router.get('/health', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await sequelize.authenticate();
  } catch {
    dbStatus = 'error';
  }

  try {
    const { redisClient } = require('../config/redis');
    await redisClient.ping();
  } catch {
    redisStatus = 'error';
  }

  res.json({
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 'healthy' : 'degraded',
    database: dbStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
}));

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const { count, rows: logs } = await db.AuditLog.findAndCountAll({
    include: { model: db.User, as: 'user', attributes: ['id', 'email'] },
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({ logs, total: count, page, pages: Math.ceil(count / limit) });
}));

module.exports = router;
