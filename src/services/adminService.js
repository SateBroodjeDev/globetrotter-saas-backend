const { db, sequelize } = require('../config/database');
const { Op } = require('sequelize');

class AdminService {
  // ─────────────────────────────────────────────
  // Dashboard KPIs
  // ─────────────────────────────────────────────
  async getDashboardKPIs() {
    const [totalUsers, activeUsers, totalWorkspaces] = await Promise.all([
      db.User.count({ where: { isDeleted: false } }),
      db.User.count({ where: { isActive: true, isDeleted: false } }),
      db.Workspace.count({ where: { isDeleted: false } })
    ]);

    const subscriptions = await db.Subscription.findAll();
    const PLAN_PRICE = { pro: 9.99, business: 99 };

    const mrrByPlan = { starter: 0, pro: 0, business: 0 };
    let activeSubscriptions = 0;
    let pastDue = 0;
    let trialsEndingSoon = 0;
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    subscriptions.forEach((s) => {
      if (s.status === 'active') {
        activeSubscriptions++;
        const price = parseFloat(s.pricePerMonth) || PLAN_PRICE[s.plan] || 0;
        mrrByPlan[s.plan] = (mrrByPlan[s.plan] || 0) + price;
      }
      if (s.status === 'past_due') pastDue++;
      if (s.trialEndsAt && new Date(s.trialEndsAt) < sevenDays && s.status === 'trialing') {
        trialsEndingSoon++;
      }
    });

    const totalMRR = mrrByPlan.pro + mrrByPlan.business;

    return {
      totalUsers,
      activeUsers,
      totalWorkspaces,
      totalMRR: parseFloat(totalMRR.toFixed(2)),
      mrrByPlan: {
        starter: parseFloat(mrrByPlan.starter.toFixed(2)),
        pro: parseFloat(mrrByPlan.pro.toFixed(2)),
        business: parseFloat(mrrByPlan.business.toFixed(2))
      },
      activeSubscriptions,
      pastDue,
      trialsEndingSoon,
      churnRate: await this.calculateChurnRate(),
      timestamp: new Date().toISOString()
    };
  }

  // ─────────────────────────────────────────────
  // Churn rate (last 30 days)
  // ─────────────────────────────────────────────
  async calculateChurnRate() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [canceled, totalAtStart] = await Promise.all([
      db.Subscription.count({
        where: { status: 'canceled', canceledAt: { [Op.gte]: thirtyDaysAgo } }
      }),
      db.Subscription.count({
        where: { createdAt: { [Op.lte]: thirtyDaysAgo } }
      })
    ]);

    return totalAtStart > 0
      ? parseFloat((canceled / totalAtStart * 100).toFixed(2))
      : 0;
  }

  // ─────────────────────────────────────────────
  // Revenue metrics (daily grouping)
  // ─────────────────────────────────────────────
  async getRevenueMetrics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const invoices = await db.Invoice.findAll({
      where: { createdAt: { [Op.gte]: since }, status: 'paid' }
    });

    const byDate = {};
    let totalRevenue = 0;
    invoices.forEach((inv) => {
      const date = inv.createdAt.toISOString().split('T')[0];
      const amount = parseFloat(inv.amount);
      byDate[date] = parseFloat(((byDate[date] || 0) + amount).toFixed(2));
      totalRevenue += amount;
    });

    const subscriptions = await db.Subscription.findAll({
      where: { status: 'active' }
    });
    const PLAN_PRICE = { pro: 9.99, business: 99, starter: 0 };
    const mrr = subscriptions.reduce(
      (sum, s) => sum + (parseFloat(s.pricePerMonth) || PLAN_PRICE[s.plan] || 0),
      0
    );

    return {
      dailyRevenue: byDate,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat((mrr * 12).toFixed(2)),
      arpu: subscriptions.length > 0
        ? parseFloat((mrr / subscriptions.length).toFixed(2))
        : 0
    };
  }

  // ─────────────────────────────────────────────
  // User growth over time
  // ─────────────────────────────────────────────
  async getUserGrowth(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const users = await db.User.findAll({
      attributes: ['createdAt'],
      where: { createdAt: { [Op.gte]: since }, isDeleted: false },
      order: [['createdAt', 'ASC']]
    });

    const byDate = {};
    users.forEach((u) => {
      const date = u.createdAt.toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    return byDate;
  }

  // ─────────────────────────────────────────────
  // Conversion metrics (trial → paid)
  // ─────────────────────────────────────────────
  async getConversionMetrics() {
    const [trialCount, paidCount] = await Promise.all([
      db.Subscription.count({ where: { status: 'trialing' } }),
      db.Subscription.count({ where: { status: 'active' } })
    ]);
    const total = trialCount + paidCount;
    return {
      trialing: trialCount,
      paid: paidCount,
      conversionRate: total > 0
        ? parseFloat((paidCount / total * 100).toFixed(2))
        : 0
    };
  }

  // ─────────────────────────────────────────────
  // Subscription plan breakdown
  // ─────────────────────────────────────────────
  async getSubscriptionBreakdown() {
    const subs = await db.Subscription.findAll();
    const breakdown = { starter: 0, pro: 0, business: 0 };
    const statusBreakdown = { trialing: 0, active: 0, past_due: 0, canceled: 0, unpaid: 0 };
    subs.forEach((s) => {
      if (breakdown[s.plan] !== undefined) breakdown[s.plan]++;
      if (statusBreakdown[s.status] !== undefined) statusBreakdown[s.status]++;
    });
    return { byPlan: breakdown, byStatus: statusBreakdown, total: subs.length };
  }

  // ─────────────────────────────────────────────
  // System health
  // ─────────────────────────────────────────────
  async getSystemHealth() {
    let dbStatus = 'healthy';
    let redisStatus = 'healthy';

    try {
      await sequelize.authenticate();
    } catch {
      dbStatus = 'down';
    }

    try {
      const { redisClient } = require('../config/redis');
      await redisClient.ping();
    } catch {
      redisStatus = 'down';
    }

    const mem = process.memoryUsage();
    return {
      status: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
      uptime: process.uptime(),
      memory: {
        heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMB: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
        rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2))
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AdminService();
