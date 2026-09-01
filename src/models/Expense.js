const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('flights', 'accommodation', 'meals', 'transport', 'activities', 'shopping', 'other'),
      defaultValue: 'other'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'EUR'
    },
    amountEur: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 1.0
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    paidBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    splitBetween: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of user IDs who share this expense'
    },
    receipt: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Expense.associate = (models) => {
    Expense.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Expense.belongsTo(models.User, { foreignKey: 'paidBy', as: 'payer' });
  };

  return Expense;
};
