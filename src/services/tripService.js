const { db } = require('../config/database');
const slug = require('slug');

async function logTripAudit(action, tripId, workspaceId, userId, changes = {}) {
  try {
    if (db.AuditLog?.create) {
      await db.AuditLog.create({
        action,
        resource: 'Trip',
        resourceId: tripId,
        entityType: 'Trip',
        entityId: tripId,
        changes,
        userId,
        workspaceId,
        status: 'success'
      });
    }
  } catch {
    // Non-fatal
  }
}

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

  async getTrip(tripId, userId) {
    const trip = await db.Trip.findByPk(tripId, {
      include: [
        { association: 'days', order: [['date', 'ASC']] },
        { association: 'expenses', order: [['date', 'DESC']] },
        { association: 'members', through: { attributes: [] } },
        { association: 'creator', attributes: { exclude: ['passwordHash'] } }
      ]
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const member = await db.TripMember.findOne({ where: { tripId, userId } });
    if (!member) {
      const error = new Error('Not a trip member');
      error.statusCode = 403;
      throw error;
    }

    return trip;
  }

  async updateTrip(tripId, userId, updates) {
    const trip = await db.Trip.findByPk(tripId);

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (trip.createdBy !== userId) {
      const error = new Error('Only the trip creator can update this trip');
      error.statusCode = 403;
      throw error;
    }

    const allowedFields = ['title', 'description', 'startDate', 'endDate', 'type', 'destination', 'budget', 'currency', 'status'];
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );

    const updatedTrip = await trip.update(safeUpdates);

    await logTripAudit('trip_updated', tripId, trip.workspaceId, userId, { after: safeUpdates });

    return updatedTrip;
  }

  async deleteTrip(tripId, userId) {
    const trip = await db.Trip.findByPk(tripId);

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (trip.createdBy !== userId) {
      const error = new Error('Only the trip creator can delete this trip');
      error.statusCode = 403;
      throw error;
    }

    await trip.update({ isDeleted: true, deletedAt: new Date() });

    await logTripAudit('trip_deleted', tripId, trip.workspaceId, userId, {});

    return { deleted: true };
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
