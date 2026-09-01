const { db } = require('../config/database');

/**
 * Middleware: verify the authenticated user has role 'admin'.
 * On success it logs the admin access in the AuditLog table.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Log every admin access for compliance / audit trail
    try {
      await db.AuditLog.create({
        userId: user.id,
        action: 'admin_access',
        resource: req.path,
        entityType: 'admin',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'success'
      });
    } catch {
      // Non-fatal: don't block the request if audit logging fails
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Admin authorization check failed' });
  }
};

module.exports = { requireAdmin };
