const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PasswordReset = sequelize.define('PasswordReset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    updatedAt: false
  });

  PasswordReset.associate = (models) => {
    PasswordReset.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return PasswordReset;
};
