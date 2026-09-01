const express = require('express');
const { authenticate, authorizeWorkspace } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateExpense } = require('../middleware/validation');
const expenseService = require('../services/expenseService');
const { db } = require('../config/database');

const router = express.Router();

// Create expense
router.post('/', authenticate, validateExpense.create, asyncHandler(async (req, res) => {
  const { tripId, description, amount, currency, date, category, splitBetween } = req.body;
  
  const expense = await expenseService.createExpense(tripId, {
    description,
    amount,
    currency,
    date,
    category,
    splitBetween
  }, req.user.userId);

  res.status(201).json({ message: 'Expense created', expense });
}));

// Get trip expenses
router.get('/trip/:tripId', authenticate, asyncHandler(async (req, res) => {
  const expenses = await db.Expense.findAll({
    where: { tripId: req.params.tripId, isDeleted: false },
    include: { association: 'payer', attributes: { exclude: ['passwordHash'] } },
    order: [['date', 'DESC']]
  });

  res.json({ expenses });
}));

// Calculate balances for trip
router.get('/trip/:tripId/balances', authenticate, asyncHandler(async (req, res) => {
  const { balances, transfers } = await expenseService.calculateBalances(req.params.tripId);
  
  res.json({
    balances,
    transfers,
    summary: {
      totalTransfers: transfers.length,
      totalSettlement: transfers.reduce((sum, t) => sum + t.amount, 0)
    }
  });
}));

// Delete expense
router.delete('/:expenseId', authenticate, asyncHandler(async (req, res) => {
  const expense = await db.Expense.findByPk(req.params.expenseId);
  
  if (!expense) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  await expense.update({ isDeleted: true });
  res.json({ message: 'Expense deleted' });
}));

module.exports = router;
