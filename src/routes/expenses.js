const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validateJoi,
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema
} = require('../middleware/validation');
const expenseService = require('../services/expenseService');

const router = express.Router();

// Create expense
router.post('/', authenticate, validateJoi(createExpenseSchema), asyncHandler(async (req, res) => {
  const { tripId, ...expenseData } = req.body;
  const expense = await expenseService.createExpense(tripId, expenseData, req.user.userId);

  res.status(201).json({ message: 'Expense created', expense });
}));

// Get trip expenses
router.get('/trip/:tripId', authenticate, validateJoi(expenseFiltersSchema, 'query'), asyncHandler(async (req, res) => {
  const expenses = await expenseService.getTripExpenses(req.params.tripId, req.query, req.user.userId);

  res.json({ expenses });
}));

// Category totals and summary
router.get('/trip/:tripId/summary', authenticate, validateJoi(expenseFiltersSchema, 'query'), asyncHandler(async (req, res) => {
  const summary = await expenseService.getExpenseSummary(req.params.tripId, req.query, req.user.userId);
  res.json(summary);
}));

// Update expense
router.put('/:expenseId', authenticate, validateJoi(updateExpenseSchema), asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.expenseId, req.body, req.user.userId);
  res.json({ message: 'Expense updated', expense });
}));

// Delete expense
router.delete('/:expenseId', authenticate, asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.params.expenseId, req.user.userId);
  res.json({ message: 'Expense deleted' });
}));

// Get expense receipt URL
router.get('/:expenseId/receipt', authenticate, asyncHandler(async (req, res) => {
  const receipt = await expenseService.getReceipt(req.params.expenseId, req.user.userId);
  res.json({ receipt });
}));

module.exports = router;
