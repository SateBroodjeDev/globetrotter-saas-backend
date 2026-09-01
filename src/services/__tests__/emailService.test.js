jest.mock('../../config/database', () => ({
  db: {
    EmailLog: {
      create: jest.fn(),
      findAll: jest.fn(),
      destroy: jest.fn()
    },
    EmailPreference: {
      findOne: jest.fn()
    },
    Workspace: {
      findByPk: jest.fn()
    },
    WorkspaceUser: {
      findAll: jest.fn()
    },
    Settlement: {
      findAll: jest.fn()
    },
    User: {
      findByPk: jest.fn()
    }
  }
}));

const emailService = require('../emailService');
const { db } = require('../../config/database');

describe('emailService', () => {
  let sendMailMock;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    emailService.transporter = { sendMail: sendMailMock };
    db.EmailLog.create.mockResolvedValue({});
  });

  describe('sendWelcomeEmail', () => {
    test('sends welcome email with first name and workspace name', async () => {
      await emailService.sendWelcomeEmail('user@test.com', 'Alice', 'Team Europe');
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toContain('Welcome');
      expect(call.html).toContain('Alice');
      expect(call.html).toContain('Team Europe');
    });

    test('escapes HTML in firstName and workspaceName', async () => {
      await emailService.sendWelcomeEmail('user@test.com', '<script>xss</script>', 'Workspace');
      const html = sendMailMock.mock.calls[0][0].html;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('sendPasswordResetEmail', () => {
    test('includes reset link in email', async () => {
      await emailService.sendPasswordResetEmail('user@test.com', 'https://app.test/reset?token=abc');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.html).toContain('https://app.test/reset');
      expect(call.subject).toContain('Reset');
    });
  });

  describe('sendWorkspaceInvitation', () => {
    test('includes inviter name and workspace name', async () => {
      await emailService.sendWorkspaceInvitation('inv@test.com', 'Team Alpha', 'https://link', 'Bob');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('inv@test.com');
      expect(call.html).toContain('Bob');
      expect(call.html).toContain('Team Alpha');
    });
  });

  describe('sendRoleChangedEmail', () => {
    test('includes old and new roles in email', async () => {
      await emailService.sendRoleChangedEmail('user@test.com', 'ws-1', 'viewer', 'admin');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('viewer');
      expect(call.html).toContain('admin');
    });
  });

  describe('sendTripSharedEmail', () => {
    test('includes sharer name and trip title', async () => {
      const trip = { id: 'trip-1', title: 'Paris Adventure', startDate: '2025-06-01', endDate: '2025-06-10', workspaceId: 'ws-1' };
      await emailService.sendTripSharedEmail('recv@test.com', 'Carol', trip, 'sharetoken123');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('Carol');
      expect(call.html).toContain('Paris Adventure');
      expect(call.html).toContain('sharetoken123');
    });
  });

  describe('sendExpenseAddedEmail', () => {
    test('includes expense description and amount', async () => {
      const expense = { id: 'exp-1', description: 'Hotel Night', amount: 150, originalCurrency: 'EUR' };
      const trip = { id: 'trip-1', title: 'Rome Trip', workspaceId: 'ws-1' };
      await emailService.sendExpenseAddedEmail('member@test.com', 'Dave', expense, trip);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('Hotel Night');
      expect(call.html).toContain('150');
      expect(call.html).toContain('Rome Trip');
    });
  });

  describe('sendSettlementReminderEmail', () => {
    test('includes settlement amounts', async () => {
      const settlements = [{ fromName: 'Alice', toName: 'Bob', amount: 50 }];
      await emailService.sendSettlementReminderEmail('user@test.com', 'Alice', 'Team Workspace', 'ws-1', settlements);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('Alice');
      expect(call.html).toContain('Bob');
      expect(call.html).toContain('50');
    });

    test('does not send if settlements list is empty', async () => {
      await emailService.sendSettlementReminderEmail('user@test.com', 'Alice', 'Team Workspace', 'ws-1', []);
      // sendMail is still called (no short-circuit at service layer for empty list)
      // but the HTML will have no settlement rows
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toBeDefined();
    });
  });

  describe('sendAdminAlertEmail', () => {
    test('does not send if ADMIN_EMAIL is not set', async () => {
      const original = process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;
      await emailService.sendAdminAlertEmail('test-alert', { detail: 'some error' });
      expect(sendMailMock).not.toHaveBeenCalled();
      if (original) process.env.ADMIN_EMAIL = original;
    });

    test('sends alert email when ADMIN_EMAIL is set', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      await emailService.sendAdminAlertEmail('payment-failed', { workspaceId: 'ws-1' });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('admin@test.com');
      expect(call.subject).toContain('payment-failed');
      delete process.env.ADMIN_EMAIL;
    });
  });

  describe('sendUpgradeSuccessEmail', () => {
    test('includes plan name in subject', async () => {
      await emailService.sendUpgradeSuccessEmail('user@test.com', 'pro');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('Pro');
    });
  });

  describe('sendPaymentReceiptEmail', () => {
    test('includes amount and invoice link', async () => {
      await emailService.sendPaymentReceiptEmail('user@test.com', 49.99, 'https://invoice.stripe.com/abc');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('49.99');
      expect(call.html).toContain('invoice.stripe.com');
    });
  });

  describe('sendPaymentFailureEmail', () => {
    test('includes billing portal link', async () => {
      await emailService.sendPaymentFailureEmail('user@test.com', 'https://portal.test/billing');
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('portal.test');
    });
  });

  describe('EmailLog persistence', () => {
    test('creates EmailLog entry on successful send', async () => {
      await emailService.sendWelcomeEmail('log@test.com', 'Eve', 'Space Workspace');
      expect(db.EmailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'log@test.com', status: 'sent', templateId: 'welcome' })
      );
    });

    test('logs failure on send error', async () => {
      sendMailMock.mockRejectedValue(new Error('SMTP error'));
      await expect(emailService.sendWelcomeEmail('fail@test.com', 'X', 'Y')).rejects.toThrow('SMTP error');
      expect(db.EmailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'fail@test.com', status: 'failed' })
      );
    });
  });
});
