const express = require('express');
const { authenticate, authorizeWorkspace, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTrip } = require('../middleware/validation');
const tripService = require('../services/tripService');
const { db } = require('../config/database');

const router = express.Router();

// Create trip (protected)
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { workspaceId, title, startDate, endDate, type, description } = req.body;
  
  // Verify user belongs to workspace
  const membership = await db.WorkspaceUser.findOne({
    where: { userId: req.user.userId, workspaceId }
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const trip = await tripService.createTrip(workspaceId, req.user.userId, {
    title, startDate, endDate, type, description
  });

  res.status(201).json({ message: 'Trip created', trip });
}));

// Get workspace trips
router.get('/workspace/:workspaceId', authenticate, asyncHandler(async (req, res) => {
  const trips = await db.Trip.findAll({
    where: {
      workspaceId: req.params.workspaceId,
      isDeleted: false
    },
    include: [
      { association: 'creator', attributes: { exclude: ['passwordHash'] } },
      { association: 'expenses' }
    ],
    order: [['startDate', 'DESC']]
  });

  res.json({ trips });
}));

// Get trip details (public with share token)
router.get('/public/:shareToken', asyncHandler(async (req, res) => {
  const trip = await db.Trip.findOne({
    where: { shareToken: req.params.shareToken, isDeleted: false },
    include: [
      { association: 'days' },
      { association: 'expenses' },
      { association: 'bookings' }
    ]
  });

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  res.json({ trip });
}));

// Add day to trip
router.post('/:tripId/days', authenticate, asyncHandler(async (req, res) => {
  const day = await tripService.addDay(req.params.tripId, req.body);
  res.status(201).json({ message: 'Day added', day });
}));

// Get trip stats
router.get('/:tripId/stats', authenticate, asyncHandler(async (req, res) => {
  const trip = await db.Trip.findByPk(req.params.tripId, {
    include: { association: 'expenses' }
  });

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const stats = {
    totalDays: trip.days?.length || 0,
    totalExpenses: trip.expenses?.length || 0,
    totalSpent: trip.expenses?.reduce((sum, e) => sum + parseFloat(e.amountEur), 0) || 0,
    budget: parseFloat(trip.budget || 0),
    budgetRemaining: (trip.budget - (trip.expenses?.reduce((sum, e) => sum + parseFloat(e.amountEur), 0) || 0))
  };

  res.json({ stats });
}));

// Generate share token
router.post('/:tripId/share', authenticate, asyncHandler(async (req, res) => {
  const shareToken = await tripService.generateShareToken(req.params.tripId);
  res.json({ shareToken });
}));

module.exports = router;
