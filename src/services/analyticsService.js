const { db, sequelize } = require('../config/database');
const { Op } = require('sequelize');

class AnalyticsService {
  async getDashboardMetrics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      totalWorkspaces,
      activeWorkspaces,
      totalTrips,
      completedTrips
    ] = await Promise.all([
      db.User.count({ where: { isDeleted: false } }),
      db.User.count({ where: { isDeleted: false, createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      db.Workspace.count({ where: { isDeleted: false } }),
      db.Workspace.count({ where: { isDeleted: false, isActive: true } }),
      db.Trip.count({ where: { isDeleted: false } }),
      db.Trip.count({ where: { isDeleted: false, status: 'completed' } })
    ]);

    return {
      users: { total: totalUsers, newThisMonth: newUsersThisMonth },
      workspaces: { total: totalWorkspaces, active: activeWorkspaces },
      trips: { total: totalTrips, completed: completedTrips },
      generatedAt: new Date().toISOString()
    };
  }

  async getUserGrowth(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const users = await db.User.findAll({
      where: { createdAt: { [Op.gte]: startDate }, isDeleted: false },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    return users.map(r => ({ date: r.dataValues.date, count: parseInt(r.dataValues.count) }));
  }

  async getSubscriptionBreakdown() {
    const breakdown = await db.Workspace.findAll({
      where: { isDeleted: false },
      attributes: [
        'planTier',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['planTier']
    });

    return breakdown.map(r => ({
      plan: r.planTier,
      count: parseInt(r.dataValues.count)
    }));
  }
}

module.exports = new AnalyticsService();
