const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');

const router = express.Router();

// Get checklist for trip
router.get('/trip/:tripId', authenticate, asyncHandler(async (req, res) => {
  const checklists = await db.Checklist.findAll({
    where: { tripId: req.params.tripId },
    order: [['createdAt', 'ASC']]
  });
  res.json({ checklists });
}));

// Add checklist
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { tripId, title, items } = req.body;

  const trip = await db.Trip.findByPk(tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const checklist = await db.Checklist.create({ tripId, title, items: items || [] });
  res.status(201).json({ message: 'Checklist created', checklist });
}));

// Update checklist (e.g. toggle items)
router.patch('/:checklistId', authenticate, asyncHandler(async (req, res) => {
  const checklist = await db.Checklist.findByPk(req.params.checklistId);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

  await checklist.update(req.body);
  res.json({ message: 'Checklist updated', checklist });
}));

// Delete checklist
router.delete('/:checklistId', authenticate, asyncHandler(async (req, res) => {
  const checklist = await db.Checklist.findByPk(req.params.checklistId);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

  await checklist.destroy();
  res.json({ message: 'Checklist deleted' });
}));

module.exports = router;
