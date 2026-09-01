const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('roadtrip', 'backpacking', 'city_break', 'safari', 'cruise', 'other'),
      defaultValue: 'roadtrip'
    },
    status: {
      type: DataTypes.ENUM('planning', 'ongoing', 'completed'),
      defaultValue: 'planning'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    coverImage: {
      type: DataTypes.STRING,
      allowNull: true
    },
    budget: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'EUR'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    shareToken: {
      type: DataTypes.STRING,
      unique: true,
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

  Trip.associate = (models) => {
    Trip.belongsTo(models.Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
    Trip.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    Trip.hasMany(models.Day, { foreignKey: 'tripId', as: 'days' });
    Trip.hasMany(models.Expense, { foreignKey: 'tripId', as: 'expenses' });
    Trip.hasMany(models.Booking, { foreignKey: 'tripId', as: 'bookings' });
    Trip.hasMany(models.Checklist, { foreignKey: 'tripId', as: 'checklists' });
    Trip.belongsToMany(models.User, { through: models.TripMember, as: 'members' });
  };

  return Trip;
};
