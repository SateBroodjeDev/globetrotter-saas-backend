const { db } = require('../config/database');

const PLAN_FEATURES = {
  starter: {
    maxTrips: 2,
    maxMembers: 3,
    export: false,
    analytics: false,
    api: false,
    whiteLabel: false,
    customDomain: false,
    sso: false,
    prioritySupport: false
  },
  pro: {
    maxTrips: Infinity,
    maxMembers: 10,
    export: true,
    analytics: true,
    api: true,
    whiteLabel: false,
    customDomain: false,
    sso: false,
    prioritySupport: false
  },
  business: {
    maxTrips: Infinity,
    maxMembers: Infinity,
    export: true,
    analytics: true,
    api: true,
    whiteLabel: true,
    customDomain: true,
    sso: true,
    prioritySupport: true
  }
};

class FeatureService {
  getFeaturesByPlan(plan) {
    return PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
  }

  async updateWorkspaceFeatures(workspaceId, plan) {
    const features = this.getFeaturesByPlan(plan);
    // Replace Infinity with null for DB storage
    const dbFeatures = {};
    for (const [key, value] of Object.entries(features)) {
      dbFeatures[key] = value === Infinity ? null : value;
    }
    await db.Workspace.update(
      { features: dbFeatures, subscriptionPlan: plan },
      { where: { id: workspaceId } }
    );
  }

  canCreateTrip(workspace, currentTripCount) {
    const features = this.getFeaturesByPlan(workspace.subscriptionPlan || 'starter');
    const count = currentTripCount !== undefined
      ? currentTripCount
      : (workspace.trips ? workspace.trips.length : 0);
    if (features.maxTrips === Infinity || features.maxTrips === null) return true;
    return count < features.maxTrips;
  }

  canAddMember(workspace, currentMemberCount) {
    const features = this.getFeaturesByPlan(workspace.subscriptionPlan || 'starter');
    const count = currentMemberCount !== undefined
      ? currentMemberCount
      : (workspace.members ? workspace.members.length : 0);
    if (features.maxMembers === Infinity || features.maxMembers === null) return true;
    return count < features.maxMembers;
  }

  hasFeature(workspace, featureName) {
    const features = this.getFeaturesByPlan(workspace.subscriptionPlan || 'starter');
    return features[featureName] === true;
  }
}

module.exports = new FeatureService();
module.exports.PLAN_FEATURES = PLAN_FEATURES;
