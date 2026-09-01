const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    workspaceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Workspaces', key: 'id' }
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    plan: {
      type: DataTypes.ENUM('starter', 'pro', 'business'),
      defaultValue: 'starter',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid'),
      defaultValue: 'trialing',
      allowNull: false
    },
    currentPeriodStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    currentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trialEndsAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    canceledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    pricePerMonth: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    }
  }, {
    timestamps: true
  });

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
  };

  return Subscription;
};
