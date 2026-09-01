const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');
const emailService = require('../services/emailService');

const router = express.Router();

// GET /api/email/preferences — get current user email preferences
router.get('/preferences', authenticate, asyncHandler(async (req, res) => {
  const preferences = await db.EmailPreference.findOne({
    where: { userId: req.user.userId }
  });
  res.json(preferences || { userId: req.user.userId });
}));

// PUT /api/email/preferences — update current user email preferences
router.put('/preferences', authenticate, asyncHandler(async (req, res) => {
  const allowed = [
    'welcomeEmail', 'settlementReminders', 'expenseNotifications',
    'tripSharedNotifications', 'paymentReceipts', 'productUpdates', 'marketingEmails'
  ];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      data[key] = req.body[key];
    }
  }

  const [preferences, created] = await db.EmailPreference.findOrCreate({
    where: { userId: req.user.userId },
    defaults: { userId: req.user.userId, ...data }
  });

  if (!created) {
    await preferences.update(data);
  }

  res.json(preferences);
}));

// GET /api/email/unsubscribe/:token — unsubscribe via token (no auth needed)
router.get('/unsubscribe/:token', asyncHandler(async (req, res) => {
  const preference = await db.EmailPreference.findOne({
    where: { unsubscribeToken: req.params.token }
  });

  if (preference) {
    await preference.update({
      unsubscribedAt: new Date(),
      settlementReminders: 'off',
      expenseNotifications: 'off',
      productUpdates: false,
      marketingEmails: false
    });
  }

  res.send('You have been unsubscribed from Globetrotter emails. <a href="' +
    (process.env.FRONTEND_URL || 'https://app.globetrotter.io') + '">Return to app</a>');
}));

// GET /api/email/logs — admin: view email logs for a given address
router.get('/logs', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.email) where.to = req.query.email;
  if (req.query.status) where.status = req.query.status;
  if (req.query.templateId) where.templateId = req.query.templateId;

  const logs = await db.EmailLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(req.query.limit) || 50
  });
  res.json(logs);
}));

// POST /api/email/send-test — admin: send test email
router.post('/send-test', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { email, template } = req.body;
  if (!email) {
    return res.status(400).json({ error: { message: 'email is required', code: 'VALIDATION_ERROR' } });
  }

  await emailService.sendWelcomeEmail(email, 'Test User', 'Test Workspace');
  res.json({ success: true, message: `Test email sent to ${email}` });
}));

module.exports = router;
