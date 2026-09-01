const express = require('express');
const authRoutes = require('./auth');
const workspaceRoutes = require('./workspaces');
const tripRoutes = require('./trips');
const expenseRoutes = require('./expenses');
const bookingRoutes = require('./bookings');
const checklistRoutes = require('./checklist');
const adminRoutes = require('./admin');
const publicRoutes = require('./public');
const settlementRoutes = require('./settlements');
const paymentRoutes = require('./payments');

const router = express.Router();

// Public routes (no auth required)
router.use('/auth', authRoutes);
router.use('/public', publicRoutes);

// Currency exchange (public)
router.use('/currency', publicRoutes);

// Payment routes (webhook uses raw body — must be mounted before json middleware affects it)
router.use('/payments', paymentRoutes);

// Protected routes
router.use('/workspaces', workspaceRoutes);
router.use('/trips', tripRoutes);
router.use('/expenses', expenseRoutes);
router.use('/bookings', bookingRoutes);
router.use('/checklist', checklistRoutes);
router.use('/', settlementRoutes);

// Admin routes (role-restricted inside)
router.use('/admin', adminRoutes);

module.exports = router;
