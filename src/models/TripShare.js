const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TripShare = sequelize.define('TripShare', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tripId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Trips', key: 'id' }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    shareToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    visibility: {
      type: DataTypes.ENUM('public', 'workspace-only', 'email-list'),
      defaultValue: 'public'
    },
    allowedEmails: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    allowComments: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    allowReactions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    hideExpenseDetails: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hideSettlements: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uniqueViewers: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    commentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    reactionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastViewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['shareToken'], unique: true },
      { fields: ['tripId'] },
      { fields: ['createdBy'] }
    ]
  });

  TripShare.associate = (models) => {
    TripShare.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    TripShare.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    TripShare.hasMany(models.ShareView, { foreignKey: 'shareId', as: 'views' });
    TripShare.hasMany(models.ShareComment, { foreignKey: 'shareId', as: 'comments' });
  };

  return TripShare;
};
