const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Day = sequelize.define('Day', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false
    },
    activities: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    weather: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Day.associate = (models) => {
    Day.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
  };

  return Day;
};
