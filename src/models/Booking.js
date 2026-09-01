const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.ENUM('flight', 'hotel', 'rental_car', 'train', 'activity', 'other'),
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },
    bookingReference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'EUR'
    },
    status: {
      type: DataTypes.ENUM('confirmed', 'pending', 'cancelled'),
      defaultValue: 'confirmed'
    },
    document: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Booking.associate = (models) => {
    Booking.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
  };

  return Booking;
};
