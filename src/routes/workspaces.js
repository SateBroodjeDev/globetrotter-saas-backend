const express = require('express');
const { authenticate, authorizeWorkspace, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateWorkspace } = require('../middleware/validation');
const workspaceService = require('../services/workspaceService');

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

module.exports = router;
