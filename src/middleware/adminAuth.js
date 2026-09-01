const { verifyToken } = require('./auth');
const { redisClient } = require('../config/redis');

/**
 * Platform-level admin authentication.
 * Expects the user record to have an `isAdmin` flag (or role === 'platform_admin').
 */
const authenticateAdmin = async (req, res, next) => {
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

    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const { db } = require('../config/database');
    const user = await db.User.findByPk(decoded.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    req.user = decoded;
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
};

module.exports = { authenticateAdmin };
