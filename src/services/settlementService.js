const { db } = require('../config/database');
const expenseService = require('./expenseService');

class SettlementService {
  async calculateSettlement(tripId, userId) {
    await expenseService.assertTripMember(tripId, userId);

    const { balances, transfers } = await expenseService.calculateBalances(tripId);
    const trip = await db.Trip.findByPk(tripId, { attributes: ['workspaceId'] });

    await db.Settlement.destroy({
      where: { tripId, status: 'pending' }
    });

    if (!transfers.length) {
      return [];
    }

    const settlements = await db.Settlement.bulkCreate(
      transfers.map((transfer) => ({
        tripId,
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount,
        status: 'pending'
      })),
      { returning: true }
    );

    await this.createAuditLog({
      action: 'settlement.calculated',
      resourceId: tripId,
      userId,
      workspaceId: trip?.workspaceId,
      changes: { balances, settlementCount: settlements.length }
    });

    return settlements;
  }

  async getBalances(tripId, userId) {
    await expenseService.assertTripMember(tripId, userId);
    return expenseService.calculateBalances(tripId);
  }

  async markPaid(settlementId, userId, proofImage = null) {
    const settlement = await db.Settlement.findByPk(settlementId);
    if (!settlement) {
      const error = new Error('Settlement not found');
      error.statusCode = 404;
      throw error;
    }

    await expenseService.assertTripMember(settlement.tripId, userId);
    await settlement.update({
      status: 'completed',
      proofImage: proofImage || settlement.proofImage,
      paidAt: new Date()
    });

    const trip = await db.Trip.findByPk(settlement.tripId, { attributes: ['workspaceId'] });
    await this.createAuditLog({
      action: 'settlement.mark_paid',
      resourceId: settlement.id,
      userId,
      workspaceId: trip?.workspaceId,
      changes: { status: 'completed', proofImage: settlement.proofImage }
    });

    return settlement;
  }

  async getHistory(tripId, userId) {
    await expenseService.assertTripMember(tripId, userId);
    return db.Settlement.findAll({
      where: { tripId },
      order: [['createdAt', 'DESC']]
    });
  }

  async createAuditLog({ action, resourceId, userId, workspaceId = null, changes = null, status = 'success' }) {
    if (!db.AuditLog || !userId) {
      return;
    }

    await db.AuditLog.create({
      action,
      resource: 'settlement',
      resourceId,
      userId,
      workspaceId,
      changes,
      status
    });
  }
}

module.exports = new SettlementService();
