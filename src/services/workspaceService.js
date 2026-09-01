const crypto = require('crypto');
const slug = require('slug');
const { Op } = require('sequelize');
const { db } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const emailService = require('./emailService');

class WorkspaceService {
  defaultSettings() {
    return {
      theme: 'light',
      language: 'en',
      features: {}
    };
  }

  sanitizeWorkspace(workspace, userRole, memberCount, tripCount) {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description || null,
      slug: workspace.slug,
      settings: workspace.settings || this.defaultSettings(),
      memberCount,
      tripCount,
      userRole,
      updatedAt: workspace.updatedAt
    };
  }

  async logAudit(action, entityType, entityId, userId, workspaceId, changes, meta = {}) {
    if (!db.AuditLog?.create) {
      return null;
    }

    return db.AuditLog.create({
      action,
      resource: entityType,
      resourceId: entityId,
      entityType,
      entityId,
      userId,
      workspaceId,
      changes,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
  }

  getRolePermissions(role) {
    const permissions = {
      owner: {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: true
      },
      admin: {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: false
      },
      editor: {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: false,
        canManageMembers: false,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: false
      },
      viewer: {
        canCreateTrip: false,
        canEditTrip: false,
        canDeleteTrip: false,
        canManageMembers: false,
        canViewFinancials: false,
        canExport: false,
        canManageSettings: false
      }
    };

    return permissions[role] || permissions.viewer;
  }

  async generateUniqueSlug(name) {
    const base = slug(name || 'workspace') || 'workspace';
    let candidate = base;
    let suffix = 1;

    while (await db.Workspace.findOne({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  async getMembership(workspaceId, userId) {
    return db.WorkspaceUser.findOne({
      where: { workspaceId, userId }
    });
  }

  async createWorkspace(name, description, ownerId, meta = {}) {
    const workspaceSlug = await this.generateUniqueSlug(String(name || '').trim());
    const workspace = await db.Workspace.create({
      ownerId,
      name: String(name || '').trim(),
      slug: workspaceSlug,
      description: description == null ? null : String(description).trim(),
      subdomain: workspaceSlug,
      settings: this.defaultSettings()
    });

    await db.WorkspaceUser.create({
      userId: ownerId,
      workspaceId: workspace.id,
      role: 'owner',
      joinedAt: new Date(),
      permissions: this.getRolePermissions('owner')
    });

    await this.logAudit('workspace_created', 'workspace', workspace.id, ownerId, workspace.id, { after: { name: workspace.name } }, meta);
    return this.sanitizeWorkspace(workspace, 'owner', 1, 0);
  }

  async getWorkspacesByUser(userId) {
    const memberships = await db.WorkspaceUser.findAll({
      where: { userId },
      include: [{
        model: db.Workspace,
        include: [
          {
            association: 'members',
            attributes: ['id'],
            through: { attributes: [] }
          },
          {
            association: 'trips',
            attributes: ['id'],
            required: false
          }
        ]
      }]
    });

    return memberships
      .filter((membership) => membership.Workspace)
      .sort((a, b) => new Date(b.Workspace.updatedAt) - new Date(a.Workspace.updatedAt))
      .map((membership) => this.sanitizeWorkspace(
        membership.Workspace,
        membership.role,
        membership.Workspace.members?.length || 0,
        membership.Workspace.trips?.length || 0
      ));
  }

  async canUserAccessWorkspace(userId, workspaceId) {
    return Boolean(await this.getMembership(workspaceId, userId));
  }

  async canUserManageMembers(userId, workspaceId) {
    const membership = await this.getMembership(workspaceId, userId);
    return ['owner', 'admin'].includes(membership?.role);
  }

  async canUserDeleteWorkspace(userId, workspaceId) {
    const membership = await this.getMembership(workspaceId, userId);
    return membership?.role === 'owner';
  }

  async getWorkspaceById(workspaceId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    }

    const members = await this.getMembersInWorkspace(workspaceId);
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description || null,
        slug: workspace.slug,
        updatedAt: workspace.updatedAt
      },
      members,
      settings: workspace.settings || this.defaultSettings()
    };
  }

  async updateWorkspace(workspaceId, data, actorUserId, meta = {}) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    }

    const before = { name: workspace.name, description: workspace.description };
    const nextData = {};
    if (data.name !== undefined) {
      nextData.name = String(data.name).trim();
    }
    if (data.description !== undefined) {
      nextData.description = data.description == null ? null : String(data.description).trim();
    }

    await workspace.update(nextData);
    await this.logAudit('workspace_updated', 'workspace', workspace.id, actorUserId, workspace.id, {
      before,
      after: { name: workspace.name, description: workspace.description }
    }, meta);

    return workspace;
  }

  async deleteWorkspace(workspaceId, actorUserId, meta = {}) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    }

    const deletedAt = new Date();
    const trips = await db.Trip.findAll({
      where: { workspaceId },
      attributes: ['id']
    });

    const tripIds = trips.map((trip) => trip.id);
    if (tripIds.length) {
      await db.Expense.update({ isDeleted: true, deletedAt }, { where: { tripId: { [Op.in]: tripIds } } });
      await db.Trip.update({ isDeleted: true, deletedAt }, { where: { id: { [Op.in]: tripIds } } });
    }

    await workspace.update({ isDeleted: true, deletedAt, isActive: false });
    await this.logAudit('workspace_deleted', 'workspace', workspace.id, actorUserId, workspace.id, { after: { deletedAt } }, meta);

    return { message: 'Workspace deleted successfully' };
  }

  async createInvitation(workspaceId, email, role, invitedByUserId) {
    const token = crypto.randomBytes(24).toString('hex');
    const invitation = await db.WorkspaceInvitation.create({
      workspaceId,
      email,
      role,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      invitedByUserId,
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000))
    });

    return { invitation, token };
  }

  async addMember(workspaceId, email, role = 'viewer', invitedByUserId, meta = {}) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const invitedBy = invitedByUserId ? await db.User.findByPk(invitedByUserId) : null;
    const user = await db.User.findOne({ where: { email: normalizedEmail } });

    if (user) {
      const existingMembership = await db.WorkspaceUser.findOne({
        where: { workspaceId, userId: user.id }
      });

      if (existingMembership) {
        throw createError(400, 'Email already member', 'EMAIL_ALREADY_MEMBER');
      }

      const membership = await db.WorkspaceUser.create({
        workspaceId,
        userId: user.id,
        role,
        joinedAt: new Date(),
        permissions: this.getRolePermissions(role)
      });

      await this.logAudit('member_added', 'member', membership.id, invitedByUserId, workspaceId, {
        after: { userId: user.id, role }
      }, meta);

      await emailService.sendWorkspaceAddedEmail(
        normalizedEmail,
        workspace.name,
        invitedBy?.getFullName?.() || invitedBy?.firstName || 'your team'
      );

      return { message: 'Invitation sent', membership };
    }

    const existingInvitation = await db.WorkspaceInvitation.findOne({
      where: {
        workspaceId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (existingInvitation) {
      throw createError(400, 'Email already member', 'EMAIL_ALREADY_INVITED');
    }

    const { invitation, token } = await this.createInvitation(workspaceId, normalizedEmail, role, invitedByUserId);
    const invitationLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/invite?token=${token}`;
    await emailService.sendWorkspaceInvitation(
      normalizedEmail,
      workspace.name,
      invitationLink,
      invitedBy?.getFullName?.() || invitedBy?.firstName || 'your team'
    );

    await this.logAudit('member_invited', 'invitation', invitation.id, invitedByUserId, workspaceId, {
      after: { email: normalizedEmail, role }
    }, meta);

    return { message: 'Invitation sent', invitationId: invitation.id };
  }

  async getMembersInWorkspace(workspaceId) {
    const memberships = await db.WorkspaceUser.findAll({
      where: { workspaceId },
      include: [{
        model: db.User,
        attributes: ['id', 'email', 'firstName', 'lastName', 'lastLogin', 'lastLoginAt']
      }]
    });

    return memberships.map((membership) => ({
      id: membership.User.id,
      email: membership.User.email,
      name: `${membership.User.firstName || ''} ${membership.User.lastName || ''}`.trim(),
      role: membership.role,
      joinedAt: membership.joinedAt || membership.createdAt,
      lastActive: membership.User.lastLoginAt || membership.User.lastLogin || null
    }));
  }

  async getPendingInvitations(workspaceId) {
    return db.WorkspaceInvitation.findAll({
      where: {
        workspaceId,
        acceptedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });
  }

  async countWorkspaceOwners(workspaceId) {
    return db.WorkspaceUser.count({
      where: {
        workspaceId,
        role: 'owner'
      }
    });
  }

  async updateMemberRole(workspaceId, userId, newRole, actorUserId, meta = {}) {
    const membership = await db.WorkspaceUser.findOne({
      where: { userId, workspaceId }
    });

    if (!membership) {
      throw createError(404, 'Workspace or member not found', 'WORKSPACE_MEMBER_NOT_FOUND');
    }

    if (membership.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw createError(400, 'Cannot remove last owner', 'LAST_OWNER_REQUIRED');
      }
    }

    const before = { role: membership.role };
    await membership.update({
      role: newRole,
      permissions: this.getRolePermissions(newRole)
    });

    await this.logAudit('member_role_updated', 'member', membership.id, actorUserId, workspaceId, {
      before,
      after: { role: newRole }
    }, meta);

    return membership;
  }

  async removeMember(workspaceId, userId, actorUserId, meta = {}) {
    const membership = await db.WorkspaceUser.findOne({
      where: { workspaceId, userId }
    });

    if (!membership) {
      throw createError(404, 'Workspace or member not found', 'WORKSPACE_MEMBER_NOT_FOUND');
    }

    if (membership.role === 'owner') {
      const ownerCount = await this.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw createError(400, 'Cannot remove last owner', 'LAST_OWNER_REQUIRED');
      }
    }

    await membership.update({ isDeleted: true });
    if (membership.destroy) {
      await membership.destroy();
    }

    await this.logAudit('member_removed', 'member', membership.id, actorUserId, workspaceId, { after: { userId } }, meta);
    return { message: 'Member removed' };
  }

  async getInvitationByToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return db.WorkspaceInvitation.findOne({ where: { tokenHash } });
  }

  isInvitationExpired(invitation) {
    return !invitation || new Date(invitation.expiresAt) <= new Date();
  }

  async acceptInvitation(invitationToken, userId) {
    const invitation = await this.getInvitationByToken(invitationToken);
    if (!invitation || this.isInvitationExpired(invitation) || invitation.acceptedAt) {
      throw createError(400, 'Invalid or expired invitation', 'INVALID_INVITATION');
    }

    await db.WorkspaceUser.create({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      joinedAt: new Date(),
      permissions: this.getRolePermissions(invitation.role)
    });

    await invitation.update({ acceptedAt: new Date() });
    return { message: 'Invitation accepted' };
  }

  async rejectInvitation(invitationToken) {
    const invitation = await this.getInvitationByToken(invitationToken);
    if (!invitation) {
      throw createError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
    }

    if (invitation.destroy) {
      await invitation.destroy();
    }

    return { message: 'Invitation rejected' };
  }

  async resendInvitation(workspaceId, invitationId, invitedByUserId) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
    }

    const invitation = await db.WorkspaceInvitation.findOne({
      where: {
        workspaceId,
        id: invitationId,
        acceptedAt: null
      }
    });

    if (!invitation) {
      throw createError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
    }

    const nextToken = crypto.randomBytes(24).toString('hex');
    await invitation.update({
      tokenHash: crypto.createHash('sha256').update(nextToken).digest('hex'),
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000))
    });

    const invitedBy = invitedByUserId ? await db.User.findByPk(invitedByUserId) : null;
    const invitationLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/invite?token=${nextToken}`;
    await emailService.sendWorkspaceInvitation(
      invitation.email,
      workspace.name,
      invitationLink,
      invitedBy?.getFullName?.() || invitedBy?.firstName || 'your team'
    );

    return { message: 'Invitation resent' };
  }

  async updateBranding(workspaceId, brandingConfig) {
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) {
      throw createError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND');
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
