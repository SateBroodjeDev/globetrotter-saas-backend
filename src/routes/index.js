const express = require('express');
const authRoutes = require('./auth');
const workspaceRoutes = require('./workspaces');
const tripRoutes = require('./trips');
const expenseRoutes = require('./expenses');

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/workspaces', workspaceRoutes);
router.use('/trips', tripRoutes);
router.use('/expenses', expenseRoutes);

module.exports = router;
