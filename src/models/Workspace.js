const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workspace = sequelize.define('Workspace', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    subdomain: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    planTier: {
      type: DataTypes.ENUM('starter', 'pro', 'business'),
      defaultValue: 'starter'
    },
    maxTrips: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    maxMembers: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    isWhiteLabel: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    brandingConfig: {
      type: DataTypes.JSONB,
      defaultValue: {
        logoUrl: null,
        accentColor: '#0ea5e9',
        appName: 'Globetrotter',
        domain: null
      }
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    subscriptionStatus: {
      type: DataTypes.ENUM('active', 'trialing', 'past_due', 'canceled'),
      defaultValue: 'active'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Workspace.associate = (models) => {
    Workspace.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner' });
    Workspace.belongsToMany(models.User, { through: models.WorkspaceUser, as: 'members' });
    Workspace.hasMany(models.Trip, { foreignKey: 'workspaceId', as: 'trips' });
    Workspace.hasMany(models.AuditLog, { foreignKey: 'workspaceId', as: 'auditLogs' });
  };

  return Workspace;
};
