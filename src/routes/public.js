const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');
const EXCHANGE_RATES = require('../constants/exchangeRates');

const router = express.Router();

// Public trip share (read-only by share token)
router.get('/trips/:shareToken', asyncHandler(async (req, res) => {
  const trip = await db.Trip.findOne({
    where: { shareToken: req.params.shareToken, isDeleted: false },
    include: [
      { association: 'days', order: [['date', 'ASC']] },
      { association: 'expenses' },
      { association: 'bookings' }
    ]
  });

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found or link is invalid' });
  }

  res.json({ trip });
}));

// GET /api/currency/exchange - exchange rates (cached)
// Mounted at /currency in routes/index.js, so path here is /exchange
let ratesCache = null;
let ratesCacheTime = 0;
router.get('/exchange', asyncHandler(async (req, res) => {
  const now = Date.now();
  if (ratesCache && now - ratesCacheTime < 3600 * 1000) {
    return res.json({ rates: ratesCache, cached: true });
  }

  // Use built-in rates as fallback (live API would require key)
  ratesCache = EXCHANGE_RATES;
  ratesCacheTime = now;

  res.json({ rates: EXCHANGE_RATES, cached: false });
}));

module.exports = router;
