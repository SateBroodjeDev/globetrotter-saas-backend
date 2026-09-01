const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShareComment = sequelize.define('ShareComment', {
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
    visitorName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    visitorEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isSpam: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['shareId'] },
      { fields: ['isApproved'] },
      { fields: ['isSpam'] }
    ]
  });

  ShareComment.associate = (models) => {
    ShareComment.belongsTo(models.TripShare, { foreignKey: 'shareId', as: 'share' });
  };

  return ShareComment;
};
