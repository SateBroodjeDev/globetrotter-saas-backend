const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkspaceInvitation = sequelize.define('WorkspaceInvitation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    role: {
      type: DataTypes.ENUM('admin', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer'
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    timestamps: true,
    updatedAt: false
  });

  WorkspaceInvitation.associate = (models) => {
    WorkspaceInvitation.belongsTo(models.Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
    WorkspaceInvitation.belongsTo(models.User, { foreignKey: 'invitedByUserId', as: 'invitedBy' });
  };

  return WorkspaceInvitation;
};
