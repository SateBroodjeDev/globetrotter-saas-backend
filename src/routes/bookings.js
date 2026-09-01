const express = require('express');
const { authenticate, requireWorkspaceAccess } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateJoi, bookingSchema } = require('../middleware/validation');
const { db } = require('../config/database');

const router = express.Router();

// Get trip bookings
router.get('/trip/:tripId', authenticate, asyncHandler(async (req, res) => {
  const bookings = await db.Booking.findAll({
    where: { tripId: req.params.tripId },
    order: [['date', 'ASC']]
  });
  res.json({ bookings });
}));

// Add booking
router.post('/', authenticate, requireWorkspaceAccess(), validateJoi(bookingSchema), asyncHandler(async (req, res) => {
  const { tripId, type, provider, bookingReference, date, location, price, currency, status, notes } = req.body;

  const trip = await db.Trip.findByPk(tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const booking = await db.Booking.create({
    tripId, type, provider, bookingReference, date, location,
    price, currency: currency || 'EUR', status: status || 'confirmed', notes
  });

  res.status(201).json({ message: 'Booking added', booking });
}));

// Update booking
router.patch('/:bookingId', authenticate, asyncHandler(async (req, res) => {
  const booking = await db.Booking.findByPk(req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await booking.update(req.body);
  res.json({ message: 'Booking updated', booking });
}));

// Delete booking
router.delete('/:bookingId', authenticate, asyncHandler(async (req, res) => {
  const booking = await db.Booking.findByPk(req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await booking.destroy();
  res.json({ message: 'Booking deleted' });
}));

module.exports = router;
