const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateAuth } = require('../middleware/validation');
const authService = require('../services/authService');
const { generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Register
router.post('/register', authLimiter, validateAuth.register, asyncHandler(async (req, res) => {
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
router.post('/login', authLimiter, validateAuth.login, asyncHandler(async (req, res) => {
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

module.exports = router;
