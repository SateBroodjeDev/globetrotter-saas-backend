jest.mock('../../config/database', () => ({
  db: {
    Sequelize: { Op: {} }
  }
}));

const expenseService = require('../expenseService');

describe('expenseService settlement calculations', () => {
  test('calculates minimal transfers from balances', () => {
    const result = expenseService.calculateMinimumTransfers({
      userA: 40,
      userB: -10,
      userC: -30
    });

    expect(result.transfers).toEqual([
      { from: 'userC', to: 'userA', amount: 30 },
      { from: 'userB', to: 'userA', amount: 10 }
    ]);
  });

  test('calculates split balances for equal, percentage and custom splits', () => {
    const balances = expenseService.calculateBalancesFromExpenses([
      {
        paidBy: 'userA',
        convertedEUR: 90,
        splitType: 'equal',
        participants: [{ userId: 'userA' }, { userId: 'userB' }, { userId: 'userC' }]
      },
      {
        paidBy: 'userB',
        convertedEUR: 60,
        splitType: 'percentage',
        participants: [
          { userId: 'userA', share: 50 },
          { userId: 'userB', share: 50 }
        ]
      },
      {
        paidBy: 'userC',
        splitType: 'custom',
        participants: [
          { userId: 'userA', share: 15 },
          { userId: 'userC', share: 15 }
        ],
        amountEur: 30
      }
    ], ['userA', 'userB', 'userC']);

    expect(Number(balances.userA.toFixed(2))).toBe(15);
    expect(Number(balances.userB.toFixed(2))).toBe(0);
    expect(Number(balances.userC.toFixed(2))).toBe(-15);
  });
});
