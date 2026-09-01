const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateJoi, markSettlementPaidSchema } = require('../middleware/validation');
const settlementService = require('../services/settlementService');

const router = express.Router();

router.post('/trips/:tripId/calculate-settlement', authenticate, asyncHandler(async (req, res) => {
  const settlements = await settlementService.calculateSettlement(req.params.tripId, req.user.userId);
  res.json({
    settlements: settlements.map((settlement) => ({
      id: settlement.id,
      from: settlement.from,
      to: settlement.to,
      amount: Number(settlement.amount),
      status: settlement.status
    }))
  });
}));

router.get('/trips/:tripId/balances', authenticate, asyncHandler(async (req, res) => {
  const { balances, transfers } = await settlementService.getBalances(req.params.tripId, req.user.userId);
  res.json({
    balances: Object.fromEntries(
      Object.entries(balances).map(([userId, balance]) => [userId, Number(Number(balance).toFixed(2))])
    ),
    settlementPlan: transfers.map((transfer) => ({
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      status: 'pending'
    }))
  });
}));

router.post('/settlements/:settlementId/mark-paid', authenticate, validateJoi(markSettlementPaidSchema), asyncHandler(async (req, res) => {
  const settlement = await settlementService.markPaid(req.params.settlementId, req.user.userId, req.body.proofImage);
  res.json({
    message: 'Settlement marked as paid',
    settlement
  });
}));

router.get('/settlements/:tripId/history', authenticate, asyncHandler(async (req, res) => {
  const history = await settlementService.getHistory(req.params.tripId, req.user.userId);
  res.json({
    history: history.map((settlement) => ({
      id: settlement.id,
      from: settlement.from,
      to: settlement.to,
      amount: Number(settlement.amount),
      status: settlement.status,
      proofImage: settlement.proofImage,
      createdAt: settlement.createdAt,
      paidAt: settlement.paidAt
    }))
  });
}));

module.exports = router;
