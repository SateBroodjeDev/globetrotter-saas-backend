const nodemailer = require('nodemailer');

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

  async sendVerificationEmail(email, verificationLink) {
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: 'Welcome to Globetrotter! Please verify your email',
      html: `
        <h1>Welcome to Globetrotter!</h1>
        <p>Thank you for signing up. Please verify your email address:</p>
        <a href="${verificationLink}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Verify Email
        </a>
        <p>Or copy this link: ${verificationLink}</p>
        <p>Happy travels! 🌍</p>
      `
    });
  }

  async sendPasswordResetEmail(email, resetLink) {
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click below to continue:</p>
        <a href="${resetLink}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `
    });
  }

  async sendWorkspaceInvitation(email, workspaceName, invitationLink, invitedByName) {
    const safeWorkspaceName = escapeHtml(workspaceName);
    const safeInvitedByName = escapeHtml(invitedByName || 'your team');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: `You've been invited to ${safeWorkspaceName} on Globetrotter`,
      html: `
        <h1>Workspace Invitation</h1>
        <p>${safeInvitedByName} invited you to join <strong>${safeWorkspaceName}</strong> on Globetrotter.</p>
        <a href="${invitationLink}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Accept Invitation
        </a>
      `
    });
  }

  async sendWelcomeEmail(email, firstName, workspaceName) {
    const safeFirstName = escapeHtml(firstName || 'traveler');
    const safeWorkspaceName = escapeHtml(workspaceName || 'your workspace');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: 'Welcome to Globetrotter',
      html: `
        <h1>Welcome, ${safeFirstName}!</h1>
        <p>Your workspace <strong>${safeWorkspaceName}</strong> is ready.</p>
        <p>Happy travels! 🌍</p>
      `
    });
  }

  async sendWorkspaceAddedEmail(email, workspaceName, invitedByName) {
    const safeWorkspaceName = escapeHtml(workspaceName);
    const safeInvitedByName = escapeHtml(invitedByName || 'your team');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: `You've been added to ${safeWorkspaceName}`,
      html: `
        <h1>You've been added to a workspace</h1>
        <p>${safeInvitedByName} added you to <strong>${safeWorkspaceName}</strong>.</p>
      `
    });
  }

  async sendUpgradeSuccessEmail(email, plan) {
    const safePlan = escapeHtml(plan || 'pro');
    const planLabels = { pro: 'Pro', business: 'Business', starter: 'Starter' };
    const planPrices = { pro: '€9.99/month', business: '€99/month', starter: 'Free' };
    const safeLabel = escapeHtml(planLabels[plan] || safePlan);
    const safePrice = escapeHtml(planPrices[plan] || '');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: `Welcome to Globetrotter ${safeLabel}! 🎉`,
      html: `
        <h1>Welcome to Globetrotter ${safeLabel}!</h1>
        <p>Thank you for upgrading your plan.</p>
        <p><strong>Your plan:</strong> ${safeLabel}</p>
        <p><strong>Monthly cost:</strong> ${safePrice}</p>
        <p>Your new features are now active. Happy travels! 🌍</p>
        <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
      `
    });
  }

  async sendPaymentReceiptEmail(email, amountPaid, invoiceUrl) {
    const safeAmount = escapeHtml(String(amountPaid));
    const safeUrl = encodeURI(invoiceUrl || '');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: 'Payment Receipt - Globetrotter',
      html: `
        <h1>Payment Received</h1>
        <p>Thank you! We received your payment of <strong>€${safeAmount}</strong>.</p>
        ${safeUrl ? `<p><a href="${safeUrl}">View Invoice</a></p>` : ''}
        <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
      `
    });
  }

  async sendPaymentFailureEmail(email, billingPortalUrl) {
    const safeUrl = encodeURI(billingPortalUrl || '');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.io'}>`,
      to: email,
      subject: 'Payment Failed - Action Required',
      html: `
        <h1>Payment Failed</h1>
        <p>Your recent payment for Globetrotter failed.</p>
        <p>Please update your payment method to avoid service interruption:</p>
        ${safeUrl ? `<a href="${safeUrl}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Update Payment Method</a>` : ''}
        <p>If not updated within 3 days, your subscription will be downgraded.</p>
        <p>Need help? Contact <a href="mailto:support@globetrotter.io">support@globetrotter.io</a></p>
      `
    });
  }

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
