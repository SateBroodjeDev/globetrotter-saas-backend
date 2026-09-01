const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    workspaceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Workspaces', key: 'id' }
    },
    stripeInvoiceId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'EUR',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('paid', 'draft', 'open', 'uncollectible', 'void'),
      defaultValue: 'draft',
      allowNull: false
    },
    pdfUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    updatedAt: false
  });

  Invoice.associate = (models) => {
    Invoice.belongsTo(models.Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
  };

  return Invoice;
};
