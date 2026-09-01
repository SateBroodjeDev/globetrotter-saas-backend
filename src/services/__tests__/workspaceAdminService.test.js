jest.mock('../../config/database', () => ({
  db: {
    Workspace: { findByPk: jest.fn() },
    WorkspaceUser: { findOne: jest.fn(), count: jest.fn(), create: jest.fn(), findAll: jest.fn() },
    WorkspaceInvitation: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
    User: { findByPk: jest.fn() },
    Trip: { findAll: jest.fn(), count: jest.fn() },
    Expense: { findAll: jest.fn(), count: jest.fn() },
    AuditLog: { create: jest.fn(), findAll: jest.fn() },
    Subscription: { findOne: jest.fn() },
    Invoice: null
  },
  sequelize: {
    fn: jest.fn((fn, col) => `${fn}(${col})`),
    col: jest.fn((name) => name)
  }
}));

jest.mock('../emailService', () => ({
  sendWorkspaceInvitation: jest.fn().mockResolvedValue({ messageId: 'test' }),
  sendRoleChangedEmail: jest.fn().mockResolvedValue({}),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue({})
}));

jest.mock('../stripeService', () => ({
  stripe: {
    billingPortal: { sessions: { create: jest.fn() } },
    subscriptions: { cancel: jest.fn() },
    customers: { update: jest.fn() }
  }
}));

const workspaceAdminService = require('../workspaceAdminService');
const { db } = require('../../config/database');
const emailService = require('../emailService');

describe('workspaceAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── inviteMember ────────────────────────────────────────────────────────────

  test('inviteMember creates invitation for unknown users', async () => {
    const workspace = { id: 'ws-1', name: 'Team Alpha' };
    db.Workspace.findByPk.mockResolvedValue(workspace);
    db.User.findByPk.mockResolvedValue({ firstName: 'Alice', getFullName: () => 'Alice B' });
    db.User.findOne = jest.fn().mockResolvedValue(null);
    db.WorkspaceInvitation.findOne.mockResolvedValue(null);
    db.WorkspaceInvitation.create.mockResolvedValue({ id: 'inv-1', expiresAt: new Date() });
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await workspaceAdminService.inviteMember('ws-1', 'new@example.com', 'editor', 'user-1');
    expect(emailService.sendWorkspaceInvitation).toHaveBeenCalledWith(
      'new@example.com', 'Team Alpha', expect.stringContaining('invite'), 'Alice B', undefined
    );
    expect(result.message).toBe('Invitation sent');
    expect(result.invitation.id).toBe('inv-1');
  });

  test('inviteMember throws when email already pending', async () => {
    db.Workspace.findByPk.mockResolvedValue({ id: 'ws-1', name: 'T' });
    db.User.findByPk.mockResolvedValue(null);
    db.User.findOne = jest.fn().mockResolvedValue(null);
    db.WorkspaceInvitation.findOne.mockResolvedValue({ id: 'existing-invite' });

    await expect(workspaceAdminService.inviteMember('ws-1', 'dup@test.com', 'viewer', 'u-1'))
      .rejects.toMatchObject({ code: 'EMAIL_ALREADY_INVITED' });
  });

  // ── cancelInvitation ────────────────────────────────────────────────────────

  test('cancelInvitation destroys invitation', async () => {
    const inv = { id: 'inv-1', destroy: jest.fn().mockResolvedValue(true) };
    db.WorkspaceInvitation.findOne.mockResolvedValue(inv);

    const result = await workspaceAdminService.cancelInvitation('ws-1', 'inv-1');
    expect(inv.destroy).toHaveBeenCalled();
    expect(result.message).toBe('Invitation cancelled');
  });

  test('cancelInvitation throws when invitation not found', async () => {
    db.WorkspaceInvitation.findOne.mockResolvedValue(null);
    await expect(workspaceAdminService.cancelInvitation('ws-1', 'bad-inv'))
      .rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
  });

  // ── acceptInvitation ────────────────────────────────────────────────────────

  test('acceptInvitation creates membership and marks accepted', async () => {
    const invitation = {
      id: 'inv-1',
      workspaceId: 'ws-1',
      role: 'editor',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      update: jest.fn().mockResolvedValue(true)
    };
    db.WorkspaceInvitation.findOne.mockResolvedValue(invitation);
    db.WorkspaceUser.findOne.mockResolvedValue(null);
    db.WorkspaceUser.create.mockResolvedValue({ id: 'wu-1' });
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await workspaceAdminService.acceptInvitation('valid-token', 'user-2');
    expect(db.WorkspaceUser.create).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-2', role: 'editor' }));
    expect(invitation.update).toHaveBeenCalledWith({ acceptedAt: expect.any(Date) });
    expect(result.workspaceId).toBe('ws-1');
  });

  test('acceptInvitation throws on expired invitation', async () => {
    db.WorkspaceInvitation.findOne.mockResolvedValue({
      id: 'inv-1', acceptedAt: null, expiresAt: new Date(Date.now() - 1000)
    });
    await expect(workspaceAdminService.acceptInvitation('expired-token', 'user-1'))
      .rejects.toMatchObject({ code: 'INVALID_INVITATION' });
  });

  // ── changeMemberRole ────────────────────────────────────────────────────────

  test('changeMemberRole prevents removing last owner', async () => {
    db.WorkspaceUser.findOne.mockResolvedValue({ id: 'wu-1', role: 'owner' });
    db.WorkspaceUser.count.mockResolvedValue(1);
    await expect(workspaceAdminService.changeMemberRole('ws-1', 'u-1', 'admin', 'u-2'))
      .rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
  });

  test('changeMemberRole updates role successfully', async () => {
    const membership = { id: 'wu-1', role: 'editor', update: jest.fn().mockResolvedValue(true) };
    db.WorkspaceUser.findOne.mockResolvedValue(membership);
    db.User.findByPk.mockResolvedValue({ email: 'test@test.com' });
    db.AuditLog.create.mockResolvedValue({});

    const result = await workspaceAdminService.changeMemberRole('ws-1', 'u-1', 'admin', 'u-2');
    expect(membership.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
    expect(result.membership.role).toBe('admin');
  });

  // ── getBranding ─────────────────────────────────────────────────────────────

  test('getBranding returns workspace brandingConfig', async () => {
    db.Workspace.findByPk.mockResolvedValue({
      id: 'ws-1', brandingConfig: { logoUrl: null, accentColor: '#fff' }, isWhiteLabel: false, subscriptionPlan: 'pro'
    });
    const result = await workspaceAdminService.getBranding('ws-1');
    expect(result.branding.accentColor).toBe('#fff');
    expect(result.plan).toBe('pro');
  });

  test('getBranding throws when workspace not found', async () => {
    db.Workspace.findByPk.mockResolvedValue(null);
    await expect(workspaceAdminService.getBranding('bad-ws'))
      .rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  });

  // ── updateBranding ──────────────────────────────────────────────────────────

  test('updateBranding rejects for starter plan', async () => {
    db.Workspace.findByPk.mockResolvedValue({ id: 'ws-1', subscriptionPlan: 'starter', brandingConfig: {} });
    await expect(workspaceAdminService.updateBranding('ws-1', { logoUrl: 'x' }, 'u-1'))
      .rejects.toMatchObject({ code: 'PLAN_REQUIRED' });
  });

  test('updateBranding succeeds for pro plan', async () => {
    const workspace = {
      id: 'ws-1',
      subscriptionPlan: 'pro',
      brandingConfig: { accentColor: '#old' },
      update: jest.fn().mockResolvedValue(true)
    };
    db.Workspace.findByPk.mockResolvedValue(workspace);
    db.AuditLog.create.mockResolvedValue({});

    const result = await workspaceAdminService.updateBranding('ws-1', { accentColor: '#new' }, 'u-1');
    expect(workspace.update).toHaveBeenCalledWith(expect.objectContaining({ isWhiteLabel: true }));
    expect(result.branding.accentColor).toBe('#new');
  });

  // ── getWorkspaceMetrics ─────────────────────────────────────────────────────

  test('getWorkspaceMetrics returns aggregated metrics', async () => {
    db.Trip.count.mockResolvedValue(5);
    db.Expense.count.mockResolvedValue(20);
    db.WorkspaceUser.count.mockResolvedValue(3);
    db.Subscription.findOne.mockResolvedValue(null);
    db.Workspace.findByPk.mockResolvedValue({ subscriptionPlan: 'pro', features: {}, trialEndsAt: null });

    const result = await workspaceAdminService.getWorkspaceMetrics('ws-1');
    expect(result.trips.total).toBe(5);
    expect(result.members.total).toBe(3);
    expect(result.plan).toBe('pro');
  });

  // ── getSubscriptionDetails ──────────────────────────────────────────────────

  test('getSubscriptionDetails returns plan and limits', async () => {
    db.Workspace.findByPk.mockResolvedValue({
      id: 'ws-1', subscriptionPlan: 'starter', subscriptionStatus: 'active',
      stripeCustomerId: null, features: {}, trialEndsAt: null
    });
    db.Subscription.findOne.mockResolvedValue(null);

    const result = await workspaceAdminService.getSubscriptionDetails('ws-1');
    expect(result.plan).toBe('starter');
    expect(result.limits.maxTrips).toBe(2);
  });

  // ── checkUsageLimits ────────────────────────────────────────────────────────

  test('checkUsageLimits returns canCreateTrip false at limit', async () => {
    db.Workspace.findByPk.mockResolvedValue({ subscriptionPlan: 'starter' });
    db.Trip.count.mockResolvedValue(2);
    db.WorkspaceUser.count.mockResolvedValue(1);

    const result = await workspaceAdminService.checkUsageLimits('ws-1');
    expect(result.canCreateTrip).toBe(false);
  });

  test('checkUsageLimits returns canCreateTrip true for pro plan', async () => {
    db.Workspace.findByPk.mockResolvedValue({ subscriptionPlan: 'pro' });
    db.Trip.count.mockResolvedValue(100);
    db.WorkspaceUser.count.mockResolvedValue(5);

    const result = await workspaceAdminService.checkUsageLimits('ws-1');
    expect(result.canCreateTrip).toBe(true);
  });

  // ── archiveWorkspace ────────────────────────────────────────────────────────

  test('archiveWorkspace sets isActive to false', async () => {
    const workspace = { id: 'ws-1', update: jest.fn().mockResolvedValue(true) };
    db.Workspace.findByPk.mockResolvedValue(workspace);
    db.AuditLog.create.mockResolvedValue({});

    const result = await workspaceAdminService.archiveWorkspace('ws-1', 'u-1');
    expect(workspace.update).toHaveBeenCalledWith({ isActive: false });
    expect(result.message).toContain('archived');
  });

  // ── changePassword ──────────────────────────────────────────────────────────

  test('changePassword rejects wrong current password', async () => {
    const user = { comparePassword: jest.fn().mockResolvedValue(false) };
    db.User.findByPk.mockResolvedValue(user);

    await expect(workspaceAdminService.changePassword('u-1', 'wrong', 'NewPass1'))
      .rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
  });

  test('changePassword rejects weak new password', async () => {
    const user = { comparePassword: jest.fn().mockResolvedValue(true) };
    db.User.findByPk.mockResolvedValue(user);

    await expect(workspaceAdminService.changePassword('u-1', 'current', 'weak'))
      .rejects.toMatchObject({ code: 'PASSWORD_TOO_WEAK' });
  });

  test('changePassword succeeds with valid passwords', async () => {
    const user = {
      email: 'test@test.com',
      comparePassword: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true)
    };
    db.User.findByPk.mockResolvedValue(user);

    const result = await workspaceAdminService.changePassword('u-1', 'OldPass1', 'NewPass123');
    expect(user.update).toHaveBeenCalledWith({ passwordHash: 'NewPass123' });
    expect(emailService.sendPasswordChangedEmail).toHaveBeenCalled();
    expect(result.message).toContain('changed');
  });
});
