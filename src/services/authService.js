const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const slug = require('slug');
const { db } = require('../config/database');
const { redisClient } = require('../config/redis');
const emailService = require('./emailService');
const { createError } = require('../middleware/errorHandler');

class AuthService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    this.refreshTokenTtlSeconds = 7 * 24 * 60 * 60;
  }

  async runInTransaction(callback) {
    if (db.sequelize?.transaction) {
      return db.sequelize.transaction(callback);
    }

    return callback();
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  sanitizeUser(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar || null,
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerifiedAt || null,
      lastLoginAt: user.lastLoginAt || user.lastLogin || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  sanitizeWorkspace(workspace, userRole = 'owner') {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description || null,
      slug: workspace.slug,
      settings: workspace.settings || { theme: 'light', language: 'en', features: {} },
      updatedAt: workspace.updatedAt,
      userRole
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

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async verifyEmailToken(token) {
    const user = await db.User.findOne({ where: { emailVerificationToken: token } });
    if (!user) {
      throw createError(400, 'Invalid verification token', 'INVALID_VERIFICATION_TOKEN');
    }

    await user.update({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null
    });

    return { message: 'Email verified successfully' };
  }

  async validateEmail(email, { checkUnique = true } = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const hasWhitespace = /\s/.test(normalizedEmail);
    const emailParts = normalizedEmail.split('@');
    const localPart = emailParts[0];
    const domain = emailParts[1];
    const domainParts = domain ? domain.split('.') : [];

    if (
      hasWhitespace ||
      emailParts.length !== 2 ||
      !localPart ||
      !domain ||
      domain.startsWith('.') ||
      domain.endsWith('.') ||
      domainParts.length < 2 ||
      domainParts.some((part) => !part)
    ) {
      throw createError(400, 'Invalid email format', 'INVALID_EMAIL_FORMAT');
    }

    if (checkUnique) {
      const existingUser = await db.User.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        throw createError(400, 'Email already exists', 'EMAIL_ALREADY_EXISTS');
      }
    }

    return normalizedEmail;
  }

  validatePassword(password) {
    const value = String(password || '');
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!strongPasswordPattern.test(value)) {
      throw createError(
        400,
        'Password too weak',
        'PASSWORD_TOO_WEAK',
        'Password must be at least 8 characters and include uppercase, lowercase and a number'
      );
    }

    return value;
  }

  async generateUniqueWorkspaceSlug(name) {
    const base = slug(name || 'workspace') || 'workspace';
    let candidate = base;
    let suffix = 1;

    while (await db.Workspace.findOne({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  async createDefaultWorkspace(userId, userName, transaction) {
    const workspaceName = `${userName}'s Workspace`;
    const workspaceSlug = await this.generateUniqueWorkspaceSlug(workspaceName);
    const options = transaction ? { transaction } : undefined;

    const workspace = await db.Workspace.create({
      ownerId: userId,
      name: workspaceName,
      slug: workspaceSlug,
      subdomain: workspaceSlug,
      settings: {
        theme: 'light',
        language: 'en',
        features: {}
      }
    }, options);

    await db.WorkspaceUser.create({
      userId,
      workspaceId: workspace.id,
      role: 'owner',
      joinedAt: new Date(),
      permissions: {
        canCreateTrip: true,
        canEditTrip: true,
        canDeleteTrip: true,
        canManageMembers: true,
        canViewFinancials: true,
        canExport: true,
        canManageSettings: true
      }
    }, options);

    return workspace;
  }

  generateAccessToken(userId, workspaceId) {
    return jwt.sign(
      {
        userId,
        workspaceId: workspaceId || null,
        type: 'access'
      },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }

  async generateRefreshToken(userId) {
    const tokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      {
        userId,
        tokenId,
        type: 'refresh'
      },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    await redisClient.setEx(
      `refresh_token:${userId}:${tokenId}`,
      this.refreshTokenTtlSeconds,
      JSON.stringify({ status: 'active' })
    );

    return { refreshToken, tokenId };
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      throw createError(401, 'Invalid or expired token', 'INVALID_ACCESS_TOKEN');
    }
  }

  async verifyRefreshToken(token) {
    let decoded;

    try {
      decoded = jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      throw createError(401, 'Invalid or expired token', 'INVALID_REFRESH_TOKEN');
    }

    if (decoded.type !== 'refresh' || !decoded.tokenId) {
      throw createError(401, 'Invalid or expired token', 'INVALID_REFRESH_TOKEN');
    }

    const blacklisted = await redisClient.get(`blacklist_refresh_token:${decoded.userId}:${decoded.tokenId}`);
    if (blacklisted) {
      throw createError(401, 'Token blacklisted', 'TOKEN_BLACKLISTED');
    }

    const storedToken = await redisClient.get(`refresh_token:${decoded.userId}:${decoded.tokenId}`);
    if (!storedToken) {
      throw createError(403, 'Token not found', 'TOKEN_NOT_FOUND');
    }

    return decoded;
  }

  async revokeRefreshToken(userId, tokenId) {
    await redisClient.del(`refresh_token:${userId}:${tokenId}`);
    await redisClient.setEx(`blacklist_refresh_token:${userId}:${tokenId}`, this.refreshTokenTtlSeconds, 'blacklisted');
  }

  async isTokenBlacklisted(token) {
    const decoded = jwt.decode(token);
    if (!decoded?.userId || !decoded?.tokenId) {
      return false;
    }

    return Boolean(await redisClient.get(`blacklist_refresh_token:${decoded.userId}:${decoded.tokenId}`));
  }

  async revokeAllRefreshTokens(userId) {
    if (!redisClient.scanIterator) {
      return;
    }

    for await (const key of redisClient.scanIterator({ MATCH: `refresh_token:${userId}:*` })) {
      await redisClient.del(key);
    }
  }

  async register(email, password, firstName, lastName, meta = {}) {
    const normalizedEmail = await this.validateEmail(email);
    this.validatePassword(password);

    const result = await this.runInTransaction(async (transaction) => {
      const options = transaction ? { transaction } : undefined;
      const verificationToken = this.generateVerificationToken();
      const user = await db.User.create({
        email: normalizedEmail,
        passwordHash: password,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        emailVerificationToken: verificationToken
      }, options);

      const workspace = await this.createDefaultWorkspace(user.id, user.firstName, transaction);
      await this.logAudit('user_created', 'user', user.id, user.id, workspace.id, { after: this.sanitizeUser(user) }, meta);

      return { user, workspace };
    });

    const accessToken = this.generateAccessToken(result.user.id, result.workspace.id);
    const { refreshToken } = await this.generateRefreshToken(result.user.id);

    try {
      await emailService.sendWelcomeEmail(result.user.email, result.user.firstName, result.workspace.name);
    } catch (error) {
      console.warn('[auth] Failed to send welcome email', error.message);
    }

    return {
      user: this.sanitizeUser(result.user),
      accessToken,
      refreshToken,
      workspace: this.sanitizeWorkspace(result.workspace, 'owner')
    };
  }

  async login(email, password, meta = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await db.User.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      throw createError(401, 'Invalid email/password', 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      throw createError(401, 'Invalid email/password', 'INVALID_CREDENTIALS');
    }

    const loginAt = new Date();
    await user.update({
      lastLogin: loginAt,
      lastLoginAt: loginAt,
      lastLoginIp: meta.ipAddress
    });

    const memberships = await db.WorkspaceUser.findAll({
      where: { userId: user.id },
      include: [{ model: db.Workspace }]
    });

    const primaryWorkspace = memberships[0]?.Workspace || null;
    const accessToken = this.generateAccessToken(user.id, primaryWorkspace?.id || null);
    const { refreshToken } = await this.generateRefreshToken(user.id);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      workspaces: memberships
        .filter((membership) => membership.Workspace)
        .map((membership) => this.sanitizeWorkspace(membership.Workspace, membership.role))
    };
  }

  async refreshAccessToken(refreshToken, workspaceId) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    return {
      accessToken: this.generateAccessToken(decoded.userId, workspaceId || null)
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) {
      throw createError(400, 'No token provided', 'REFRESH_TOKEN_REQUIRED');
    }

    const decoded = await this.verifyRefreshToken(refreshToken);
    await this.revokeRefreshToken(decoded.userId, decoded.tokenId);
    return { message: 'Logged out successfully' };
  }

  async generatePasswordResetToken(userId) {
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000));

    if (db.PasswordReset?.destroy) {
      await db.PasswordReset.destroy({ where: { userId, usedAt: null } });
    }

    await db.PasswordReset.create({
      userId,
      tokenHash,
      expiresAt
    });

    return { token, expiresAt };
  }

  async verifyPasswordResetToken(token) {
    const tokenHash = this.hashToken(token);
    const passwordReset = await db.PasswordReset.findOne({
      where: {
        tokenHash,
        usedAt: null
      }
    });

    if (!passwordReset || new Date(passwordReset.expiresAt) <= new Date()) {
      throw createError(400, 'Invalid or expired token', 'INVALID_RESET_TOKEN');
    }

    return passwordReset;
  }

  async forgotPassword(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await db.User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return { message: 'Reset link sent to email' };
    }

    const { token } = await this.generatePasswordResetToken(user.id);
    const resetLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/reset-password?token=${token}`;
    await emailService.sendPasswordResetEmail(user.email, resetLink);
    return { message: 'Reset link sent to email' };
  }

  async resetUserPassword(userId, newPassword) {
    this.validatePassword(newPassword);
    const user = await db.User.findByPk(userId);
    if (!user) {
      throw createError(404, 'User not found', 'USER_NOT_FOUND');
    }

    await user.update({ passwordHash: newPassword });
    await this.revokeAllRefreshTokens(userId);
    return user;
  }

  async resetPassword(token, newPassword, meta = {}) {
    const passwordReset = await this.verifyPasswordResetToken(token);
    await this.resetUserPassword(passwordReset.userId, newPassword);

    if (db.PasswordReset?.destroy) {
      await db.PasswordReset.destroy({ where: { userId: passwordReset.userId } });
    } else if (passwordReset.update) {
      await passwordReset.update({ usedAt: new Date() });
    }

    await this.logAudit('password_reset', 'user', passwordReset.userId, passwordReset.userId, null, { after: { passwordUpdated: true } }, meta);
    return { message: 'Password reset successfully' };
  }
}

module.exports = new AuthService();
