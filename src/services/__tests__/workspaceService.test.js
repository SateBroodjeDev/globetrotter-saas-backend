jest.mock('../../config/database', () => ({
  db: {
    Workspace: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn()
    },
    WorkspaceUser: {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn()
    },
    WorkspaceInvitation: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn()
    },
    User: {
      findByPk: jest.fn(),
      findOne: jest.fn()
    },
    Trip: {
      findAll: jest.fn(),
      update: jest.fn()
    },
    Expense: {
      update: jest.fn()
    },
    AuditLog: {
      create: jest.fn()
    }
  }
}));

jest.mock('../emailService', () => ({
  sendWorkspaceInvitation: jest.fn(),
  sendWorkspaceAddedEmail: jest.fn()
}));

const workspaceService = require('../workspaceService');
const { db } = require('../../config/database');
const emailService = require('../emailService');

describe('workspaceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createWorkspace creates an owner membership and generated slug', async () => {
    const workspace = {
      id: 'workspace-1',
      name: 'Team Europe',
      description: 'Summer trip',
      slug: 'team-europe',
      settings: { theme: 'light', language: 'en', features: {} },
      updatedAt: new Date()
    };

    db.Workspace.findOne.mockResolvedValue(null);
    db.Workspace.create.mockResolvedValue(workspace);
    db.WorkspaceUser.create.mockResolvedValue({ id: 'membership-1' });
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await workspaceService.createWorkspace('Team Europe', 'Summer trip', 'user-1');

    expect(db.Workspace.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-1',
      name: 'Team Europe',
      slug: 'team-europe'
    }));
    expect(db.WorkspaceUser.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      role: 'owner'
    }));
    expect(result).toMatchObject({
      id: 'workspace-1',
      memberCount: 1,
      tripCount: 0,
      userRole: 'owner'
    });
  });

  test('addMember creates an invitation for unknown users', async () => {
    const workspace = { id: 'workspace-1', name: 'Team Europe' };
    const inviter = { firstName: 'Owner', getFullName: () => 'Owner User' };

    db.Workspace.findByPk.mockResolvedValue(workspace);
    db.User.findByPk.mockResolvedValue(inviter);
    db.User.findOne.mockResolvedValue(null);
    db.WorkspaceInvitation.findOne.mockResolvedValue(null);
    db.WorkspaceInvitation.create.mockResolvedValue({ id: 'invite-1' });
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });
    emailService.sendWorkspaceInvitation.mockResolvedValue({ messageId: 'mail-1' });

    const result = await workspaceService.addMember('workspace-1', 'new@example.com', 'editor', 'user-1');

    expect(db.WorkspaceInvitation.create).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      email: 'new@example.com',
      role: 'editor',
      invitedByUserId: 'user-1'
    }));
    expect(emailService.sendWorkspaceInvitation).toHaveBeenCalled();
    expect(result).toEqual({ message: 'Invitation sent', invitationId: 'invite-1' });
  });

  test('updateMemberRole prevents removing the last owner', async () => {
    db.WorkspaceUser.findOne.mockResolvedValue({
      id: 'membership-1',
      role: 'owner'
    });
    db.WorkspaceUser.count.mockResolvedValue(1);

    await expect(
      workspaceService.updateMemberRole('workspace-1', 'user-2', 'admin', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'LAST_OWNER_REQUIRED'
    });
  });

  test('removeMember prevents deleting the last owner', async () => {
    db.WorkspaceUser.findOne.mockResolvedValue({
      id: 'membership-1',
      role: 'owner'
    });
    db.WorkspaceUser.count.mockResolvedValue(1);

    await expect(
      workspaceService.removeMember('workspace-1', 'user-2', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'LAST_OWNER_REQUIRED'
    });
  });
});
