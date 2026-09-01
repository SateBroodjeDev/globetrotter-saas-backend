const { db } = require('../config/database');

class AnalyticsService {
  async getPlatformStats() {
    const [users, workspaces, trips, expenses] = await Promise.all([
      db.User.count({ where: { isDeleted: false } }),
      db.Workspace.count({ where: { isDeleted: false } }),
      db.Trip.count({ where: { isDeleted: false } }),
      db.Expense.findAll({ attributes: ['amountEur'] })
    ]);

    const totalRevenue = expenses.reduce((sum, e) => sum + parseFloat(e.amountEur || 0), 0);

    return {
      totalUsers: users,
      totalWorkspaces: workspaces,
      totalTrips: trips,
      totalExpensesTracked: expenses.length,
      totalExpenseVolumeEur: totalRevenue
    };
  }

  async getUserGrowth(days = 30) {
    const { Op, fn, col, literal } = require('sequelize');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db.User.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { createdAt: { [Op.gte]: since }, isDeleted: false },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true
    });

    return rows;
  }

  async getSubscriptionBreakdown() {
    const { fn, col } = require('sequelize');
    const rows = await db.Workspace.findAll({
      attributes: [
        'planTier',
        [fn('COUNT', col('id')), 'count']
      ],
      where: { isDeleted: false },
      group: ['planTier'],
      raw: true
    });
    return rows;
  }

  async getSystemHealth() {
    const { sequelize } = db;
    try {
      await sequelize.authenticate();
      return { database: 'ok', timestamp: new Date().toISOString() };
    } catch (err) {
      return { database: 'error', error: err.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = new AnalyticsService();
