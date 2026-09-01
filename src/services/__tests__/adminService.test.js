jest.mock('../../config/database', () => ({
  db: {
    User: { count: jest.fn(), findAll: jest.fn() },
    Workspace: { count: jest.fn() },
    Subscription: { findAll: jest.fn(), count: jest.fn() },
    Invoice: { findAll: jest.fn() },
    Trip: { count: jest.fn() },
    Expense: { count: jest.fn() }
  },
  sequelize: { authenticate: jest.fn() }
}));

jest.mock('../../config/redis', () => ({
  redisClient: { ping: jest.fn() }
}));

const adminService = require('../adminService');
const { db, sequelize } = require('../../config/database');
const { redisClient } = require('../../config/redis');

describe('adminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardKPIs', () => {
    it('returns correct KPIs with active subscriptions', async () => {
      db.User.count.mockResolvedValueOnce(100).mockResolvedValueOnce(80);
      db.Workspace.count.mockResolvedValue(20);
      db.Subscription.findAll.mockResolvedValue([
        { status: 'active', plan: 'pro', pricePerMonth: 9.99, trialEndsAt: null },
        { status: 'active', plan: 'business', pricePerMonth: 99, trialEndsAt: null },
        { status: 'past_due', plan: 'pro', pricePerMonth: 9.99, trialEndsAt: null },
        {
          status: 'trialing', plan: 'starter', pricePerMonth: 0,
          trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        }
      ]);
      db.Subscription.count.mockResolvedValue(0);

      const kpis = await adminService.getDashboardKPIs();

      expect(kpis.totalUsers).toBe(100);
      expect(kpis.totalWorkspaces).toBe(20);
      expect(kpis.activeSubscriptions).toBe(2);
      expect(kpis.pastDue).toBe(1);
      expect(kpis.trialsEndingSoon).toBe(1);
      expect(kpis.totalMRR).toBeCloseTo(108.99, 1);
      expect(kpis.mrrByPlan.pro).toBeCloseTo(9.99, 2);
      expect(kpis.mrrByPlan.business).toBeCloseTo(99, 2);
      expect(kpis.timestamp).toBeTruthy();
    });

    it('returns 0 MRR and 0 subscriptions when none exist', async () => {
      db.User.count.mockResolvedValue(0);
      db.Workspace.count.mockResolvedValue(0);
      db.Subscription.findAll.mockResolvedValue([]);
      db.Subscription.count.mockResolvedValue(0);

      const kpis = await adminService.getDashboardKPIs();

      expect(kpis.totalMRR).toBe(0);
      expect(kpis.activeSubscriptions).toBe(0);
      expect(kpis.pastDue).toBe(0);
      expect(kpis.trialsEndingSoon).toBe(0);
    });
  });

  describe('calculateChurnRate', () => {
    it('calculates churn rate as a percentage', async () => {
      db.Subscription.count
        .mockResolvedValueOnce(5)   // canceled
        .mockResolvedValueOnce(100); // total at start

      const rate = await adminService.calculateChurnRate();
      expect(rate).toBe(5);
    });

    it('returns 0 when there are no subscriptions at start', async () => {
      db.Subscription.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const rate = await adminService.calculateChurnRate();
      expect(rate).toBe(0);
    });
  });

  describe('getRevenueMetrics', () => {
    it('aggregates daily revenue and computes MRR/ARR/ARPU', async () => {
      const now = new Date();
      db.Invoice.findAll.mockResolvedValue([
        { createdAt: now, amount: '50.00' },
        { createdAt: now, amount: '25.00' }
      ]);
      db.Subscription.findAll.mockResolvedValue([
        { status: 'active', plan: 'pro', pricePerMonth: 9.99 },
        { status: 'active', plan: 'business', pricePerMonth: 99 }
      ]);

      const metrics = await adminService.getRevenueMetrics(30);

      expect(metrics.totalRevenue).toBeCloseTo(75, 1);
      expect(metrics.mrr).toBeCloseTo(108.99, 1);
      expect(metrics.arr).toBeCloseTo(metrics.mrr * 12, 0);
      expect(metrics.arpu).toBeCloseTo(metrics.mrr / 2, 1);
      expect(Object.keys(metrics.dailyRevenue).length).toBe(1);
    });
  });

  describe('getUserGrowth', () => {
    it('groups users by date', async () => {
      const d1 = new Date('2025-01-01T00:00:00Z');
      const d2 = new Date('2025-01-02T00:00:00Z');
      db.User.findAll.mockResolvedValue([
        { createdAt: d1 }, { createdAt: d1 }, { createdAt: d2 }
      ]);

      const growth = await adminService.getUserGrowth(30);

      expect(growth['2025-01-01']).toBe(2);
      expect(growth['2025-01-02']).toBe(1);
    });
  });

  describe('getConversionMetrics', () => {
    it('returns conversion rate', async () => {
      db.Subscription.count
        .mockResolvedValueOnce(20)  // trialing
        .mockResolvedValueOnce(80); // active/paid

      const metrics = await adminService.getConversionMetrics();

      expect(metrics.trialing).toBe(20);
      expect(metrics.paid).toBe(80);
      expect(metrics.conversionRate).toBe(80);
    });

    it('returns 0 conversion rate when no subscriptions', async () => {
      db.Subscription.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const metrics = await adminService.getConversionMetrics();
      expect(metrics.conversionRate).toBe(0);
    });
  });

  describe('getSystemHealth', () => {
    it('reports healthy when db and redis are up', async () => {
      sequelize.authenticate.mockResolvedValue();
      redisClient.ping.mockResolvedValue('PONG');

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.database).toBe('healthy');
      expect(health.redis).toBe('healthy');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.memory.heapUsedMB).toBeGreaterThan(0);
    });

    it('reports degraded when db is down', async () => {
      sequelize.authenticate.mockRejectedValue(new Error('DB down'));
      redisClient.ping.mockResolvedValue('PONG');

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('degraded');
      expect(health.database).toBe('down');
      expect(health.redis).toBe('healthy');
    });

    it('reports degraded when redis is down', async () => {
      sequelize.authenticate.mockResolvedValue();
      redisClient.ping.mockRejectedValue(new Error('Redis down'));

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('degraded');
      expect(health.redis).toBe('down');
    });
  });
});
