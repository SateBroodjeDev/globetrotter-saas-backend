const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Generate JWT token
function generateToken(userId, workspaceId) {
  return jwt.sign(
    { userId, workspaceId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Generate Refresh Token
function generateRefreshToken(userId) {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
    { expiresIn: '30d' }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if token is blacklisted (logout)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
};

// Workspace authorization
const authorizeWorkspace = async (req, res, next) => {
  try {
    const { db } = require('../config/database');
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.user.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const membership = await db.WorkspaceUser.findOne({
      where: {
        userId: req.user.userId,
        workspaceId: workspaceId
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    req.workspace = { id: workspaceId, role: membership.role };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Authorization failed' });
  }
};

// Role-based access control
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.workspace) {
      return res.status(403).json({ error: 'Workspace context required' });
    }

    const roleHierarchy = { 'owner': 4, 'admin': 3, 'editor': 2, 'viewer': 1 };
    const userRoleLevel = roleHierarchy[req.workspace.role] || 0;
    const maxAllowedLevel = Math.max(...allowedRoles.map(r => roleHierarchy[r] || 0));

    if (userRoleLevel < maxAllowedLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredRole: allowedRoles,
        userRole: req.workspace.role
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  authorizeWorkspace,
  authorize
};
