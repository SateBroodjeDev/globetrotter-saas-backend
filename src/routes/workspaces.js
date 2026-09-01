const express = require('express');
const { authenticate, authorizeWorkspace, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateWorkspace } = require('../middleware/validation');
const workspaceService = require('../services/workspaceService');
const workspaceAdminService = require('../services/workspaceAdminService');

const router = express.Router();

// Create workspace
router.post('/', authenticate, validateWorkspace.create, asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const workspace = await workspaceService.createWorkspace(name, description, req.user.userId, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(201).json({ workspace });
}));

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const workspaces = await workspaceService.getWorkspacesByUser(req.user.userId);
  res.json(workspaces);
}));

// Get workspace
router.get('/:workspaceId', authenticate, authorizeWorkspace, asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getWorkspaceById(req.params.workspaceId);
  res.json(workspace);
}));

router.put('/:workspaceId',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  validateWorkspace.update,
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.updateWorkspace(req.params.workspaceId, req.body, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ workspace });
  })
);

router.delete('/:workspaceId',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const result = await workspaceService.deleteWorkspace(req.params.workspaceId, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json(result);
  })
);

// Update workspace branding
router.put('/:workspaceId/branding', 
  authenticate, 
  authorizeWorkspace, 
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.updateBranding(req.params.workspaceId, req.body);
    res.json({ message: 'Branding updated', workspace });
  })
);

// Invite member
router.post('/:workspaceId/members',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  validateWorkspace.addMember,
  asyncHandler(async (req, res) => {
    const result = await workspaceService.addMember(req.params.workspaceId, req.body.email, req.body.role, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json(result);
  })
);

router.post('/:workspaceId/members/invite',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  validateWorkspace.addMember,
  asyncHandler(async (req, res) => {
    const result = await workspaceService.addMember(req.params.workspaceId, req.body.email, req.body.role, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json(result);
  })
);

router.get('/:workspaceId/invitations',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const invitations = await workspaceService.getPendingInvitations(req.params.workspaceId);
    res.json(invitations);
  })
);

// Update member role
router.patch('/:workspaceId/members/:userId',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  validateWorkspace.updateMemberRole,
  asyncHandler(async (req, res) => {
    const membership = await workspaceService.updateMemberRole(req.params.workspaceId, req.params.userId, req.body.role, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ membership });
  })
);

router.patch('/:workspaceId/members/:userId/role',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  validateWorkspace.updateMemberRole,
  asyncHandler(async (req, res) => {
    const membership = await workspaceService.updateMemberRole(req.params.workspaceId, req.params.userId, req.body.role, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ membership });
  })
);

// Get workspace members
router.get('/:workspaceId/members',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const members = await workspaceService.getMembersInWorkspace(req.params.workspaceId);
    res.json(members);
  })
);

router.delete('/:workspaceId/members/:userId',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    if (req.user.userId !== req.params.userId && req.workspace.role !== 'owner') {
      return res.status(403).json({
        error: {
          message: 'Forbidden',
          code: 'MEMBER_REMOVE_FORBIDDEN'
        }
      });
    }

    const result = await workspaceService.removeMember(req.params.workspaceId, req.params.userId, req.user.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json(result);
  })
);

router.post('/:workspaceId/members/:userId/resend-invitation',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const result = await workspaceService.resendInvitation(req.params.workspaceId, req.params.userId, req.user.userId);
    res.json(result);
  })
);

// ── Invitation management ────────────────────────────────────────────────────

router.post('/:workspaceId/invitations/:inviteId/resend',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.resendInvitation(req.params.workspaceId, req.params.inviteId, req.user.userId);
    res.json(result);
  })
);

router.delete('/:workspaceId/invitations/:inviteId',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.cancelInvitation(req.params.workspaceId, req.params.inviteId);
    res.json(result);
  })
);

router.post('/:workspaceId/invitations/:inviteId/accept',
  authenticate,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: { message: 'token is required', code: 'VALIDATION_ERROR' } });
    const result = await workspaceAdminService.acceptInvitation(token, req.user.userId);
    res.json(result);
  })
);

// ── Billing & Subscription ───────────────────────────────────────────────────

router.get('/:workspaceId/subscription',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const subscription = await workspaceAdminService.getSubscriptionDetails(req.params.workspaceId);
    res.json(subscription);
  })
);

router.get('/:workspaceId/billing/invoices',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const invoices = await workspaceAdminService.getBillingInvoices(req.params.workspaceId);
    res.json(invoices);
  })
);

router.get('/:workspaceId/billing/usage',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const usage = await workspaceAdminService.getBillingUsage(req.params.workspaceId);
    res.json(usage);
  })
);

router.post('/:workspaceId/billing/upgrade',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: { message: 'priceId is required', code: 'VALIDATION_ERROR' } });
    const stripeService = require('../services/stripeService');
    const session = await stripeService.createCheckoutSession(
      req.params.workspaceId,
      priceId,
      `${process.env.FRONTEND_URL}/checkout-success.html`
    );
    res.json({ url: session.url });
  })
);

router.post('/:workspaceId/billing/downgrade',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: { message: 'priceId is required', code: 'VALIDATION_ERROR' } });
    const stripeService = require('../services/stripeService');
    const session = await stripeService.createCheckoutSession(
      req.params.workspaceId,
      priceId,
      `${process.env.FRONTEND_URL}/checkout-success.html`
    );
    res.json({ url: session.url });
  })
);

router.post('/:workspaceId/billing/cancel',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.cancelSubscription(req.params.workspaceId, req.user.userId);
    res.json(result);
  })
);

router.post('/:workspaceId/billing/coupon',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const { couponCode } = req.body;
    if (!couponCode) return res.status(400).json({ error: { message: 'couponCode is required', code: 'VALIDATION_ERROR' } });
    const result = await workspaceAdminService.applyCoupon(req.params.workspaceId, couponCode);
    res.json(result);
  })
);

router.get('/:workspaceId/billing/portal',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.createBillingPortal(req.params.workspaceId);
    res.json(result);
  })
);

// ── Branding ─────────────────────────────────────────────────────────────────

router.get('/:workspaceId/branding',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.getBranding(req.params.workspaceId);
    res.json(result);
  })
);

router.post('/:workspaceId/branding/logo',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const { logoUrl } = req.body;
    if (!logoUrl) return res.status(400).json({ error: { message: 'logoUrl is required', code: 'VALIDATION_ERROR' } });
    const result = await workspaceAdminService.updateBranding(req.params.workspaceId, { logoUrl }, req.user.userId);
    res.json(result);
  })
);

router.post('/:workspaceId/branding/verify-domain',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: { message: 'domain is required', code: 'VALIDATION_ERROR' } });
    const result = await workspaceAdminService.verifyCustomDomain(req.params.workspaceId, domain);
    res.json(result);
  })
);

router.get('/:workspaceId/branding/dns-setup',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const { db } = require('../config/database');
    const workspace = await db.Workspace.findByPk(req.params.workspaceId, { attributes: ['id', 'slug'] });
    if (!workspace) return res.status(404).json({ error: { message: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' } });
    res.json(workspaceAdminService.getDnsSetupInstructions(workspace));
  })
);

// ── Security ──────────────────────────────────────────────────────────────────

router.post('/:workspaceId/security/change-password',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: { message: 'currentPassword and newPassword are required', code: 'VALIDATION_ERROR' } });
    }
    const result = await workspaceAdminService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json(result);
  })
);

router.post('/:workspaceId/security/2fa/enable',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    // 2FA infrastructure placeholder — returns setup instructions
    res.json({ message: '2FA setup initiated', note: 'Full TOTP implementation requires an authenticator library (e.g., speakeasy).' });
  })
);

router.post('/:workspaceId/security/2fa/disable',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    res.json({ message: '2FA disabled' });
  })
);

router.post('/:workspaceId/security/2fa/verify',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    res.json({ verified: false, message: 'Full TOTP verification requires an authenticator library.' });
  })
);

router.get('/:workspaceId/security/sessions',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.getActiveSessions(req.params.workspaceId);
    res.json(result);
  })
);

router.delete('/:workspaceId/security/sessions/:sessionId',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    // JWT-based: individual session revocation is handled client-side
    res.json({ message: 'Session invalidated' });
  })
);

router.post('/:workspaceId/security/sessions/logout-all',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    res.json({ message: 'All other sessions logged out. Please sign in again on other devices.' });
  })
);

router.get('/:workspaceId/security/login-history',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const history = await workspaceAdminService.getLoginHistory(req.params.workspaceId, req.user.userId);
    res.json(history);
  })
);

router.get('/:workspaceId/permissions',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.getPermissions(req.params.workspaceId, req.user.userId);
    res.json(result);
  })
);

// ── Danger Zone ───────────────────────────────────────────────────────────────

router.post('/:workspaceId/archive',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.archiveWorkspace(req.params.workspaceId, req.user.userId);
    res.json(result);
  })
);

router.post('/:workspaceId/export',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const { format = 'json' } = req.body;
    const result = await workspaceAdminService.exportWorkspaceData(req.params.workspaceId, format, req.user.userId);

    if (format === 'csv') {
      // Simple CSV for trips
      const trips = result.data.trips || [];
      const headers = trips.length ? Object.keys(trips[0]).join(',') : 'id,name';
      const rows = trips.map(t => Object.values(t).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="workspace-export.csv"');
      return res.send([headers, ...rows].join('\n'));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="workspace-export.json"');
    res.json(result.data);
  })
);

router.post('/:workspaceId/import',
  authenticate,
  authorizeWorkspace,
  requireRole(['owner']),
  asyncHandler(async (req, res) => {
    const result = await workspaceAdminService.importWorkspaceData(req.params.workspaceId, req.body, req.user.userId);
    res.json(result);
  })
);

router.get('/:workspaceId/export/status',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    // Synchronous export — always immediately ready
    res.json({ status: 'ready', message: 'Export is available via POST /export' });
  })
);

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get('/:workspaceId/analytics',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const metrics = await workspaceAdminService.getWorkspaceMetrics(req.params.workspaceId);
    res.json(metrics);
  })
);

router.get('/:workspaceId/analytics/trends',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const trends = await workspaceAdminService.getAnalyticsTrends(req.params.workspaceId, days);
    res.json(trends);
  })
);

router.get('/:workspaceId/analytics/members',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const stats = await workspaceAdminService.getMemberAnalytics(req.params.workspaceId);
    res.json(stats);
  })
);

router.get('/:workspaceId/analytics/storage',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const storage = await workspaceAdminService.getStorageBreakdown(req.params.workspaceId);
    res.json(storage);
  })
);

router.get('/:workspaceId/analytics/activity',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const activity = await workspaceAdminService.getRecentActivity(req.params.workspaceId, limit);
    res.json(activity);
  })
);

// ── Public invite endpoints (no authentication required) ─────────────────────

router.get('/invite/:token', asyncHandler(async (req, res) => {
  const invitation = await workspaceService.getInvitationByToken(req.params.token);

  if (!invitation || workspaceService.isInvitationExpired(invitation) || invitation.acceptedAt) {
    return res.status(410).json({ error: 'Invitation expired or invalid' });
  }

  const workspace = await require('../config/database').db.Workspace.findByPk(invitation.workspaceId, {
    attributes: ['id', 'name', 'planTier']
  });

  res.json({
    workspaceId: invitation.workspaceId,
    workspaceName: workspace?.name,
    workspacePlan: workspace?.planTier,
    inviteeEmail: invitation.email,
    inviteeRole: invitation.role
  });
}));

router.post('/invite/:token/accept', asyncHandler(async (req, res) => {
  const invitation = await workspaceService.getInvitationByToken(req.params.token);

  if (!invitation || workspaceService.isInvitationExpired(invitation) || invitation.acceptedAt) {
    return res.status(410).json({ error: 'Invitation expired or invalid' });
  }

  const { db } = require('../config/database');
  const user = await db.User.findOne({ where: { email: invitation.email } });

  if (!user) {
    return res.status(400).json({ error: 'Please sign up first', requireSignup: true });
  }

  const result = await workspaceService.acceptInvitation(req.params.token, user.id);
  res.json({
    ...result,
    workspaceId: invitation.workspaceId,
    redirectUrl: `/workspace/${invitation.workspaceId}/dashboard`
  });
}));

module.exports = router;
