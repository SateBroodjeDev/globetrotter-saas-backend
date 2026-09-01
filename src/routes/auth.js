const express = require('express');
const crypto = require('crypto');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateAuth } = require('../middleware/validation');
const authService = require('../services/authService');
const { generateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// Register
router.post('/register', validateAuth.register, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  const result = await authService.register(email, password, firstName, lastName);
  
  res.status(201).json({
    message: 'Registration successful',
    user: result.user,
    workspace: result.workspace,
    accessToken: generateToken(result.user.id, result.workspace.id)
  });
}));

// Login
router.post('/login', validateAuth.login, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  authService.clientIp = req.ip;
  const result = await authService.login(email, password);
  
  res.json({
    message: 'Login successful',
    ...result
  });
}));

// Verify Email
router.post('/verify-email/:token', asyncHandler(async (req, res) => {
  const result = await authService.validateEmail(req.params.token);
  res.json(result);
}));

// Logout (blacklist token)
router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.substring(7);
  if (token) {
    const { redisClient } = require('../config/redis');
    await redisClient.setEx(`blacklist:${token}`, 604800, '1'); // 7 days
  }
  res.json({ message: 'Logged out successfully' });
}));

// Forgot password – request reset email
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { db } = require('../config/database');
  const user = await db.User.findOne({ where: { email, isDeleted: false } });

  // Always respond 200 to avoid user enumeration
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const { redisClient } = require('../config/redis');
    await redisClient.setEx(`pwd_reset:${token}`, 3600, user.id);
    await emailService.sendPasswordResetEmail(email, token);
  }

  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
}));

// Reset password with token
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const { redisClient } = require('../config/redis');
  const userId = await redisClient.get(`pwd_reset:${token}`);
  if (!userId) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const { db } = require('../config/database');
  const user = await db.User.findByPk(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await user.update({ passwordHash: password });
  await redisClient.del(`pwd_reset:${token}`);

  res.json({ message: 'Password reset successful' });
}));

module.exports = router;
