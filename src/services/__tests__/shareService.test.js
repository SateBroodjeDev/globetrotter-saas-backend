jest.mock('../../config/database', () => ({
  db: {
    TripShare: {
      create: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    ShareView: {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    ShareComment: {
      create: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn()
    },
    Trip: {
      findByPk: jest.fn(),
      update: jest.fn()
    },
    User: {
      findByPk: jest.fn()
    },
    TripMember: {
      findOne: jest.fn()
    },
    WorkspaceUser: {
      findOne: jest.fn()
    },
    Day: {},
    Booking: {},
    Expense: {}
  }
}));

jest.mock('../emailService', () => ({
  sendTripSharedEmail: jest.fn(),
  sendShareCommentNotificationEmail: jest.fn()
}));

const shareService = require('../shareService');
const { db } = require('../../config/database');
const emailService = require('../emailService');

describe('shareService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createShare creates a share, normalizes invite emails, and sends invites', async () => {
    const trip = {
      id: 'trip-1',
      title: 'Paris Adventure',
      createdBy: 'user-1',
      update: jest.fn().mockResolvedValue()
    };
    const share = { id: 'share-1', shareToken: 'token-1', tripId: 'trip-1' };

    db.Trip.findByPk.mockResolvedValue(trip);
    db.TripShare.count.mockResolvedValue(0);
    db.TripShare.create.mockResolvedValue(share);
    db.User.findByPk.mockResolvedValue({ email: 'owner@test.com', getFullName: () => 'Owner Name' });

    await shareService.createShare('trip-1', 'user-1', {
      visibility: 'email-list',
      emails: ['Friend@Test.com ', 'friend@test.com'],
      sendEmails: true
    });

    expect(db.TripShare.create).toHaveBeenCalledWith(expect.objectContaining({
      tripId: 'trip-1',
      createdBy: 'user-1',
      visibility: 'email-list',
      allowedEmails: ['friend@test.com'],
      shareToken: expect.any(String)
    }));
    expect(trip.update).toHaveBeenCalledWith(expect.objectContaining({
      shareToken: expect.any(String),
      isPublic: true
    }));
    expect(emailService.sendTripSharedEmail).toHaveBeenCalledWith(
      'friend@test.com',
      'Owner Name',
      trip,
      share.shareToken
    );
  });

  test('createShare rejects email-list shares without allowed emails', async () => {
    db.Trip.findByPk.mockResolvedValue({
      id: 'trip-1',
      title: 'Paris Adventure',
      createdBy: 'user-1',
      update: jest.fn().mockResolvedValue()
    });

    await expect(shareService.createShare('trip-1', 'user-1', {
      visibility: 'email-list',
      emails: []
    })).rejects.toMatchObject({
      code: 'SHARE_EMAILS_REQUIRED'
    });

    expect(db.TripShare.create).not.toHaveBeenCalled();
  });

  test('getPublicTrip returns summary-only expenses when expense details are hidden', async () => {
    db.TripShare.findOne.mockResolvedValue({
      id: 'share-1',
      tripId: 'trip-1',
      createdBy: 'user-1',
      shareToken: 'public-token',
      visibility: 'public',
      title: 'Shared Trip',
      message: 'Take a look',
      allowComments: true,
      allowReactions: true,
      hideExpenseDetails: true,
      hideSettlements: true,
      viewCount: 3,
      uniqueViewers: 2,
      commentCount: 2,
      reactionCount: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: null,
      trip: { workspaceId: 'ws-1' }
    });
    db.Trip.findByPk.mockResolvedValue({
      id: 'trip-1',
      title: 'Paris Adventure',
      description: 'A spring getaway',
      type: 'city_break',
      status: 'planning',
      startDate: new Date('2026-05-01T00:00:00Z'),
      endDate: new Date('2026-05-05T00:00:00Z'),
      coverImage: null,
      budget: '1000.00',
      currency: 'EUR',
      members: [{ id: 'user-1', firstName: 'Alice', lastName: 'Doe', avatar: null }],
      days: [],
      bookings: [],
      expenses: [
        { id: 'exp-1', description: 'Hotel', category: 'hotel', amount: 120, amountEur: 120, convertedEUR: 120, currency: 'EUR', date: new Date('2026-05-02T00:00:00Z'), createdAt: new Date('2026-05-02T00:00:00Z') }
      ]
    });
    db.ShareComment.findAll.mockResolvedValue([
      { id: 'comment-1', visitorName: 'Guest', comment: 'Looks amazing!', createdAt: new Date('2026-05-03T00:00:00Z') }
    ]);

    const result = await shareService.getPublicTrip('public-token');

    expect(result.trip.expenses).toEqual([]);
    expect(result.trip.expenseSummary).toEqual({
      totalSpent: 120,
      expenseCount: 1,
      byCategory: [{ category: 'hotel', amount: 120 }]
    });
    expect(result.share.commentCount).toBe(1);
    expect(result.trip.comments).toHaveLength(1);
  });

  test('getPublicTrip rejects workspace-only shares for anonymous viewers', async () => {
    db.TripShare.findOne.mockResolvedValue({
      id: 'share-2',
      tripId: 'trip-2',
      createdBy: 'owner-1',
      shareToken: 'workspace-only-token',
      visibility: 'workspace-only',
      allowComments: false,
      allowReactions: false,
      hideExpenseDetails: false,
      hideSettlements: true,
      viewCount: 0,
      uniqueViewers: 0,
      commentCount: 0,
      reactionCount: 0,
      createdAt: new Date(),
      expiresAt: null,
      trip: { workspaceId: 'ws-1' }
    });

    await expect(shareService.getPublicTrip('workspace-only-token')).rejects.toMatchObject({
      code: 'SHARE_WORKSPACE_ONLY'
    });
    expect(db.Trip.findByPk).not.toHaveBeenCalled();
  });

  test('recordView increments view metrics and unique viewers for first-time visitors', async () => {
    const share = {
      id: 'share-1',
      isActive: true,
      viewCount: 4,
      uniqueViewers: 2,
      save: jest.fn().mockResolvedValue()
    };
    db.TripShare.findByPk.mockResolvedValue(share);
    db.ShareView.findOne.mockResolvedValue(null);
    db.ShareView.create.mockResolvedValue({ id: 'view-1' });

    const result = await shareService.recordView('share-1', 'visitor-1', { device: 'desktop' });

    expect(db.ShareView.create).toHaveBeenCalledWith(expect.objectContaining({
      shareId: 'share-1',
      visitorId: 'visitor-1',
      device: 'desktop'
    }));
    expect(share.viewCount).toBe(5);
    expect(share.uniqueViewers).toBe(3);
    expect(share.save).toHaveBeenCalled();
    expect(result.view.id).toBe('view-1');
  });

  test('addComment stores a pending comment and sends an owner notification', async () => {
    const share = {
      id: 'share-3',
      tripId: 'trip-3',
      createdBy: 'user-3',
      isActive: true,
      allowComments: true,
      commentCount: 0,
      save: jest.fn().mockResolvedValue()
    };
    const comment = {
      id: 'comment-3',
      visitorName: 'Bob',
      comment: 'Looks fun!'
    };

    db.TripShare.findByPk.mockResolvedValue(share);
    db.ShareComment.create.mockResolvedValue(comment);
    db.User.findByPk.mockResolvedValue({ email: 'owner@test.com', firstName: 'Owner' });
    db.Trip.findByPk.mockResolvedValue({ id: 'trip-3', title: 'Rome Trip' });

    const result = await shareService.addComment('share-3', ' Bob ', 'Guest@Test.com', ' Looks fun! ');

    expect(db.ShareComment.create).toHaveBeenCalledWith(expect.objectContaining({
      shareId: 'share-3',
      visitorName: 'Bob',
      visitorEmail: 'guest@test.com',
      comment: 'Looks fun!',
      isApproved: false
    }));
    expect(share.commentCount).toBe(1);
    expect(emailService.sendShareCommentNotificationEmail).toHaveBeenCalledWith(
      'owner@test.com',
      'Owner',
      { id: 'trip-3', title: 'Rome Trip' },
      share,
      comment
    );
    expect(result).toBe(comment);
  });
});
