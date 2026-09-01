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

  async sendWelcome(user, verificationToken) {
    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const safeFirstName = escapeHtml(user.firstName || 'traveler');
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.nl'}>`,
      to: user.email,
      subject: 'Welcome to Globetrotter! Please verify your email',
      html: `
        <h1>Welcome, ${safeFirstName}!</h1>
        <p>Thank you for signing up. Please verify your email address:</p>
        <a href="${verifyUrl}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Verify Email
        </a>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>Happy travels! 🌍</p>
      `
    });
  }

  async sendPasswordReset(user, resetToken) {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.nl'}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click below to continue:</p>
        <a href="${resetUrl}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `
    });
  }

  async sendWorkspaceInvite(email, workspace, inviteToken) {
    const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/invite?token=${inviteToken}`;
    const safeWorkspaceName = escapeHtml(workspace.name);
    return this.transporter.sendMail({
      from: `"Globetrotter" <${process.env.EMAIL_FROM || 'noreply@globetrotter.nl'}>`,
      to: email,
      subject: `You've been invited to ${safeWorkspaceName} on Globetrotter`,
      html: `
        <h1>Workspace Invitation</h1>
        <p>You've been invited to join <strong>${safeWorkspaceName}</strong> on Globetrotter.</p>
        <a href="${inviteUrl}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Accept Invitation
        </a>
      `
    });
  }
}

module.exports = new EmailService();
