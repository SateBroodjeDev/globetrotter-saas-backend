const crypto = require('crypto');
const { Op } = require('sequelize');
const { db } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const emailService = require('./emailService');

class ShareService {
  async createShare(tripId, userId, options = {}) {
    const trip = await this.assertTripAccess(tripId, userId);
    const shareToken = await this.generateUniqueShareToken();
    const allowedEmails = this.normalizeEmails(options.allowedEmails || options.emails);
    const visibility = options.visibility || 'public';

    if (visibility === 'email-list' && allowedEmails.length === 0) {
      throw createError(400, 'Email-restricted shares require at least one allowed email', 'SHARE_EMAILS_REQUIRED');
    }

    const share = await db.TripShare.create({
      tripId,
      createdBy: userId,
      shareToken,
      title: options.title || trip.title,
      message: options.message || null,
      visibility,
      allowedEmails,
      allowComments: options.allowComments !== false,
      allowReactions: options.allowReactions !== false,
      hideExpenseDetails: Boolean(options.hideExpenseDetails),
      hideSettlements: true,
      expiresAt: options.expiresAt ? new Date(options.expiresAt) : null
    });

    await trip.update({ shareToken, isPublic: true });

    if (options.sendEmails && allowedEmails.length > 0) {
      await this.sendShareEmails(share, allowedEmails, userId);
    }

    return share;
  }

  async getPublicTrip(shareToken, viewer = {}) {
    const share = await this.getActiveShareByToken(shareToken);
    await this.assertViewerAccess(share, viewer);

    const trip = await db.Trip.findByPk(share.tripId, {
      include: [
        {
          association: 'members',
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'avatar']
        },
        {
          association: 'expenses',
          attributes: ['id', 'description', 'category', 'amount', 'currency', 'amountEur', 'convertedEUR', 'date', 'createdAt']
        },
        {
          association: 'days',
          attributes: ['id', 'date', 'location', 'activities', 'notes', 'weather']
        },
        {
          association: 'bookings',
          attributes: ['id', 'type', 'provider', 'bookingReference', 'date', 'location', 'price', 'currency', 'status', 'document', 'notes']
        }
      ],
      order: [
        [{ model: db.Day, as: 'days' }, 'date', 'ASC'],
        [{ model: db.Booking, as: 'bookings' }, 'date', 'ASC'],
        [{ model: db.Expense, as: 'expenses' }, 'date', 'ASC']
      ]
    });

    if (!trip || trip.isDeleted) {
      throw createError(404, 'Trip not found', 'TRIP_NOT_FOUND');
    }

    const approvedComments = share.allowComments
      ? await db.ShareComment.findAll({
          where: { shareId: share.id, isApproved: true, isSpam: false },
          order: [['createdAt', 'ASC']],
          attributes: ['id', 'visitorName', 'comment', 'createdAt']
        })
      : [];

    const expenseSummary = this.buildExpenseSummary(trip.expenses || []);
    const expenses = share.hideExpenseDetails
      ? []
      : (trip.expenses || []).map((expense) => ({
          id: expense.id,
          description: expense.description,
          category: expense.category,
          amount: Number(expense.convertedEUR || expense.amountEur || expense.amount || 0),
          currency: 'EUR',
          originalAmount: Number(expense.amount || 0),
          originalCurrency: expense.currency || expense.originalCurrency || 'EUR',
          date: expense.date,
          createdAt: expense.createdAt
        }));

    return {
      share: {
        id: share.id,
        shareToken: share.shareToken,
        title: share.title,
        message: share.message,
        visibility: share.visibility,
        allowComments: share.allowComments,
        allowReactions: share.allowReactions,
        hideExpenseDetails: share.hideExpenseDetails,
        hideSettlements: true,
        viewCount: share.viewCount,
        uniqueViewers: share.uniqueViewers,
        commentCount: approvedComments.length,
        totalCommentCount: share.commentCount,
        reactionCount: share.reactionCount,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt
      },
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        type: trip.type,
        status: trip.status,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverImage: trip.coverImage,
        budget: Number(trip.budget || 0),
        currency: trip.currency,
        members: (trip.members || []).map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          avatar: member.avatar
        })),
        days: trip.days || [],
        bookings: trip.bookings || [],
        expenses,
        expenseSummary,
        comments: approvedComments
      }
    };
  }

  async recordView(shareId, visitorId, metadata = {}) {
    const share = await db.TripShare.findByPk(shareId);
    if (!share || !share.isActive) {
      throw createError(404, 'Share not found', 'SHARE_NOT_FOUND');
    }

    const existingView = await db.ShareView.findOne({ where: { shareId, visitorId } });
    const view = await db.ShareView.create({
      shareId,
      visitorId,
      userAgent: metadata.userAgent || null,
      ipAddress: metadata.ipAddress || null,
      country: metadata.country || null,
      device: metadata.device || null
    });

    share.viewCount += 1;
    if (!existingView) {
      share.uniqueViewers += 1;
    }
    share.lastViewedAt = new Date();
    await share.save();

    return { share, view };
  }

  async updateViewEngagement(shareId, visitorId, updates = {}) {
    const view = await db.ShareView.findOne({
      where: { shareId, visitorId },
      order: [['viewedAt', 'DESC']]
    });

    if (!view) {
      return null;
    }

    const payload = {};
    if (updates.timeSpentSeconds !== undefined) {
      payload.timeSpentSeconds = Math.max(Number(updates.timeSpentSeconds) || 0, view.timeSpentSeconds || 0);
    }
    if (updates.scrollDepth !== undefined) {
      payload.scrollDepth = Math.max(Number(updates.scrollDepth) || 0, view.scrollDepth || 0);
    }
    if (updates.country && !view.country) {
      payload.country = updates.country;
    }
    if (Object.keys(payload).length > 0) {
      await view.update(payload);
    }

    return view;
  }

  async addComment(shareId, visitorName, visitorEmail, comment) {
    const share = await db.TripShare.findByPk(shareId);
    if (!share || !share.isActive || !share.allowComments) {
      throw createError(400, 'Comments not allowed', 'COMMENTS_NOT_ALLOWED');
    }

    if (!String(visitorName || '').trim() || !String(comment || '').trim()) {
      throw createError(400, 'Visitor name and comment are required', 'COMMENT_FIELDS_REQUIRED');
    }

    const shareComment = await db.ShareComment.create({
      shareId,
      visitorName: String(visitorName).trim(),
      visitorEmail: visitorEmail ? String(visitorEmail).trim().toLowerCase() : null,
      comment: String(comment).trim(),
      isApproved: false
    });

    share.commentCount += 1;
    await share.save();

    try {
      const [owner, trip] = await Promise.all([
        db.User.findByPk(share.createdBy),
        db.Trip.findByPk(share.tripId)
      ]);
      if (owner?.email) {
        await emailService.sendShareCommentNotificationEmail(
          owner.email,
          owner.firstName || owner.email,
          trip,
          share,
          shareComment
        );
      }
    } catch (error) {
      console.error('[shareService] Failed to send share comment notification:', error.message);
    }

    return shareComment;
  }

  async getShareAnalytics(shareId, userId) {
    const share = await this.assertShareOwner(shareId, userId);
    const [views, comments] = await Promise.all([
      db.ShareView.findAll({
        where: { shareId },
        order: [['viewedAt', 'DESC']]
      }),
      db.ShareComment.findAll({
        where: { shareId },
        order: [['createdAt', 'DESC']]
      })
    ]);

    return {
      share: {
        id: share.id,
        title: share.title,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        viewCount: share.viewCount,
        uniqueViewers: share.uniqueViewers,
        commentCount: share.commentCount,
        reactionCount: share.reactionCount
      },
      totalViews: share.viewCount,
      uniqueViewers: share.uniqueViewers,
      totalComments: share.commentCount,
      averageTimeSpent: views.length > 0
        ? Math.round(views.reduce((sum, item) => sum + Number(item.timeSpentSeconds || 0), 0) / views.length)
        : 0,
      averageScrollDepth: views.length > 0
        ? Math.round(views.reduce((sum, item) => sum + Number(item.scrollDepth || 0), 0) / views.length)
        : 0,
      topCountries: this.groupBy(views, 'country').sort((a, b) => b.count - a.count).slice(0, 5),
      deviceBreakdown: {
        mobile: views.filter((item) => item.device === 'mobile').length,
        tablet: views.filter((item) => item.device === 'tablet').length,
        desktop: views.filter((item) => item.device === 'desktop').length
      },
      viewsOverTime: this.groupByDate(views, 'viewedAt'),
      recentViews: views.slice(0, 10),
      pendingComments: comments.filter((item) => !item.isApproved && !item.isSpam),
      approvedComments: comments.filter((item) => item.isApproved && !item.isSpam),
      spamComments: comments.filter((item) => item.isSpam)
    };
  }

  async exportShareAnalyticsCsv(shareId, userId) {
    const analytics = await this.getShareAnalytics(shareId, userId);
    const lines = [
      'metric,value',
      `totalViews,${analytics.totalViews}`,
      `uniqueViewers,${analytics.uniqueViewers}`,
      `totalComments,${analytics.totalComments}`,
      `averageTimeSpent,${analytics.averageTimeSpent}`,
      `averageScrollDepth,${analytics.averageScrollDepth}`,
      '',
      'viewedAt,visitorId,country,device,timeSpentSeconds,scrollDepth'
    ];

    analytics.recentViews.forEach((view) => {
      lines.push([
        view.viewedAt ? new Date(view.viewedAt).toISOString() : '',
        this.escapeCsv(view.visitorId),
        this.escapeCsv(view.country || ''),
        this.escapeCsv(view.device || ''),
        Number(view.timeSpentSeconds || 0),
        Number(view.scrollDepth || 0)
      ].join(','));
    });

    return lines.join('\n');
  }

  async updateShare(shareId, userId, updates) {
    const share = await this.assertShareOwner(shareId, userId);
    const payload = {};

    if (updates.title !== undefined) payload.title = updates.title || null;
    if (updates.message !== undefined) payload.message = updates.message || null;
    if (updates.visibility !== undefined) payload.visibility = updates.visibility;
    if (updates.allowComments !== undefined) payload.allowComments = Boolean(updates.allowComments);
    if (updates.allowReactions !== undefined) payload.allowReactions = Boolean(updates.allowReactions);
    if (updates.hideExpenseDetails !== undefined) payload.hideExpenseDetails = Boolean(updates.hideExpenseDetails);
    if (updates.expiresAt !== undefined) payload.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
    if (updates.allowedEmails !== undefined || updates.emails !== undefined) {
      payload.allowedEmails = this.normalizeEmails(updates.allowedEmails || updates.emails);
    }
    if ((payload.visibility || share.visibility) === 'email-list'
      && (payload.allowedEmails || share.allowedEmails).length === 0) {
      throw createError(400, 'Email-restricted shares require at least one allowed email', 'SHARE_EMAILS_REQUIRED');
    }

    await share.update(payload);
    return share;
  }

  async revokeShare(shareId, userId) {
    const share = await this.assertShareOwner(shareId, userId);
    await share.update({ isActive: false });

    const activeShare = await db.TripShare.findOne({
      where: {
        tripId: share.tripId,
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gte]: new Date() } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    await db.Trip.update(
      {
        isPublic: Boolean(activeShare),
        shareToken: activeShare ? activeShare.shareToken : null
      },
      { where: { id: share.tripId } }
    );
  }

  async getUserShares(userId) {
    return db.TripShare.findAll({
      where: { createdBy: userId },
      include: [
        {
          model: db.Trip,
          as: 'trip',
          attributes: ['id', 'workspaceId', 'title', 'startDate', 'endDate', 'coverImage', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getShare(shareId, userId) {
    return this.assertShareOwner(shareId, userId);
  }

  async getShareComments(shareId, userId) {
    await this.assertShareOwner(shareId, userId);
    return db.ShareComment.findAll({
      where: { shareId },
      order: [['createdAt', 'DESC']]
    });
  }

  async approveComment(commentId, userId) {
    const comment = await db.ShareComment.findByPk(commentId, {
      include: [{ model: db.TripShare, as: 'share', attributes: ['id', 'createdBy'] }]
    });

    if (!comment || comment.share.createdBy !== userId) {
      throw createError(403, 'Unauthorized', 'SHARE_UNAUTHORIZED');
    }

    await comment.update({ isApproved: true, isSpam: false });
    return comment;
  }

  async markCommentAsSpam(commentId, userId) {
    const comment = await db.ShareComment.findByPk(commentId, {
      include: [{ model: db.TripShare, as: 'share', attributes: ['id', 'createdBy'] }]
    });

    if (!comment || comment.share.createdBy !== userId) {
      throw createError(403, 'Unauthorized', 'SHARE_UNAUTHORIZED');
    }

    await comment.update({ isSpam: true, isApproved: false });
    return comment;
  }

  async deleteComment(commentId, userId) {
    const comment = await db.ShareComment.findByPk(commentId, {
      include: [{ model: db.TripShare, as: 'share', attributes: ['id', 'createdBy', 'commentCount'] }]
    });

    if (!comment || comment.share.createdBy !== userId) {
      throw createError(403, 'Unauthorized', 'SHARE_UNAUTHORIZED');
    }

    await comment.destroy();

    if (comment.share.commentCount > 0) {
      await comment.share.update({ commentCount: comment.share.commentCount - 1 });
    }
  }

  async getActiveShareByToken(shareToken) {
    const share = await db.TripShare.findOne({
      where: {
        shareToken,
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gte]: new Date() } }
        ]
      },
      include: [{ model: db.Trip, as: 'trip', attributes: ['id', 'workspaceId', 'title'] }]
    });

    if (!share) {
      throw createError(404, 'Share not found or expired', 'SHARE_NOT_FOUND');
    }

    return share;
  }

  async assertTripAccess(tripId, userId) {
    const trip = await db.Trip.findByPk(tripId);
    if (!trip || trip.isDeleted) {
      throw createError(404, 'Trip not found', 'TRIP_NOT_FOUND');
    }

    if (trip.createdBy === userId) {
      return trip;
    }

    const [tripMembership, workspaceMembership] = await Promise.all([
      db.TripMember.findOne({ where: { tripId, userId } }),
      trip.workspaceId
        ? db.WorkspaceUser.findOne({ where: { workspaceId: trip.workspaceId, userId } })
        : null
    ]);

    if (!tripMembership && !workspaceMembership) {
      throw createError(403, 'Access denied', 'TRIP_ACCESS_DENIED');
    }

    return trip;
  }

  async assertShareOwner(shareId, userId) {
    const share = await db.TripShare.findByPk(shareId, {
      include: [{ model: db.Trip, as: 'trip', attributes: ['id', 'title'] }]
    });

    if (!share || share.createdBy !== userId) {
      throw createError(403, 'Unauthorized', 'SHARE_UNAUTHORIZED');
    }

    return share;
  }

  async assertViewerAccess(share, viewer) {
    if (share.createdBy === viewer.userId) {
      return;
    }

    if (share.visibility === 'public') {
      return;
    }

    if (share.visibility === 'workspace-only') {
      if (!viewer.userId) {
        throw createError(403, 'This shared trip is limited to workspace members', 'SHARE_WORKSPACE_ONLY');
      }

      const membership = await db.WorkspaceUser.findOne({
        where: {
          workspaceId: share.trip.workspaceId,
          userId: viewer.userId
        }
      });

      if (!membership) {
        throw createError(403, 'This shared trip is limited to workspace members', 'SHARE_WORKSPACE_ONLY');
      }
      return;
    }

    const allowedEmails = this.normalizeEmails(share.allowedEmails);
    if (!viewer.email || !allowedEmails.includes(String(viewer.email).toLowerCase())) {
      throw createError(403, 'This shared trip is limited to invited email addresses', 'SHARE_EMAIL_RESTRICTED');
    }
  }

  async sendShareEmails(share, emails, senderId) {
    const [sender, trip] = await Promise.all([
      db.User.findByPk(senderId),
      db.Trip.findByPk(share.tripId)
    ]);
    const sharerName = sender?.getFullName?.() || sender?.firstName || sender?.email || 'Someone';

    for (const email of emails) {
      await emailService.sendTripSharedEmail(email, sharerName, trip, share.shareToken);
    }
  }

  async generateUniqueShareToken() {
    let shareToken;
    let exists = true;

    while (exists) {
      shareToken = crypto.randomBytes(32).toString('hex');
      exists = await db.TripShare.count({ where: { shareToken } });
    }

    return shareToken;
  }

  buildExpenseSummary(expenses) {
    const totalSpent = expenses.reduce((sum, expense) => (
      sum + Number(expense.convertedEUR || expense.amountEur || expense.amount || 0)
    ), 0);

    const byCategory = expenses.reduce((acc, expense) => {
      const category = expense.category || 'other';
      acc[category] = (acc[category] || 0) + Number(expense.convertedEUR || expense.amountEur || expense.amount || 0);
      return acc;
    }, {});

    return {
      totalSpent: Number(totalSpent.toFixed(2)),
      expenseCount: expenses.length,
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2))
      }))
    };
  }

  groupBy(items, key) {
    const groups = {};
    items.forEach((item) => {
      const value = item[key] || 'Unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return Object.entries(groups).map(([name, count]) => ({ name, count }));
  }

  groupByDate(items, key) {
    const groups = {};
    items.forEach((item) => {
      const value = item[key] ? new Date(item[key]).toISOString().split('T')[0] : 'Unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return Object.entries(groups).map(([date, count]) => ({ date, count }));
  }

  normalizeEmails(emails) {
    if (!Array.isArray(emails)) {
      return [];
    }

    return [...new Set(
      emails
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
    )];
  }

  escapeCsv(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }
}

module.exports = new ShareService();
