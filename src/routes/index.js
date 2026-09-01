const express = require('express');
const authRoutes = require('./auth');
const workspaceRoutes = require('./workspaces');
const tripRoutes = require('./trips');
const expenseRoutes = require('./expenses');
const adminRoutes = require('./admin');
const stripeRoutes = require('./stripe');

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);

// Stripe webhooks (raw body handled inside route)
router.use('/stripe', stripeRoutes);

// Protected routes
router.use('/workspaces', workspaceRoutes);
router.use('/trips', tripRoutes);
router.use('/expenses', expenseRoutes);

// Platform admin routes
router.use('/admin', adminRoutes);

module.exports = router;
