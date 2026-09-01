const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');
const currencyService = require('../services/currencyService');
const shareService = require('../services/shareService');
const authService = require('../services/authService');

const router = express.Router();

async function getOptionalViewer(req) {
  const fallbackEmail = req.query.email || req.headers['x-share-email'] || null;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { email: fallbackEmail };
  }

  try {
    const decoded = authService.verifyAccessToken(authHeader.substring(7));
    const user = await db.User.findByPk(decoded.userId);
    if (!user) {
      return { email: fallbackEmail };
    }

    return {
      userId: user.id,
      email: user.email
    };
  } catch {
    return { email: fallbackEmail };
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

// Public trip share (read-only by share token)
router.get('/trips/:shareToken', asyncHandler(async (req, res) => {
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

router.get('/trips/:shareToken/comments', asyncHandler(async (req, res) => {
  const share = await shareService.getActiveShareByToken(req.params.shareToken);
  const viewer = await getOptionalViewer(req);
  await shareService.assertViewerAccess(share, viewer);
  const comments = await db.ShareComment.findAll({
    where: { shareId: share.id, isApproved: true, isSpam: false },
    order: [['createdAt', 'ASC']],
    attributes: ['id', 'visitorName', 'comment', 'createdAt']
  });
  res.json({ comments });
}));

router.post('/trips/:shareToken/comments', asyncHandler(async (req, res) => {
  const share = await shareService.getActiveShareByToken(req.params.shareToken);
  const viewer = await getOptionalViewer(req);
  await shareService.assertViewerAccess(share, viewer);
  const comment = await shareService.addComment(
    share.id,
    req.body.visitorName,
    req.body.visitorEmail,
    req.body.comment
  );

  res.status(201).json({
    success: true,
    message: 'Comment submitted for review',
    commentId: comment.id
  });
}));

router.post('/trips/:shareToken/engagement', asyncHandler(async (req, res) => {
  const share = await shareService.getActiveShareByToken(req.params.shareToken);
  const visitorId = req.headers['x-visitor-id'] || req.body.visitorId;

  if (!visitorId) {
    return res.status(400).json({ error: 'visitorId is required' });
  }

  const view = await shareService.updateViewEngagement(share.id, visitorId, {
    timeSpentSeconds: req.body.timeSpentSeconds,
    scrollDepth: req.body.scrollDepth,
    country: detectCountry(req)
  });

  res.json({ success: true, updated: Boolean(view) });
}));

// GET /api/currency/exchange - exchange rates (cached)
// Mounted at /currency in routes/index.js, so path here is /exchange
router.get('/exchange', asyncHandler(async (req, res) => {
  const date = req.query.date ? String(req.query.date).slice(0, 10) : null;
  const rates = await currencyService.getRates(date);
  res.json({ rates, base: 'EUR', date: date || 'latest' });
}));

router.get('/supported', asyncHandler(async (req, res) => {
  res.json({ currencies: currencyService.getSupportedCurrencies() });
}));

module.exports = router;
