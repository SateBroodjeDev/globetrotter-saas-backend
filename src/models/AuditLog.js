const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resource: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resourceId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    changes: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('success', 'failure'),
      defaultValue: 'success'
    }
  }, {
    timestamps: true
  });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    AuditLog.belongsTo(models.Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
  };

  return AuditLog;
};
