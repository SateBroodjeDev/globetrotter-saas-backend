const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');
const currencyService = require('../services/currencyService');

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
router.get('/exchange', asyncHandler(async (req, res) => {
  const date = req.query.date ? String(req.query.date).slice(0, 10) : null;
  const rates = await currencyService.getRates(date);
  res.json({ rates, base: 'EUR', date: date || 'latest' });
}));

router.get('/supported', asyncHandler(async (req, res) => {
  res.json({ currencies: currencyService.getSupportedCurrencies() });
}));

module.exports = router;
