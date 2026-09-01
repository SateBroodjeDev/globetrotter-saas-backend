const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const EmailPreference = sequelize.define('EmailPreference', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    welcomeEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    settlementReminders: {
      type: DataTypes.ENUM('daily', 'weekly', 'off'),
      defaultValue: 'weekly'
    },
    expenseNotifications: {
      type: DataTypes.ENUM('instant', 'daily', 'weekly', 'off'),
      defaultValue: 'daily'
    },
    tripSharedNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    paymentReceipts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    productUpdates: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    marketingEmails: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    unsubscribedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    unsubscribeToken: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue: () => crypto.randomBytes(24).toString('hex')
    }
  });

  EmailPreference.associate = (models) => {
    EmailPreference.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return EmailPreference;
};
