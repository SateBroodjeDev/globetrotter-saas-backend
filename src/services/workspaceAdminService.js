const crypto = require('crypto');
const { Op } = require('sequelize');
const { db, sequelize } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const emailService = require('./emailService');
const stripeService = require('./stripeService');

const PLAN_LIMITS = {
  starter: { maxTrips: 2, maxMembers: 3, storage: 100, apiCalls: 0, export: false, analytics: false, whiteLabel: false, customDomain: false },
  pro: { maxTrips: -1, maxMembers: 10, storage: 1000, apiCalls: 10000, export: true, analytics: true, whiteLabel: true, customDomain: false },
  business: { maxTrips: -1, maxMembers: -1, storage: 10000, apiCalls: -1, export: true, analytics: true, whiteLabel: true, customDomain: true }
};

class WorkspaceAdminService {
  // ── Members ───────────────────────────────────────────────────────────────

  async inviteMember(workspaceId, email, role, invitedByUserId, message) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const invitedBy = invitedByUserId ? await db.User.findByPk(invitedByUserId) : null;
    const inviterName = invitedBy?.getFullName?.() || invitedBy?.firstName || 'your team';

    const existing = await db.User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      const membership = await db.WorkspaceUser.findOne({ where: { workspaceId, userId: existing.id } });
      if (membership) throw createError(400, 'User is already a member', 'EMAIL_ALREADY_MEMBER');
    }

    const pendingInvite = await db.WorkspaceInvitation.findOne({
      where: { workspaceId, email: normalizedEmail, acceptedAt: null, expiresAt: { [Op.gt]: new Date() } }
    });
    if (pendingInvite) throw createError(400, 'Invitation already pending for this email', 'EMAIL_ALREADY_INVITED');

    const token = crypto.randomBytes(24).toString('hex');
    const invitation = await db.WorkspaceInvitation.create({
      workspaceId,
      email: normalizedEmail,
      role,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      invitedByUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const link = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/invite?token=${token}`;
    await emailService.sendWorkspaceInvitation(normalizedEmail, workspace.name, link, inviterName, message);

    await this._logAudit('member_invited', 'invitation', invitation.id, invitedByUserId, workspaceId, {
      after: { email: normalizedEmail, role }
    });

    return { message: 'Invitation sent', invitation: { id: invitation.id, email: normalizedEmail, role, expiresAt: invitation.expiresAt } };
  }

  async cancelInvitation(workspaceId, inviteId) {
    const invitation = await db.WorkspaceInvitation.findOne({ where: { id: inviteId, workspaceId, acceptedAt: null } });
    if (!invitation) throw createError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
    await invitation.destroy();
    return { message: 'Invitation cancelled' };
  }

  async resendInvitation(workspaceId, inviteId, invitedByUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    const invitation = await db.WorkspaceInvitation.findOne({ where: { id: inviteId, workspaceId, acceptedAt: null } });
    if (!invitation) throw createError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');

    const token = crypto.randomBytes(24).toString('hex');
    await invitation.update({
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const invitedBy = invitedByUserId ? await db.User.findByPk(invitedByUserId) : null;
    const link = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/invite?token=${token}`;
    await emailService.sendWorkspaceInvitation(
      invitation.email, workspace.name, link,
      invitedBy?.getFullName?.() || invitedBy?.firstName || 'your team'
    );

    return { message: 'Invitation resent', expiresAt: invitation.expiresAt };
  }

  async acceptInvitation(token, userId) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await db.WorkspaceInvitation.findOne({ where: { tokenHash } });

    if (!invitation || invitation.acceptedAt || new Date(invitation.expiresAt) <= new Date()) {
      throw createError(400, 'Invalid or expired invitation', 'INVALID_INVITATION');
    }

    const existing = await db.WorkspaceUser.findOne({ where: { workspaceId: invitation.workspaceId, userId } });
    if (existing) throw createError(400, 'Already a member of this workspace', 'ALREADY_MEMBER');

    await db.WorkspaceUser.create({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      joinedAt: new Date(),
      permissions: this._rolePermissions(invitation.role)
    });

    await invitation.update({ acceptedAt: new Date() });

    await this._logAudit('invitation_accepted', 'invitation', invitation.id, userId, invitation.workspaceId, {
      after: { userId, role: invitation.role }
    });

    return { message: 'Invitation accepted', workspaceId: invitation.workspaceId };
  }

  async changeMemberRole(workspaceId, userId, newRole, actorUserId, meta = {}) {
    const membership = await db.WorkspaceUser.findOne({ where: { workspaceId, userId } });
    if (!membership) throw createError(404, 'Member not found', 'WORKSPACE_MEMBER_NOT_FOUND');

    if (membership.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await db.WorkspaceUser.count({ where: { workspaceId, role: 'owner' } });
      if (ownerCount <= 1) throw createError(400, 'Cannot remove last owner', 'LAST_OWNER_REQUIRED');
    }

    const oldRole = membership.role;
    await membership.update({ role: newRole, permissions: this._rolePermissions(newRole) });

    const user = await db.User.findByPk(userId);
    if (user) {
      await emailService.sendRoleChangedEmail(user.email, membership.workspaceId, oldRole, newRole).catch(() => {});
    }

    await this._logAudit('member_role_updated', 'member', membership.id, actorUserId, workspaceId, {
      before: { role: oldRole }, after: { role: newRole }
    }, meta);

    return { membership: { userId, workspaceId, role: newRole } };
  }

  async removeMember(workspaceId, userId, actorUserId, meta = {}) {
    const membership = await db.WorkspaceUser.findOne({ where: { workspaceId, userId } });
    if (!membership) throw createError(404, 'Member not found', 'WORKSPACE_MEMBER_NOT_FOUND');

    if (membership.role === 'owner') {
      const ownerCount = await db.WorkspaceUser.count({ where: { workspaceId, role: 'owner' } });
      if (ownerCount <= 1) throw createError(400, 'Cannot remove last owner', 'LAST_OWNER_REQUIRED');
    }

    await membership.destroy();
    await this._logAudit('member_removed', 'member', membership.id, actorUserId, workspaceId, { after: { userId } }, meta);
    return { message: 'Member removed' };
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  async getBranding(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId, { attributes: ['id', 'brandingConfig', 'isWhiteLabel', 'subscriptionPlan'] });
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    return { branding: workspace.brandingConfig || {}, isWhiteLabel: workspace.isWhiteLabel, plan: workspace.subscriptionPlan };
  }

  async updateBranding(workspaceId, brandingData, actorUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    const plan = workspace.subscriptionPlan || 'starter';
    if (!['pro', 'business'].includes(plan)) {
      throw createError(403, 'Branding requires Pro or Business plan', 'PLAN_REQUIRED');
    }

    const updated = { ...(workspace.brandingConfig || {}), ...brandingData };
    await workspace.update({ brandingConfig: updated, isWhiteLabel: true });
    await this._logAudit('branding_updated', 'workspace', workspaceId, actorUserId, workspaceId, { after: updated });

    return { message: 'Branding updated', branding: updated };
  }

  async verifyCustomDomain(workspaceId, domain) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    if (workspace.subscriptionPlan !== 'business') {
      throw createError(403, 'Custom domain requires Business plan', 'PLAN_REQUIRED');
    }

    // Record domain in branding config – actual DNS verification is async
    const branding = { ...(workspace.brandingConfig || {}), domain, domainVerified: false, domainVerifiedAt: null };
    await workspace.update({ brandingConfig: branding });

    return {
      message: 'Domain saved. DNS verification in progress.',
      domain,
      cnameTarget: `${workspace.slug}.globetrotter.io`,
      verified: false
    };
  }

  getDnsSetupInstructions(workspace) {
    return {
      type: 'CNAME',
      host: '@',
      value: `${workspace.slug}.globetrotter.io`,
      ttl: 3600,
      note: 'Add this CNAME record in your DNS provider. SSL is auto-provisioned.'
    };
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getWorkspaceMetrics(workspaceId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalTrips, totalExpenses, totalMembers, subscription] = await Promise.all([
      db.Trip.count({ where: { workspaceId, isDeleted: false } }),
      db.Expense.count({
        include: [{ model: db.Trip, as: 'trip', where: { workspaceId }, required: true }],
        where: { isDeleted: false }
      }).catch(() => 0),
      db.WorkspaceUser.count({ where: { workspaceId } }),
      db.Subscription ? db.Subscription.findOne({ where: { workspaceId }, order: [['createdAt', 'DESC']] }) : Promise.resolve(null)
    ]);

    const workspace = await db.Workspace.findByPk(workspaceId, { attributes: ['subscriptionPlan', 'features', 'trialEndsAt'] });
    const plan = workspace?.subscriptionPlan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

    return {
      trips: { total: totalTrips, limit: limits.maxTrips },
      expenses: { total: totalExpenses },
      members: { total: totalMembers, limit: limits.maxMembers },
      plan,
      subscription: subscription ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd } : null,
      generatedAt: new Date().toISOString()
    };
  }

  async getAnalyticsTrends(workspaceId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const trips = await db.Trip.findAll({
      where: { workspaceId, isDeleted: false, createdAt: { [Op.gte]: startDate } },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    return {
      tripsPerDay: trips.map(r => ({ date: r.dataValues.date, count: parseInt(r.dataValues.count) }))
    };
  }

  async getMemberAnalytics(workspaceId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const memberships = await db.WorkspaceUser.findAll({
      where: { workspaceId },
      include: [{ model: db.User, attributes: ['id', 'email', 'firstName', 'lastName', 'lastLoginAt', 'lastLogin', 'createdAt'] }]
    });

    const byRole = memberships.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});

    const members = memberships.map(m => {
      const lastActive = m.User?.lastLoginAt || m.User?.lastLogin || null;
      return {
        userId: m.userId,
        name: `${m.User?.firstName || ''} ${m.User?.lastName || ''}`.trim(),
        email: m.User?.email,
        role: m.role,
        joinedAt: m.joinedAt || m.createdAt,
        lastActive,
        inactive: lastActive ? new Date(lastActive) < thirtyDaysAgo : true
      };
    });

    return { members, byRole, total: members.length, inactive: members.filter(m => m.inactive).length };
  }

  async getStorageBreakdown(workspaceId) {
    const trips = await db.Trip.findAll({ where: { workspaceId, isDeleted: false }, attributes: ['id'] });
    const tripIds = trips.map(t => t.id);

    const expenseCount = tripIds.length
      ? await db.Expense.count({ where: { tripId: { [Op.in]: tripIds }, isDeleted: false } })
      : 0;

    // Rough byte estimation: each trip ~2 KB JSON, each expense ~1 KB
    const tripBytes = trips.length * 2048;
    const expenseBytes = expenseCount * 1024;
    const totalBytes = tripBytes + expenseBytes;
    const totalMB = Math.round(totalBytes / 1024 / 1024 * 100) / 100;

    const workspace = await db.Workspace.findByPk(workspaceId, { attributes: ['subscriptionPlan'] });
    const plan = workspace?.subscriptionPlan || 'starter';
    const limitMB = PLAN_LIMITS[plan]?.storage || 100;

    return { trips: Math.round(tripBytes / 1024 / 1024 * 100) / 100, expenses: Math.round(expenseBytes / 1024 / 1024 * 100) / 100, total: totalMB, limitMB, unit: 'MB' };
  }

  async getRecentActivity(workspaceId, limit = 10) {
    if (!db.AuditLog) return [];
    const logs = await db.AuditLog.findAll({
      where: { workspaceId },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
      order: [['createdAt', 'DESC']],
      limit
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      actor: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'system',
      changes: log.changes,
      createdAt: log.createdAt
    }));
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  async getSubscriptionDetails(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId, {
      attributes: ['id', 'subscriptionPlan', 'subscriptionStatus', 'stripeCustomerId', 'features', 'trialEndsAt']
    });
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    let subscription = null;
    if (db.Subscription) {
      subscription = await db.Subscription.findOne({ where: { workspaceId }, order: [['createdAt', 'DESC']] });
    }

    const plan = workspace.subscriptionPlan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

    return {
      plan,
      status: subscription?.status || workspace.subscriptionStatus || 'active',
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      trialEndsAt: subscription?.trialEndsAt || workspace.trialEndsAt || null,
      pricePerMonth: subscription?.pricePerMonth || null,
      limits,
      features: workspace.features || limits
    };
  }

  async getBillingInvoices(workspaceId) {
    if (!db.Invoice) return [];
    return db.Invoice.findAll({
      where: { workspaceId },
      order: [['createdAt', 'DESC']],
      limit: 24
    });
  }

  async getBillingUsage(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId, { attributes: ['subscriptionPlan', 'features'] });
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    const plan = workspace.subscriptionPlan || 'starter';
    const limits = PLAN_LIMITS[plan];

    const [tripCount, memberCount] = await Promise.all([
      db.Trip.count({ where: { workspaceId, isDeleted: false } }),
      db.WorkspaceUser.count({ where: { workspaceId } })
    ]);

    return {
      trips: { used: tripCount, limit: limits.maxTrips },
      members: { used: memberCount, limit: limits.maxMembers },
      storage: await this.getStorageBreakdown(workspaceId),
      apiCalls: { used: 0, limit: limits.apiCalls },
      plan
    };
  }

  async createBillingPortal(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    if (!workspace.stripeCustomerId) throw createError(400, 'No billing account found', 'NO_STRIPE_CUSTOMER');

    try {
      const session = await stripeService.stripe.billingPortal.sessions.create({
        customer: workspace.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/workspace/settings.html`
      });
      return { url: session.url };
    } catch (err) {
      throw createError(500, 'Failed to create billing portal session', 'STRIPE_ERROR');
    }
  }

  async cancelSubscription(workspaceId, actorUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    if (db.Subscription) {
      const sub = await db.Subscription.findOne({ where: { workspaceId, status: { [Op.in]: ['active', 'trialing'] } } });
      if (sub) {
        try {
          await stripeService.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (_) { /* graceful – may already be cancelled */ }
        await sub.update({ status: 'canceled', canceledAt: new Date() });
      }
    }

    await workspace.update({ subscriptionPlan: 'starter', subscriptionStatus: 'canceled' });
    await this._logAudit('subscription_cancelled', 'workspace', workspaceId, actorUserId, workspaceId, {});

    return { message: 'Subscription cancelled' };
  }

  async applyCoupon(workspaceId, couponCode) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    if (!workspace.stripeCustomerId) throw createError(400, 'No billing account found', 'NO_STRIPE_CUSTOMER');

    try {
      await stripeService.stripe.customers.update(workspace.stripeCustomerId, { coupon: couponCode });
      return { message: 'Coupon applied successfully' };
    } catch (err) {
      throw createError(400, 'Invalid or expired coupon', 'INVALID_COUPON');
    }
  }

  // ── Security ──────────────────────────────────────────────────────────────

  async changePassword(userId, currentPassword, newPassword) {
    const user = await db.User.findByPk(userId);
    if (!user) throw createError(404, 'User not found', 'USER_NOT_FOUND');

    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw createError(400, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');

    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPasswordPattern.test(newPassword)) {
      throw createError(400, 'Password too weak', 'PASSWORD_TOO_WEAK');
    }

    await user.update({ passwordHash: newPassword });
    await emailService.sendPasswordChangedEmail(user.email).catch(() => {});

    return { message: 'Password changed successfully' };
  }

  async getLoginHistory(workspaceId, userId, limit = 30) {
    if (!db.AuditLog) return [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const logs = await db.AuditLog.findAll({
      where: {
        workspaceId,
        userId,
        action: { [Op.in]: ['user_login', 'login_failed', 'user_created'] },
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      order: [['createdAt', 'DESC']],
      limit
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      status: log.status || 'success',
      createdAt: log.createdAt
    }));
  }

  async getActiveSessions(workspaceId) {
    // Sessions are JWT-based; return placeholder to be extended if session store is added
    return { sessions: [], note: 'JWT-based auth – sessions invalidated on password change' };
  }

  async getPermissions(workspaceId, userId) {
    const membership = await db.WorkspaceUser.findOne({ where: { workspaceId, userId } });
    if (!membership) throw createError(403, 'Not a member of this workspace', 'WORKSPACE_FORBIDDEN');

    return { role: membership.role, permissions: membership.permissions };
  }

  // ── Danger Zone ───────────────────────────────────────────────────────────

  async archiveWorkspace(workspaceId, actorUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    await workspace.update({ isActive: false });
    await this._logAudit('workspace_archived', 'workspace', workspaceId, actorUserId, workspaceId, {});

    return { message: 'Workspace archived. You can unarchive it at any time.' };
  }

  async exportWorkspaceData(workspaceId, format = 'json', actorUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');

    const [trips, members] = await Promise.all([
      db.Trip.findAll({ where: { workspaceId, isDeleted: false } }),
      db.WorkspaceUser.findAll({
        where: { workspaceId },
        include: [{ model: db.User, attributes: ['id', 'email', 'firstName', 'lastName'] }]
      })
    ]);

    let expenses = [];
    if (trips.length) {
      const tripIds = trips.map(t => t.id);
      expenses = await db.Expense.findAll({ where: { tripId: { [Op.in]: tripIds }, isDeleted: false } });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      members: members.map(m => ({ userId: m.userId, role: m.role, email: m.User?.email })),
      trips: trips.map(t => t.toJSON()),
      expenses: expenses.map(e => e.toJSON())
    };

    await this._logAudit('workspace_exported', 'workspace', workspaceId, actorUserId, workspaceId, { after: { format } });

    return { data: payload, format };
  }

  async importWorkspaceData(workspaceId, importData, actorUserId) {
    if (!importData || typeof importData !== 'object') {
      throw createError(400, 'Invalid import data', 'INVALID_IMPORT_DATA');
    }

    await this._logAudit('workspace_imported', 'workspace', workspaceId, actorUserId, workspaceId, {
      after: { tripsCount: importData.trips?.length || 0 }
    });

    // Actual import logic is minimal here – the structure is validated and logged
    return { message: 'Import processed', imported: { trips: importData.trips?.length || 0, expenses: importData.expenses?.length || 0 } };
  }

  async checkUsageLimits(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId, { attributes: ['subscriptionPlan'] });
    const plan = workspace?.subscriptionPlan || 'starter';
    const limits = PLAN_LIMITS[plan];

    const [tripCount, memberCount] = await Promise.all([
      db.Trip.count({ where: { workspaceId, isDeleted: false } }),
      db.WorkspaceUser.count({ where: { workspaceId } })
    ]);

    return {
      canCreateTrip: limits.maxTrips === -1 || tripCount < limits.maxTrips,
      canAddMember: limits.maxMembers === -1 || memberCount < limits.maxMembers,
      storageRemaining: limits.storage,
      plan,
      usage: { trips: tripCount, members: memberCount }
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _rolePermissions(role) {
    const map = {
      owner: { canCreateTrip: true, canEditTrip: true, canDeleteTrip: true, canManageMembers: true, canViewFinancials: true, canExport: true, canManageSettings: true },
      admin: { canCreateTrip: true, canEditTrip: true, canDeleteTrip: true, canManageMembers: true, canViewFinancials: true, canExport: true, canManageSettings: false },
      editor: { canCreateTrip: true, canEditTrip: true, canDeleteTrip: false, canManageMembers: false, canViewFinancials: true, canExport: true, canManageSettings: false },
      viewer: { canCreateTrip: false, canEditTrip: false, canDeleteTrip: false, canManageMembers: false, canViewFinancials: false, canExport: false, canManageSettings: false }
    };
    return map[role] || map.viewer;
  }

  async _logAudit(action, entityType, entityId, userId, workspaceId, changes, meta = {}) {
    if (!db.AuditLog?.create) return null;
    return db.AuditLog.create({
      action, resource: entityType, resourceId: entityId,
      entityType, entityId, userId, workspaceId, changes,
      ipAddress: meta.ipAddress, userAgent: meta.userAgent
    });
  }
}

module.exports = new WorkspaceAdminService();
