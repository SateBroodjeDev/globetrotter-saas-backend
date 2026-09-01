const authService = require('../services/authService');
const { db } = require('../config/database');
const { formatError } = require('./errorHandler');

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(formatError('No token provided', 'AUTH_TOKEN_REQUIRED'));
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyAccessToken(token);
    const user = await db.User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json(formatError('Authentication failed', 'USER_NOT_FOUND'));
    }

    req.user = { ...decoded, id: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json(formatError(error.message || 'Authentication failed', error.code || 'AUTHENTICATION_FAILED'));
  }
};

// Workspace authorization
const authorizeWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId || req.user.workspaceId;

    if (!workspaceId) {
      return res.status(400).json(formatError('Workspace ID required', 'WORKSPACE_ID_REQUIRED'));
    }

    const membership = await db.WorkspaceUser.findOne({
      where: {
        userId: req.user.userId,
        workspaceId: workspaceId
      }
    });

    if (!membership) {
      return res.status(403).json(formatError('Forbidden', 'WORKSPACE_FORBIDDEN'));
    }

    req.workspace = { id: workspaceId, role: membership.role };
    next();
  } catch (error) {
    res.status(403).json(formatError('Authorization failed', 'WORKSPACE_AUTHORIZATION_FAILED'));
  }
};

// Role-based access control
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.workspace) {
      return res.status(403).json(formatError('Workspace context required', 'WORKSPACE_CONTEXT_REQUIRED'));
    }

    const roleHierarchy = { 'owner': 4, 'admin': 3, 'editor': 2, 'viewer': 1 };
    const userRoleLevel = roleHierarchy[req.workspace.role] || 0;
    const maxAllowedLevel = Math.max(...allowedRoles.map(r => roleHierarchy[r] || 0));
    if (userRoleLevel < maxAllowedLevel) {
      return res.status(403).json(formatError('Forbidden', 'INSUFFICIENT_WORKSPACE_ROLE', {
        requiredRole: allowedRoles,
        userRole: req.workspace.role
      }));
    }

    next();
  };
};

// requireWorkspaceAccess — verifies the authenticated user is a member of the
// workspace that owns the relevant resource.  Resolves the workspaceId from
// (in priority order):
//   1. req.params.workspaceId
//   2. req.body.workspaceId
//   3. req.query.workspaceId
//   4. The workspace that owns the trip (req.params.id / req.params.tripId / req.body.tripId)
//   5. req.user.workspaceId (last resort, only when no other source is available)
const requireWorkspaceAccess = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      let workspaceId =
        req.params.workspaceId ||
        req.body.workspaceId ||
        req.query.workspaceId;

      // If no direct workspaceId, try to resolve via trip to ensure we check
      // membership against the workspace that actually owns the trip.
      if (!workspaceId) {
        const tripId = req.params.id || req.params.tripId || req.body.tripId;
        if (tripId) {
          const trip = await db.Trip.findByPk(tripId, { attributes: ['workspaceId'] });
          if (trip) workspaceId = trip.workspaceId;
        }
      }

      // Last resort: fall back to the workspaceId embedded in the JWT token
      if (!workspaceId) {
        workspaceId = req.user.workspaceId;
      }

      if (!workspaceId) {
        return res.status(400).json(formatError('Workspace ID could not be determined', 'WORKSPACE_ID_REQUIRED'));
      }

      const membership = await db.WorkspaceUser.findOne({
        where: { userId: req.user.userId, workspaceId }
      });

      if (!membership) {
        return res.status(403).json(formatError('Forbidden', 'WORKSPACE_FORBIDDEN'));
      }

      if (requiredRoles.length > 0) {
        const roleHierarchy = { 'owner': 4, 'admin': 3, 'editor': 2, 'viewer': 1 };
        const userLevel = roleHierarchy[membership.role] || 0;
        const maxRequired = Math.max(...requiredRoles.map(r => roleHierarchy[r] || 0));
        if (userLevel < maxRequired) {
          return res.status(403).json(formatError('Insufficient role', 'INSUFFICIENT_WORKSPACE_ROLE', {
            requiredRole: requiredRoles,
            userRole: membership.role
          }));
        }
      }

      req.workspace = { id: workspaceId, role: membership.role };
      next();
    } catch (error) {
      res.status(403).json(formatError('Authorization failed', 'WORKSPACE_AUTHORIZATION_FAILED'));
    }
  };
};

module.exports = {
  generateToken: (...args) => authService.generateAccessToken(...args),
  generateRefreshToken: (...args) => authService.generateRefreshToken(...args),
  verifyToken: (...args) => authService.verifyAccessToken(...args),
  verifyAccessToken: (...args) => authService.verifyAccessToken(...args),
  authenticate,
  verifyTokenMiddleware: authenticate,
  verifyTokenHandler: authenticate,
  authorizeWorkspace,
  requireWorkspaceAccess,
  authorize: requireRole,
  requireRole
};
