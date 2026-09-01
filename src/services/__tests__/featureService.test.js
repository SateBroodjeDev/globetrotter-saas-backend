jest.mock('../../config/database', () => ({
  db: {
    Workspace: {
      update: jest.fn().mockResolvedValue([1])
    }
  }
}));

const featureService = require('../featureService');
const { PLAN_FEATURES } = require('../featureService');

describe('featureService', () => {
  describe('getFeaturesByPlan', () => {
    test('returns starter features for starter plan', () => {
      const f = featureService.getFeaturesByPlan('starter');
      expect(f.maxTrips).toBe(2);
      expect(f.maxMembers).toBe(3);
      expect(f.export).toBe(false);
      expect(f.analytics).toBe(false);
    });

    test('returns pro features for pro plan', () => {
      const f = featureService.getFeaturesByPlan('pro');
      expect(f.maxTrips).toBe(Infinity);
      expect(f.maxMembers).toBe(10);
      expect(f.export).toBe(true);
      expect(f.analytics).toBe(true);
      expect(f.whiteLabel).toBe(false);
    });

    test('returns business features for business plan', () => {
      const f = featureService.getFeaturesByPlan('business');
      expect(f.maxTrips).toBe(Infinity);
      expect(f.maxMembers).toBe(Infinity);
      expect(f.whiteLabel).toBe(true);
      expect(f.sso).toBe(true);
      expect(f.prioritySupport).toBe(true);
    });

    test('falls back to starter for unknown plan', () => {
      const f = featureService.getFeaturesByPlan('unknown');
      expect(f).toEqual(PLAN_FEATURES.starter);
    });
  });

  describe('canCreateTrip', () => {
    test('starter plan: allows trips below limit', () => {
      const ws = { subscriptionPlan: 'starter' };
      expect(featureService.canCreateTrip(ws, 1)).toBe(true);
    });

    test('starter plan: blocks trips at limit', () => {
      const ws = { subscriptionPlan: 'starter' };
      expect(featureService.canCreateTrip(ws, 2)).toBe(false);
    });

    test('pro plan: always allows trips', () => {
      const ws = { subscriptionPlan: 'pro' };
      expect(featureService.canCreateTrip(ws, 999)).toBe(true);
    });

    test('business plan: always allows trips', () => {
      const ws = { subscriptionPlan: 'business' };
      expect(featureService.canCreateTrip(ws, 999)).toBe(true);
    });
  });

  describe('canAddMember', () => {
    test('starter plan: allows members below limit', () => {
      const ws = { subscriptionPlan: 'starter' };
      expect(featureService.canAddMember(ws, 2)).toBe(true);
    });

    test('starter plan: blocks members at limit', () => {
      const ws = { subscriptionPlan: 'starter' };
      expect(featureService.canAddMember(ws, 3)).toBe(false);
    });

    test('pro plan: allows up to 10 members', () => {
      const ws = { subscriptionPlan: 'pro' };
      expect(featureService.canAddMember(ws, 9)).toBe(true);
      expect(featureService.canAddMember(ws, 10)).toBe(false);
    });

    test('business plan: always allows members', () => {
      const ws = { subscriptionPlan: 'business' };
      expect(featureService.canAddMember(ws, 9999)).toBe(true);
    });
  });

  describe('hasFeature', () => {
    test('starter plan does not have export', () => {
      expect(featureService.hasFeature({ subscriptionPlan: 'starter' }, 'export')).toBe(false);
    });

    test('pro plan has export', () => {
      expect(featureService.hasFeature({ subscriptionPlan: 'pro' }, 'export')).toBe(true);
    });

    test('business plan has sso', () => {
      expect(featureService.hasFeature({ subscriptionPlan: 'business' }, 'sso')).toBe(true);
    });

    test('pro plan does not have whiteLabel', () => {
      expect(featureService.hasFeature({ subscriptionPlan: 'pro' }, 'whiteLabel')).toBe(false);
    });
  });

  describe('updateWorkspaceFeatures', () => {
    test('calls Workspace.update with serializable features', async () => {
      const { db } = require('../../config/database');
      await featureService.updateWorkspaceFeatures('ws-1', 'pro');
      expect(db.Workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionPlan: 'pro' }),
        expect.objectContaining({ where: { id: 'ws-1' } })
      );
      const callArg = db.Workspace.update.mock.calls[0][0];
      expect(callArg.features.maxTrips).toBeNull();
    });
  });
});
