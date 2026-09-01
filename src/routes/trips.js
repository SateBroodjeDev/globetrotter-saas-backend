const express = require('express');
const { authenticate, authorizeWorkspace, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTrip } = require('../middleware/validation');
const tripService = require('../services/tripService');
const shareService = require('../services/shareService');
const authService = require('../services/authService');
const { db } = require('../config/database');

const router = express.Router();

async function getOptionalViewer(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      email: req.query.email || req.headers['x-share-email'] || null
    };
  }

  try {
    const decoded = authService.verifyAccessToken(authHeader.substring(7));
    const user = await db.User.findByPk(decoded.userId);
    if (!user) {
      return {
        email: req.query.email || req.headers['x-share-email'] || null
      };
    }

    return {
      userId: user.id,
      email: user.email
    };
  } catch {
    return {
      email: req.query.email || req.headers['x-share-email'] || null
    };
  }
}

function detectDevice(userAgent = '') {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function detectCountry(req) {
  return req.headers['x-vercel-ip-country']
    || req.headers['cf-ipcountry']
    || req.headers['x-country-code']
    || null;
}

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
  const viewer = await getOptionalViewer(req);
  const data = await shareService.getPublicTrip(req.params.shareToken, viewer);
  const visitorId = req.headers['x-visitor-id'] || req.query.visitorId || null;

  if (visitorId) {
    const { share } = await shareService.recordView(data.share.id, visitorId, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      country: detectCountry(req),
      device: detectDevice(req.headers['user-agent'])
    });
    data.share.viewCount = share.viewCount;
    data.share.uniqueViewers = share.uniqueViewers;
  }

  res.json(data);
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
  const share = await shareService.createShare(req.params.tripId, req.user.id, req.body || {});
  res.status(201).json({
    share,
    shareToken: share.shareToken,
    shareUrl: `${process.env.FRONTEND_URL || ''}/trip/public/${share.shareToken}`
  });
}));

module.exports = router;
