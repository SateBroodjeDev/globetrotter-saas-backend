const { db } = require('../config/database');
const slug = require('slug');

class TripService {
  async createTrip(workspaceId, userId, tripData) {
    const tripSlug = `${slug(tripData.title)}-${Date.now()}`;

    const trip = await db.Trip.create({
      ...tripData,
      slug: tripSlug,
      workspaceId,
      createdBy: userId,
      startDate: new Date(tripData.startDate),
      endDate: new Date(tripData.endDate)
    });

    // Add creator as trip member
    await db.TripMember.create({
      tripId: trip.id,
      userId,
      role: 'organizer'
    });

    return trip;
  }

  async addDay(tripId, dayData) {
    const trip = await db.Trip.findByPk(tripId);
    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const day = await db.Day.create({
      tripId,
      date: new Date(dayData.date),
      location: dayData.location,
      activities: dayData.activities || [],
      notes: dayData.notes
    });

    return day;
  }

  async getTripsStats(workspaceId) {
    const trips = await db.Trip.findAll({
      where: { workspaceId, isDeleted: false }
    });

    const stats = {
      totalTrips: trips.length,
      ongoingTrips: trips.filter(t => t.status === 'ongoing').length,
      plannedTrips: trips.filter(t => t.status === 'planning').length,
      completedTrips: trips.filter(t => t.status === 'completed').length,
      totalBudget: trips.reduce((sum, t) => sum + (parseFloat(t.budget) || 0), 0)
    };

    return stats;
  }

  async generateShareToken(tripId) {
    const trip = await db.Trip.findByPk(tripId);
    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const shareToken = require('crypto').randomBytes(16).toString('hex');
    await trip.update({ shareToken });

    return shareToken;
  }
}

module.exports = new TripService();
