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
      type: DataTypes.ENUM(
        'food',
        'transport',
        'hotel',
        'activities',
        'shopping',
        'drinks',
        'services',
        'other',
        'flights',
        'accommodation',
        'meals'
      ),
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
    originalCurrency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'EUR'
    },
    amountEur: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    convertedEUR: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
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
    splitType: {
      type: DataTypes.ENUM('equal', 'percentage', 'custom'),
      allowNull: false,
      defaultValue: 'equal'
    },
    participants: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of participants and share metadata'
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
