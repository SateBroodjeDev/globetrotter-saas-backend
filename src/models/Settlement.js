const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Settlement = sequelize.define('Settlement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    from: {
      type: DataTypes.UUID,
      allowNull: false
    },
    to: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    proofImage: {
      type: DataTypes.STRING,
      allowNull: true
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    updatedAt: false
  });

  Settlement.associate = (models) => {
    Settlement.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Settlement.belongsTo(models.User, { foreignKey: 'from', as: 'fromUser' });
    Settlement.belongsTo(models.User, { foreignKey: 'to', as: 'toUser' });
  };

  return Settlement;
};
