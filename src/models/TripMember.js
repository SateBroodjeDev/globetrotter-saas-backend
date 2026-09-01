const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TripMember = sequelize.define('TripMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    role: {
      type: DataTypes.ENUM('organizer', 'member'),
      defaultValue: 'member'
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    invitationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isAccepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true
  });

  TripMember.associate = (models) => {
    TripMember.belongsTo(models.Trip, { foreignKey: 'tripId' });
    TripMember.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return TripMember;
};
