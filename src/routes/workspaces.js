const express = require('express');
const { authenticate, authorizeWorkspace, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateWorkspace } = require('../middleware/validation');
const workspaceService = require('../services/workspaceService');
const { db } = require('../config/database');

const router = express.Router();

// Create workspace
router.post('/', authenticate, validateWorkspace.create, asyncHandler(async (req, res) => {
  const { name, slug, description } = req.body;
  const workspace = await workspaceService.createWorkspace(req.user.userId, name, slug, description);
  
  res.status(201).json({
    message: 'Workspace created',
    workspace
  });
}));

// Get workspace
router.get('/:workspaceId', authenticate, authorizeWorkspace, asyncHandler(async (req, res) => {
  const workspace = await db.Workspace.findByPk(req.params.workspaceId, {
    include: {
      association: 'members',
      attributes: { exclude: ['passwordHash'] },
      through: { attributes: ['role', 'permissions'] }
    }
  });

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  res.json({ workspace });
}));

// Update workspace branding
router.put('/:workspaceId/branding', 
  authenticate, 
  authorizeWorkspace, 
  authorize(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.updateBranding(req.params.workspaceId, req.body);
    res.json({ message: 'Branding updated', workspace });
  })
);

// Invite member
router.post('/:workspaceId/members/invite',
  authenticate,
  authorizeWorkspace,
  authorize(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    const membership = await workspaceService.inviteMember(req.params.workspaceId, email, role);
    
    res.status(201).json({
      message: 'Invitation sent',
      membership
    });
  })
);

// Update member role
router.patch('/:workspaceId/members/:userId/role',
  authenticate,
  authorizeWorkspace,
  authorize(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const membership = await workspaceService.updateMemberRole(req.params.workspaceId, req.params.userId, role);
    
    res.json({
      message: 'Member role updated',
      membership
    });
  })
);

// Get workspace members
router.get('/:workspaceId/members',
  authenticate,
  authorizeWorkspace,
  asyncHandler(async (req, res) => {
    const members = await db.WorkspaceUser.findAll({
      where: { workspaceId: req.params.workspaceId },
      include: {
        model: db.User,
        as: 'User',
        attributes: { exclude: ['passwordHash'] }
      }
    });

    res.json({ members });
  })
);

module.exports = router;
