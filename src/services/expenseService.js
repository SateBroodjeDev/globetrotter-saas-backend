const { db } = require('../config/database');
const currencyService = require('./currencyService');
const emailService = require('./emailService');

class ExpenseService {
  static EXPENSE_CATEGORIES = ['food', 'transport', 'hotel', 'activities', 'shopping', 'drinks', 'services', 'other'];

  async assertTripMember(tripId, userId) {
    const membership = await db.TripMember.findOne({
      where: { tripId, userId }
    });

    if (!membership) {
      const error = new Error('Only trip members can manage expenses');
      error.statusCode = 403;
      throw error;
    }
  }

  async createExpense(tripId, expenseData, userId) {
    await this.assertTripMember(tripId, userId);

    const trip = await db.Trip.findByPk(tripId);
    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const splitType = expenseData.splitType || 'equal';
    const participants = this.normalizeParticipants(
      splitType,
      expenseData.participants || expenseData.splitBetween,
      userId
    );
    await this.assertParticipantsAreMembers(tripId, participants.map((participant) => participant.userId));

    const { amount: amountEur, rate } = await currencyService.convertToEUR(
      expenseData.amount,
      expenseData.originalCurrency || expenseData.currency || 'EUR',
      expenseData.date ? String(expenseData.date).slice(0, 10) : null
    );

    const expense = await db.Expense.create({
      tripId,
      ...expenseData,
      paidBy: userId,
      currency: (expenseData.currency || expenseData.originalCurrency || 'EUR').toUpperCase(),
      originalCurrency: (expenseData.originalCurrency || expenseData.currency || 'EUR').toUpperCase(),
      convertedEUR: amountEur,
      amountEur,
      exchangeRate: rate,
      splitType,
      participants,
      splitBetween: participants.map((participant) => participant.userId)
    });

    await this.createAuditLog({
      action: 'expense.created',
      resourceId: expense.id,
      userId,
      workspaceId: trip.workspaceId,
      changes: {
        after: {
          amount: expense.amount,
          originalCurrency: expense.originalCurrency,
          convertedEUR: expense.convertedEUR,
          splitType: expense.splitType
        }
      }
    });

    // Notify other trip members about the new expense (respecting preferences)
    try {
      const members = await db.TripMember.findAll({
        where: { tripId, userId: { [require('sequelize').Op.ne]: userId } },
        include: [{ model: db.User, attributes: ['id', 'email', 'firstName'] }]
      });
      for (const member of members) {
        if (!member.User) continue;
        const prefs = await db.EmailPreference.findOne({ where: { userId: member.User.id } });
        if (prefs && (prefs.expenseNotifications === 'off' || prefs.unsubscribedAt)) continue;
        await emailService.sendExpenseAddedEmail(member.User.email, member.User.firstName, expense, trip)
          .catch(err => console.warn('[expenseService] Failed to send expense notification:', err.message));
      }
    } catch (err) {
      console.warn('[expenseService] Expense notification error:', err.message);
    }

    return expense;
  }

  async assertParticipantsAreMembers(tripId, participantIds = []) {
    if (!participantIds.length) {
      return;
    }

    const uniqueIds = Array.from(new Set(participantIds));
    const members = await db.TripMember.findAll({
      where: { tripId },
      attributes: ['userId']
    });

    const memberIds = new Set(members.map((member) => member.userId));
    const invalidParticipants = uniqueIds.filter((id) => !memberIds.has(id));

    if (invalidParticipants.length) {
      const error = new Error('Participants must be members of the trip');
      error.statusCode = 400;
      throw error;
    }
  }

  normalizeParticipants(splitType, participantsInput = [], fallbackUserId) {
    const rawParticipants = Array.isArray(participantsInput) ? participantsInput : [];
    if (!rawParticipants.length) {
      return [{ userId: fallbackUserId }];
    }

    return rawParticipants.map((participant) => {
      if (typeof participant === 'string') {
        return { userId: participant };
      }

      return {
        userId: participant.userId,
        share: participant.share != null ? Number(participant.share) : undefined
      };
    }).filter((participant) => participant.userId);
  }

  buildExpenseShares(expense, memberIds = []) {
    const amount = Number(expense.convertedEUR || expense.amountEur || 0);
    const participants = Array.isArray(expense.participants) && expense.participants.length
      ? expense.participants
      : (Array.isArray(expense.splitBetween) && expense.splitBetween.length
        ? expense.splitBetween.map((userId) => ({ userId }))
        : memberIds.map((userId) => ({ userId })));

    if (!participants.length || amount <= 0) {
      return [];
    }

    if (expense.splitType === 'percentage') {
      return participants.map((participant) => ({
        userId: participant.userId,
        amount: (amount * Number(participant.share || 0)) / 100
      }));
    }

    if (expense.splitType === 'custom') {
      return participants.map((participant) => ({
        userId: participant.userId,
        amount: Number(participant.share || 0)
      }));
    }

    const sharePerPerson = amount / participants.length;
    return participants.map((participant) => ({
      userId: participant.userId,
      amount: sharePerPerson
    }));
  }

  calculateBalancesFromExpenses(expenses, memberIds = []) {
    const balances = {};
    memberIds.forEach((memberId) => {
      balances[memberId] = 0;
    });

    expenses.forEach((expense) => {
      const convertedAmount = Number(expense.convertedEUR || expense.amountEur || 0);
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + convertedAmount;

      const shares = this.buildExpenseShares(expense, memberIds);
      shares.forEach((share) => {
        balances[share.userId] = (balances[share.userId] || 0) - Number(share.amount);
      });
    });

    return balances;
  }

  async getTripExpenses(tripId, filters = {}, userId) {
    await this.assertTripMember(tripId, userId);

    const where = { tripId, isDeleted: false };
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date[db.Sequelize.Op.gte] = filters.startDate;
      }
      if (filters.endDate) {
        where.date[db.Sequelize.Op.lte] = filters.endDate;
      }
    }
    if (filters.participant) {
      where[db.Sequelize.Op.or] = [
        { splitBetween: { [db.Sequelize.Op.contains]: [filters.participant] } },
        { participants: { [db.Sequelize.Op.contains]: [{ userId: filters.participant }] } }
      ];
    }

    return db.Expense.findAll({
      where,
      include: { association: 'payer', attributes: { exclude: ['passwordHash'] } },
      order: [['date', 'DESC']]
    });
  }

  async getExpenseSummary(tripId, filters = {}, userId) {
    const expenses = await this.getTripExpenses(tripId, filters, userId);
    const categoryTotals = {};
    let total = 0;

    expenses.forEach((expense) => {
      const category = expense.category || 'other';
      const converted = Number(expense.convertedEUR || expense.amountEur || 0);
      categoryTotals[category] = (categoryTotals[category] || 0) + converted;
      total += converted;
    });

    return {
      total: Number(total.toFixed(2)),
      byCategory: Object.fromEntries(
        Object.entries(categoryTotals).map(([category, amount]) => [category, Number(amount.toFixed(2))])
      ),
      count: expenses.length
    };
  }

  async updateExpense(expenseId, updateData, userId) {
    const expense = await db.Expense.findByPk(expenseId);
    if (!expense || expense.isDeleted) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    await this.assertTripMember(expense.tripId, userId);
    const before = expense.toJSON();

    const payload = { ...updateData };

    if (payload.amount != null || payload.currency || payload.originalCurrency || payload.date) {
      const originalCurrency = payload.originalCurrency || payload.currency || expense.originalCurrency || expense.currency;
      const amountValue = payload.amount != null ? payload.amount : expense.amount;
      const conversionDate = (payload.date || expense.date)?.toISOString
        ? (payload.date || expense.date).toISOString().slice(0, 10)
        : String(payload.date || expense.date).slice(0, 10);
      const { amount: convertedAmount, rate } = await currencyService.convertToEUR(
        amountValue,
        originalCurrency,
        conversionDate
      );
      payload.exchangeRate = rate;
      payload.convertedEUR = convertedAmount;
      payload.amountEur = convertedAmount;
      payload.originalCurrency = String(originalCurrency).toUpperCase();
      payload.currency = String(originalCurrency).toUpperCase();
    }

    if (payload.splitType || payload.participants || payload.splitBetween) {
      const splitType = payload.splitType || expense.splitType || 'equal';
      const participants = this.normalizeParticipants(
        splitType,
        payload.participants || payload.splitBetween || expense.participants || expense.splitBetween,
        expense.paidBy
      );
      await this.assertParticipantsAreMembers(expense.tripId, participants.map((participant) => participant.userId));
      payload.splitType = splitType;
      payload.participants = participants;
      payload.splitBetween = participants.map((participant) => participant.userId);
    }

    await expense.update(payload);

    const trip = await db.Trip.findByPk(expense.tripId, { attributes: ['workspaceId'] });
    await this.createAuditLog({
      action: 'expense.updated',
      resourceId: expense.id,
      userId,
      workspaceId: trip?.workspaceId,
      changes: { before, after: expense.toJSON() }
    });

    return expense;
  }

  async deleteExpense(expenseId, userId) {
    const expense = await db.Expense.findByPk(expenseId);
    if (!expense || expense.isDeleted) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    await this.assertTripMember(expense.tripId, userId);
    await expense.update({ isDeleted: true });

    const trip = await db.Trip.findByPk(expense.tripId, { attributes: ['workspaceId'] });
    await this.createAuditLog({
      action: 'expense.deleted',
      resourceId: expense.id,
      userId,
      workspaceId: trip?.workspaceId,
      changes: { after: { isDeleted: true } }
    });
  }

  async getReceipt(expenseId, userId) {
    const expense = await db.Expense.findByPk(expenseId);
    if (!expense || expense.isDeleted) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    await this.assertTripMember(expense.tripId, userId);
    return expense.receipt || null;
  }

  async calculateBalances(tripId, userId = null) {
    if (userId) {
      await this.assertTripMember(tripId, userId);
    }

    const trip = await db.Trip.findByPk(tripId, {
      include: {
        association: 'expenses',
        include: { association: 'payer' },
        where: { isDeleted: false },
        required: false
      }
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const members = await trip.getMembers();
    const memberIds = members.map((member) => member.id);
    const balances = this.calculateBalancesFromExpenses(trip.expenses || [], memberIds);

    return this.calculateMinimumTransfers(balances);
  }

  calculateMinimumTransfers(balances) {
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
      if (balance < -0.01) {
        debtors.push({ userId, amount: Math.abs(balance) });
      } else if (balance > 0.01) {
        creditors.push({ userId, amount: balance });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const transfer = Math.min(debtors[i].amount, creditors[j].amount);

      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: parseFloat(transfer.toFixed(2))
      });

      debtors[i].amount -= transfer;
      creditors[j].amount -= transfer;

      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    return { balances, transfers };
  }

  async createAuditLog({ action, resourceId, userId, workspaceId = null, changes = null, status = 'success' }) {
    if (!db.AuditLog || !userId) {
      return;
    }

    await db.AuditLog.create({
      action,
      resource: 'expense',
      resourceId,
      userId,
      workspaceId,
      changes,
      status
    });
  }
}

module.exports = new ExpenseService();
