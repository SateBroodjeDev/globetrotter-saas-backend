const { db } = require('../config/database');
const EXCHANGE_RATES = require('../constants/exchangeRates');

class ExpenseService {
  async createExpense(tripId, expenseData, userId) {
    const trip = await db.Trip.findByPk(tripId);
    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    // Convert to EUR
    const rate = EXCHANGE_RATES[expenseData.currency] || 1;
    const amountEur = expenseData.amount / rate;

    const expense = await db.Expense.create({
      tripId,
      ...expenseData,
      paidBy: userId,
      amountEur,
      exchangeRate: rate
    });

    return expense;
  }

  async calculateBalances(tripId) {
    const trip = await db.Trip.findByPk(tripId, {
      include: {
        association: 'expenses',
        include: { association: 'payer' }
      }
    });

    const members = await trip.getMembers();
    const balances = {};

    members.forEach(m => {
      balances[m.id] = 0;
    });

    // Calculate who owes what
    trip.expenses.forEach(expense => {
      const splitCount = expense.splitBetween.length || members.length;
      const sharePerPerson = expense.amountEur / splitCount;

      // Add to payer's balance
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amountEur;

      // Subtract from each person's balance
      (expense.splitBetween || members.map(m => m.id)).forEach(memberId => {
        balances[memberId] = (balances[memberId] || 0) - sharePerPerson;
      });
    });

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
}

module.exports = new ExpenseService();
