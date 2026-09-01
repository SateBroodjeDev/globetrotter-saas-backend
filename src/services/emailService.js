const nodemailer = require('nodemailer');
const { Op } = require('sequelize');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    if (process.env.EMAIL_SERVICE === 'sendgrid') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Development: log emails to console
      this.transporter = {
        sendMail: async (opts) => {
          console.log('[📧 Email]', JSON.stringify(opts, null, 2));
          return { messageId: 'dev-' + Date.now() };
        }
      };
    }
  }

  get fromAddress() {
    const name = process.env.EMAIL_FROM_NAME || 'Globetrotter';
    const addr = process.env.EMAIL_FROM || process.env.MAIL_FROM || 'noreply@globetrotter.io';
    return `"${name}" <${addr}>`;
  }

  // Low-level send with optional EmailLog persistence
  async _send(to, subject, html, templateId, variables = {}) {
    const result = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      html
    });

    // Persist to EmailLog when the model is available
    try {
      const { db } = require('../config/database');
      if (db.EmailLog) {
        await db.EmailLog.create({
          to,
          subject,
          templateId,
          variables,
          status: 'sent',
          messageId: result.messageId || null,
          sentAt: new Date()
        });
      }
    } catch {
      // Non-fatal: don't block if DB write fails
    }

    return result;
  }

  // Log a failed email for later retry
  async _logFailure(to, subject, templateId, variables, errorMessage) {
    try {
      const { db } = require('../config/database');
      if (db.EmailLog) {
        await db.EmailLog.create({
          to,
          subject,
          templateId,
          variables,
          status: 'failed',
          error: errorMessage
        });
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Core email methods ───────────────────────────────────────────────────────

  async sendVerificationEmail(email, verificationLink) {
    const subject = 'Welcome to Globetrotter! Please verify your email';
    const html = `
      <h1>Welcome to Globetrotter!</h1>
      <p>Thank you for signing up. Please verify your email address:</p>
      <a href="${encodeURI(verificationLink)}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
        Verify Email
      </a>
      <p>Or copy this link: ${encodeURI(verificationLink)}</p>
      <p>Happy travels! 🌍</p>
    `;
    try {
      return await this._send(email, subject, html, 'verification-email', { verificationLink });
    } catch (error) {
      await this._logFailure(email, subject, 'verification-email', { verificationLink }, error.message);
      throw error;
    }
  }

  async sendPasswordResetEmail(email, resetLink) {
    const subject = 'Password Reset Request';
    const html = `
      <h1>Password Reset</h1>
      <p>You requested a password reset. Click below to continue:</p>
      <a href="${encodeURI(resetLink)}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `;
    try {
      return await this._send(email, subject, html, 'password-reset', { resetLink });
    } catch (error) {
      await this._logFailure(email, subject, 'password-reset', { resetLink }, error.message);
      throw error;
    }
  }

  async sendWorkspaceInvitation(email, workspaceName, invitationLink, invitedByName) {
    const safeWorkspaceName = escapeHtml(workspaceName);
    const safeInvitedByName = escapeHtml(invitedByName || 'your team');
    const subject = `You've been invited to ${safeWorkspaceName} on Globetrotter`;
    const html = `
      <h1>Workspace Invitation</h1>
      <p>${safeInvitedByName} invited you to join <strong>${safeWorkspaceName}</strong> on Globetrotter.</p>
      <a href="${encodeURI(invitationLink)}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
        Accept Invitation
      </a>
      <p>This invitation expires in 7 days.</p>
    `;
    try {
      return await this._send(email, subject, html, 'workspace-invitation', { workspaceName, invitationLink, invitedByName });
    } catch (error) {
      await this._logFailure(email, subject, 'workspace-invitation', { workspaceName, invitationLink, invitedByName }, error.message);
      throw error;
    }
  }

  async sendWelcomeEmail(email, firstName, workspaceName) {
    const safeFirstName = escapeHtml(firstName || 'traveler');
    const safeWorkspaceName = escapeHtml(workspaceName || 'your workspace');
    const subject = 'Welcome to Globetrotter 🌍';
    const html = `
      <h1>Welcome, ${safeFirstName}!</h1>
      <p>Your workspace <strong>${safeWorkspaceName}</strong> is ready.</p>
      <p>Happy travels! 🌍</p>
      <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'welcome', { firstName, workspaceName });
    } catch (error) {
      await this._logFailure(email, subject, 'welcome', { firstName, workspaceName }, error.message);
      throw error;
    }
  }

  async sendWorkspaceAddedEmail(email, workspaceName, invitedByName) {
    const safeWorkspaceName = escapeHtml(workspaceName);
    const safeInvitedByName = escapeHtml(invitedByName || 'your team');
    const subject = `You've been added to ${safeWorkspaceName}`;
    const html = `
      <h1>You've been added to a workspace</h1>
      <p>${safeInvitedByName} added you to <strong>${safeWorkspaceName}</strong>.</p>
      <p><a href="${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}">Go to Globetrotter</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'workspace-added', { workspaceName, invitedByName });
    } catch (error) {
      await this._logFailure(email, subject, 'workspace-added', { workspaceName, invitedByName }, error.message);
      throw error;
    }
  }

  async sendUpgradeSuccessEmail(email, plan) {
    const safePlan = escapeHtml(plan || 'pro');
    const planLabels = { pro: 'Pro', business: 'Business', starter: 'Starter' };
    const planPrices = { pro: '€9.99/month', business: '€99/month', starter: 'Free' };
    const safeLabel = escapeHtml(planLabels[plan] || safePlan);
    const safePrice = escapeHtml(planPrices[plan] || '');
    const subject = `Welcome to Globetrotter ${safeLabel}! 🎉`;
    const html = `
      <h1>Welcome to Globetrotter ${safeLabel}!</h1>
      <p>Thank you for upgrading your plan.</p>
      <p><strong>Your plan:</strong> ${safeLabel}</p>
      <p><strong>Monthly cost:</strong> ${safePrice}</p>
      <p>Your new features are now active. Happy travels! 🌍</p>
      <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'upgrade-success', { plan });
    } catch (error) {
      await this._logFailure(email, subject, 'upgrade-success', { plan }, error.message);
      throw error;
    }
  }

  async sendPaymentReceiptEmail(email, amountPaid, invoiceUrl) {
    const safeAmount = escapeHtml(String(amountPaid));
    const safeUrl = encodeURI(invoiceUrl || '');
    const subject = 'Payment Receipt - Globetrotter';
    const html = `
      <h1>Payment Received</h1>
      <p>Thank you! We received your payment of <strong>€${safeAmount}</strong>.</p>
      ${safeUrl ? `<p><a href="${safeUrl}">View Invoice</a></p>` : ''}
      <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'payment-receipt', { amountPaid, invoiceUrl });
    } catch (error) {
      await this._logFailure(email, subject, 'payment-receipt', { amountPaid, invoiceUrl }, error.message);
      throw error;
    }
  }

  async sendPaymentFailureEmail(email, billingPortalUrl) {
    const safeUrl = encodeURI(billingPortalUrl || '');
    const subject = 'Payment Failed - Action Required';
    const html = `
      <h1>Payment Failed</h1>
      <p>Your recent payment for Globetrotter failed.</p>
      <p>Please update your payment method to avoid service interruption:</p>
      ${safeUrl ? `<a href="${safeUrl}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Update Payment Method</a>` : ''}
      <p>If not updated within 3 days, your subscription will be downgraded.</p>
      <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'payment-failed', { billingPortalUrl });
    } catch (error) {
      await this._logFailure(email, subject, 'payment-failed', { billingPortalUrl }, error.message);
      throw error;
    }
  }

  async sendRoleChangedEmail(email, workspaceId, oldRole, newRole) {
    const safeOld = escapeHtml(oldRole);
    const safeNew = escapeHtml(newRole);
    const dashboardLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/workspace/${workspaceId}`;
    const subject = 'Your workspace role has changed';
    const html = `
      <h1>Role Change Notification</h1>
      <p>Your role in this workspace has been updated.</p>
      <p>Previous role: <strong>${safeOld}</strong></p>
      <p>New role: <strong>${safeNew}</strong></p>
      <p>This change is effective immediately.</p>
      <p><a href="${encodeURI(dashboardLink)}">View Workspace</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'role-changed', { workspaceId, oldRole, newRole });
    } catch (error) {
      await this._logFailure(email, subject, 'role-changed', { workspaceId, oldRole, newRole }, error.message);
      throw error;
    }
  }

  async sendPasswordChangedEmail(email) {
    const subject = 'Your password has been changed';
    const html = `
      <h1>Password Changed</h1>
      <p>Your Globetrotter account password was just changed.</p>
      <p>If this wasn't you, please <a href="${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/forgot-password">reset your password immediately</a>.</p>
    `;
    try {
      return await this._send(email, subject, html, 'password-changed', {});
    } catch (error) {
      await this._logFailure(email, subject, 'password-changed', {}, error.message);
      throw error;
    }
  }

  // ── New notification methods ─────────────────────────────────────────────────

  async sendTripSharedEmail(recipientEmail, sharerName, trip, shareToken) {
    const safeSharerName = escapeHtml(sharerName || 'Someone');
    const safeTripName = escapeHtml(trip.title || 'a trip');
    const viewLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/trip/public/${shareToken}`;
    const subject = `${safeSharerName} shared "${safeTripName}" with you`;
    const html = `
      <h1>${safeSharerName} shared a trip with you!</h1>
      <p><strong>Trip:</strong> ${safeTripName}</p>
      ${trip.startDate ? `<p><strong>Dates:</strong> ${escapeHtml(String(trip.startDate))} - ${escapeHtml(String(trip.endDate || ''))}</p>` : ''}
      ${trip.description ? `<p><strong>Description:</strong> ${escapeHtml(trip.description)}</p>` : ''}
      <p><a href="${encodeURI(viewLink)}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">View Trip</a></p>
      <p><small>No login required to view this trip.</small></p>
    `;
    try {
      return await this._send(recipientEmail, subject, html, 'trip-shared', { sharerName, tripId: trip.id, shareToken });
    } catch (error) {
      await this._logFailure(recipientEmail, subject, 'trip-shared', { sharerName, tripId: trip.id, shareToken }, error.message);
      throw error;
    }
  }

  async sendShareCommentNotificationEmail(recipientEmail, ownerName, trip, share, comment) {
    const safeOwnerName = escapeHtml(ownerName || 'there');
    const safeTripName = escapeHtml(trip?.title || 'your trip');
    const safeVisitorName = escapeHtml(comment?.visitorName || 'A visitor');
    const safeComment = escapeHtml(comment?.comment || '');
    const dashboardLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/workspace/trip-shares.html`;
    const subject = `New comment on ${safeTripName}`;
    const html = `
      <h1>New comment on ${safeTripName}</h1>
      <p>Hi ${safeOwnerName}, ${safeVisitorName} left a new comment on your shared trip.</p>
      ${share?.title ? `<p><strong>Share:</strong> ${escapeHtml(share.title)}</p>` : ''}
      <blockquote style="border-left:4px solid #0ea5e9;padding-left:12px;margin:16px 0;">${safeComment}</blockquote>
      <p><a href="${encodeURI(dashboardLink)}">Review comments</a></p>
    `;

    try {
      return await this._send(recipientEmail, subject, html, 'share-comment-notification', {
        tripId: trip?.id,
        shareId: share?.id,
        commentId: comment?.id
      });
    } catch (error) {
      await this._logFailure(recipientEmail, subject, 'share-comment-notification', {
        tripId: trip?.id,
        shareId: share?.id,
        commentId: comment?.id
      }, error.message);
      throw error;
    }
  }

  async sendExpenseAddedEmail(email, firstName, expense, trip) {
    const safeFirstName = escapeHtml(firstName || 'there');
    const safeTripName = escapeHtml(trip.title || 'your trip');
    const safeDesc = escapeHtml(expense.description || 'Expense');
    const safeAmount = escapeHtml(String(expense.amount || expense.amountEur || 0));
    const safeCurrency = escapeHtml(expense.originalCurrency || 'EUR');
    const dashboardLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/workspace/${trip.workspaceId}`;
    const subject = `New expense in ${safeTripName}: ${safeDesc}`;
    const html = `
      <h1>New expense added</h1>
      <p>Hi ${safeFirstName}, a new expense was added to <strong>${safeTripName}</strong>.</p>
      <p><strong>Description:</strong> ${safeDesc}</p>
      <p><strong>Amount:</strong> ${safeAmount} ${safeCurrency}</p>
      <p><a href="${encodeURI(dashboardLink)}">View Details</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'expense-added', { firstName, expenseId: expense.id, tripId: trip.id });
    } catch (error) {
      await this._logFailure(email, subject, 'expense-added', { firstName, expenseId: expense.id, tripId: trip.id }, error.message);
      throw error;
    }
  }

  async sendSettlementReminderEmail(email, firstName, workspaceName, workspaceId, settlements) {
    const safeFirstName = escapeHtml(firstName || 'there');
    const safeWorkspaceName = escapeHtml(workspaceName || 'your workspace');
    const dashboardLink = `${process.env.FRONTEND_URL || 'https://app.globetrotter.io'}/workspace/${workspaceId}`;
    const settlementRows = settlements.map(s => {
      const amount = escapeHtml(String(s.amount || 0));
      const from = escapeHtml(s.fromName || s.from || 'Someone');
      const to = escapeHtml(s.toName || s.to || 'Someone');
      return `<li>${from} owes ${to} €${amount}</li>`;
    }).join('');
    const subject = `Settlement Update for ${safeWorkspaceName}`;
    const html = `
      <h1>Hi ${safeFirstName}!</h1>
      <p>Here's a settlement summary for <strong>${safeWorkspaceName}</strong>:</p>
      <ul>${settlementRows}</ul>
      <p><a href="${encodeURI(dashboardLink)}">Review &amp; Settle</a></p>
    `;
    try {
      return await this._send(email, subject, html, 'settlement-reminder', { firstName, workspaceName, workspaceId });
    } catch (error) {
      await this._logFailure(email, subject, 'settlement-reminder', { firstName, workspaceName, workspaceId }, error.message);
      throw error;
    }
  }

  async sendAdminAlertEmail(alertType, data) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const safeAlertType = escapeHtml(String(alertType));
    const subject = `[ADMIN ALERT] ${safeAlertType}`;
    const details = Object.entries(data || {})
      .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
      .join('');
    const html = `
      <h1>Admin Alert: ${safeAlertType}</h1>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <ul>${details}</ul>
      <p><a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.globetrotter.io'}">Go to Admin Dashboard</a></p>
    `;
    try {
      return await this._send(adminEmail, subject, html, 'admin-alert', { alertType, ...data });
    } catch (error) {
      console.error('[emailService] Failed to send admin alert:', error.message);
    }
  }

  // ── Batch / cron helpers ─────────────────────────────────────────────────────

  async sendBatchSettlementReminders(workspaceId) {
    const { db } = require('../config/database');
    const workspace = await db.Workspace.findByPk(workspaceId);
    if (!workspace) return;

    const memberships = await db.WorkspaceUser.findAll({
      where: { workspaceId },
      include: [{ model: db.User, attributes: ['id', 'email', 'firstName'] }]
    });

    // Gather all outstanding settlements for the workspace
    const allSettlements = await db.Settlement.findAll({
      where: { workspaceId, status: { [Op.in]: ['pending', 'partial'] } }
    });

    for (const membership of memberships) {
      if (!membership.User) continue;
      const user = membership.User;

      // Check email preferences
      const prefs = await db.EmailPreference.findOne({ where: { userId: user.id } });
      if (prefs && (prefs.settlementReminders === 'off' || prefs.unsubscribedAt)) continue;

      const userSettlements = allSettlements.filter(s => s.fromUserId === user.id || s.toUserId === user.id);
      if (userSettlements.length === 0) continue;

      try {
        await this.sendSettlementReminderEmail(
          user.email,
          user.firstName,
          workspace.name,
          workspaceId,
          userSettlements.map(s => ({
            fromName: s.fromUserId === user.id ? 'You' : s.fromUserId,
            toName: s.toUserId === user.id ? 'You' : s.toUserId,
            amount: s.amount
          }))
        );
      } catch (error) {
        console.error(`[emailService] Settlement reminder failed for ${user.email}:`, error.message);
      }
    }
  }

  async retryFailedEmails() {
    const { db } = require('../config/database');
    if (!db.EmailLog) return;

    const failedEmails = await db.EmailLog.findAll({
      where: {
        status: 'failed',
        retryCount: { [Op.lt]: 3 },
        createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    for (const log of failedEmails) {
      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: log.to,
          subject: log.subject || '(Globetrotter Notification)',
          html: `<p>Retry attempt for template: ${escapeHtml(log.templateId)}</p>`
        });
        await log.update({ status: 'sent', sentAt: new Date(), retryCount: log.retryCount + 1 });
      } catch (error) {
        await log.update({ retryCount: log.retryCount + 1, error: error.message });
      }
    }
  }

  // ── Convenience aliases ──────────────────────────────────────────────────────

  async sendWelcome(user, verificationToken) {
    const verifyUrl = `${process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await this.sendVerificationEmail(user.email, verifyUrl);
    return this.sendWelcomeEmail(user.email, user.firstName, null);
  }

  async sendPasswordReset(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    return this.sendPasswordResetEmail(user.email, resetUrl);
  }

  async sendWorkspaceInvite(email, workspace, inviteToken) {
    const inviteUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000'}/invite?token=${inviteToken}`;
    return this.sendWorkspaceInvitation(email, workspace.name, inviteUrl, 'your team');
  }
}

module.exports = new EmailService();
