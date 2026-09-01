const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShareView = sequelize.define('ShareView', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    shareId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'TripShares', key: 'id' }
    },
    visitorId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    device: {
      type: DataTypes.ENUM('mobile', 'tablet', 'desktop'),
      allowNull: true
    },
    viewedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    timeSpentSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    scrollDepth: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    timestamps: false,
    indexes: [
      { fields: ['shareId'] },
      { fields: ['visitorId'] },
      { fields: ['shareId', 'visitorId'] }
    ]
  });

  ShareView.associate = (models) => {
    ShareView.belongsTo(models.TripShare, { foreignKey: 'shareId', as: 'share' });
  };

  return ShareView;
};
