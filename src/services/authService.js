const { db } = require('../config/database');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const crypto = require('crypto');

class AuthService {
  async register(email, password, firstName, lastName) {
    // Check if user exists
    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    // Create user
    const user = await db.User.create({
      email,
      passwordHash: password,
      firstName,
      lastName,
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    });

    // Create default workspace
    const workspace = await db.Workspace.create({
      ownerId: user.id,
      name: `${firstName}'s Workspace`,
      slug: `workspace-${user.id.substring(0, 8)}`,
      subdomain: email.split('@')[0]
    });

    // Add user to workspace
    await db.WorkspaceUser.create({
      userId: user.id,
      workspaceId: workspace.id,
      role: 'owner'
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      workspace: {
        id: workspace.id,
        name: workspace.name
      }
    };
  }

  async login(email, password) {
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Update last login
    await user.update({
      lastLogin: new Date(),
      lastLoginIp: this.clientIp
    });

    // Get user's workspaces
    const workspaces = await user.getWorkspaces();
    const primaryWorkspace = workspaces[0];

    const accessToken = generateToken(user.id, primaryWorkspace.id);
    const refreshToken = generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      workspaces: workspaces.map(w => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        role: w.WorkspaceUser.role
      }))
    };
  }

  async validateEmail(token) {
    const user = await db.User.findOne({ where: { emailVerificationToken: token } });
    if (!user) {
      const error = new Error('Invalid verification token');
      error.statusCode = 400;
      throw error;
    }

    await user.update({
      emailVerified: true,
      emailVerificationToken: null
    });

    return { message: 'Email verified successfully' };
  }
}

module.exports = new AuthService();
