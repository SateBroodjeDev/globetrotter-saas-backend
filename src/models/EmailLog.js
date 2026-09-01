const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('EmailLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    to: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true
    },
    templateId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    variables: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'bounced', 'unsubscribed'),
      defaultValue: 'pending'
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });
};
