const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Checklist = sequelize.define('Checklist', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    items: {
      type: DataTypes.JSONB,
      defaultValue: [
        { id: 1, text: 'Paspoort controleren', done: false },
        { id: 2, text: 'Visum aanvragen (indien nodig)', done: false },
        { id: 3, text: 'Travel insurance', done: false },
        { id: 4, text: 'Vaccins controleren', done: false }
      ]
    },
    template: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Checklist.associate = (models) => {
    Checklist.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
  };

  return Checklist;
};
