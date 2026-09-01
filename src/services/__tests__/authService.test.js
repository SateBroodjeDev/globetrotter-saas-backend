jest.mock('../../config/database', () => ({
  db: {
    User: {
      findOne: jest.fn(),
      create: jest.fn(),
      findByPk: jest.fn()
    },
    Workspace: {
      findOne: jest.fn(),
      create: jest.fn()
    },
    WorkspaceUser: {
      create: jest.fn(),
      findAll: jest.fn()
    },
    PasswordReset: {
      create: jest.fn(),
      findOne: jest.fn(),
      destroy: jest.fn()
    },
    AuditLog: {
      create: jest.fn()
    },
    sequelize: {
      transaction: jest.fn(async (callback) => callback())
    }
  }
}));

jest.mock('../../config/redis', () => ({
  redisClient: {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    scanIterator: jest.fn()
  }
}));

jest.mock('../emailService', () => ({
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

const authService = require('../authService');
const { db } = require('../../config/database');
const { redisClient } = require('../../config/redis');
const emailService = require('../emailService');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisClient.scanIterator.mockImplementation(async function* scanIterator() {});
  });

  test('register creates user, default workspace, and refresh token', async () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const workspace = {
      id: 'workspace-1',
      name: "Test's Workspace",
      slug: 'tests-workspace',
      settings: { theme: 'light', language: 'en', features: {} },
      updatedAt: new Date()
    };

    db.User.findOne.mockResolvedValue(null);
    db.User.create.mockResolvedValue(user);
    db.Workspace.findOne.mockResolvedValue(null);
    db.Workspace.create.mockResolvedValue(workspace);
    db.WorkspaceUser.create.mockResolvedValue({ id: 'membership-1' });
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });
    redisClient.setEx.mockResolvedValue('OK');
    emailService.sendWelcomeEmail.mockResolvedValue({ messageId: 'mail-1' });

    const result = await authService.register('TEST@example.com', 'StrongPass1', 'Test', 'User');

    expect(db.User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      passwordHash: 'StrongPass1',
      firstName: 'Test',
      lastName: 'User'
    }), undefined);
    expect(db.Workspace.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-1',
      name: "Test's Workspace"
    }), undefined);
    expect(redisClient.setEx).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh_token:user-1:/),
      604800,
      JSON.stringify({ status: 'active' })
    );
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'Test', "Test's Workspace");
    expect(result.refreshToken).toBeTruthy();
    expect(authService.verifyAccessToken(result.accessToken)).toMatchObject({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      type: 'access'
    });
  });

  test('refreshAccessToken issues a new access token for a valid refresh token', async () => {
    redisClient.setEx.mockResolvedValue('OK');
    const { refreshToken } = await authService.generateRefreshToken('user-1');
    redisClient.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ status: 'active' }));

    const result = await authService.refreshAccessToken(refreshToken, 'workspace-22');

    expect(authService.verifyAccessToken(result.accessToken)).toMatchObject({
      userId: 'user-1',
      workspaceId: 'workspace-22',
      type: 'access'
    });
  });

  test('forgotPassword does not leak whether an account exists', async () => {
    db.User.findOne.mockResolvedValue(null);

    const result = await authService.forgotPassword('missing@example.com');

    expect(result).toEqual({ message: 'Reset link sent to email' });
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('resetPassword updates the password and removes existing reset tokens', async () => {
    const passwordReset = {
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000)
    };
    const user = {
      update: jest.fn().mockResolvedValue(undefined)
    };

    db.PasswordReset.findOne.mockResolvedValue(passwordReset);
    db.PasswordReset.destroy.mockResolvedValue(1);
    db.User.findByPk.mockResolvedValue(user);
    db.AuditLog.create.mockResolvedValue({ id: 'audit-1' });
    redisClient.del.mockResolvedValue(1);
    redisClient.scanIterator.mockImplementation(async function* scanIterator() {
      yield 'refresh_token:user-1:token-1';
    });

    const result = await authService.resetPassword('plain-token', 'AnotherPass1');

    expect(user.update).toHaveBeenCalledWith({ passwordHash: 'AnotherPass1' });
    expect(db.PasswordReset.destroy).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(redisClient.del).toHaveBeenCalledWith('refresh_token:user-1:token-1');
    expect(result).toEqual({ message: 'Password reset successfully' });
  });
});
