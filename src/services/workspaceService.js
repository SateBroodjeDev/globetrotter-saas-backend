const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class WorkspaceService {
  async createWorkspace(ownerId, name, slug, description) {
    // Check if slug exists
    const existing = await db.Workspace.findOne({ where: { slug } });
    if (existing) {
      const error = new Error('Workspace slug already exists');
      error.statusCode = 409;
      throw error;
    }

    const workspace = await db.Workspace.create({
      ownerId,
      name,
      slug,
      description,
      subdomain: slug
    });

    // Add owner to workspace
    await db.WorkspaceUser.create({
      userId: ownerId,
      workspaceId: workspace.id,
      role: 'owner',
      permissions: {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: true
      }
    });

    return workspace;
  }

  async inviteMember(workspaceId, email, role = 'viewer') {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      const error = new Error('Workspace not found');
      error.statusCode = 404;
      throw error;
    }

    let user = await db.User.findOne({ where: { email } });
    
    // If user doesn't exist, create placeholder
    if (!user) {
      const invitationToken = uuidv4();
      user = await db.User.create({
        email,
        passwordHash: 'pending_invitation',
        emailVerificationToken: invitationToken
      });
    }

    // Check if already member
    const existing = await db.WorkspaceUser.findOne({
      where: { userId: user.id, workspaceId }
    });

    if (existing) {
      const error = new Error('User is already a member of this workspace');
      error.statusCode = 409;
      throw error;
    }

    const rolePermissions = this.getRolePermissions(role);

    const membership = await db.WorkspaceUser.create({
      userId: user.id,
      workspaceId,
      role,
      permissions: rolePermissions,
      invitationToken: uuidv4()
    });

    return membership;
  }

  async updateMemberRole(workspaceId, userId, newRole) {
    const membership = await db.WorkspaceUser.findOne({
      where: { userId, workspaceId }
    });

    if (!membership) {
      const error = new Error('User is not a member of this workspace');
      error.statusCode = 404;
      throw error;
    }

    const permissions = this.getRolePermissions(newRole);

    await membership.update({
      role: newRole,
      permissions
    });

    return membership;
  }

  getRolePermissions(role) {
    const permissions = {
      'owner': {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: true
      },
      'admin': {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: false
      },
      'editor': {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: false,
        canManageMembers: false,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: false
      },
      'viewer': {
        canCreateTrip: false,
        canEditTrip: false,
        canDeleteTrip: false,
        canManageMembers: false,
        canViewFinancials: false,
        canExport: false,
        canManageSettings: false
      }
    };
    return permissions[role] || permissions['viewer'];
  }

  async updateBranding(workspaceId, brandingConfig) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      const error = new Error('Workspace not found');
      error.statusCode = 404;
      throw error;
    }

    await workspace.update({
      brandingConfig: {
        ...workspace.brandingConfig,
        ...brandingConfig
      },
      isWhiteLabel: true
    });

    return workspace;
  }
}

module.exports = new WorkspaceService();
