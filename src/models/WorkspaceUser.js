const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkspaceUser = sequelize.define('WorkspaceUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'editor', 'viewer'),
      defaultValue: 'viewer'
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {
        canCreateTrip: false,
        canEditTrip: false,
        canDeleteTrip: false,
        canManageMembers: false,
        canViewFinancials: false,
        canExport: false,
        canManageSettings: false
      }
    },
    invitationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    invitationAcceptedAt: {
      type: DataTypes.DATE,
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

  WorkspaceUser.associate = (models) => {
    WorkspaceUser.belongsTo(models.User, { foreignKey: 'userId' });
    WorkspaceUser.belongsTo(models.Workspace, { foreignKey: 'workspaceId' });
  };

  return WorkspaceUser;
};
