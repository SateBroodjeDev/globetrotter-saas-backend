const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateAuth } = require('../middleware/validation');
const authService = require('../services/authService');
const { authLimiter, strictLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Register
router.post('/register', authLimiter, validateAuth.register, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  const result = await authService.register(email, password, firstName, lastName, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(201).json(result);
}));

// Login
router.post('/login', authLimiter, validateAuth.login, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.json(result);
}));

// Refresh access token
router.post('/refresh', authLimiter, validateAuth.refresh, asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const result = await authService.refreshAccessToken(refreshToken, req.body.workspaceId);
  res.json(result);
}));

// Logout
router.post('/logout', strictLimiter, validateAuth.logout, asyncHandler(async (req, res) => {
  const result = await authService.logout(req.body.refreshToken);
  res.json(result);
}));

router.post('/forgot-password', strictLimiter, validateAuth.forgotPassword, asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json(result);
}));

router.put('/reset-password', strictLimiter, validateAuth.resetPassword, asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.newPassword, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  res.json(result);
}));

// Verify Email
router.post('/verify-email/:token', asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailToken(req.params.token);
  res.json(result);
}));

module.exports = router;
