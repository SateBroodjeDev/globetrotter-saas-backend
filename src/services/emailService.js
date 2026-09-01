const nodemailer = require('nodemailer');
const logger = require('./loggerService');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else {
    // Fallback: log to console (dev / no email configured)
    transporter = {
      sendMail: async (opts) => {
        logger.info('[EmailService] Would send email', { to: opts.to, subject: opts.subject });
        return { messageId: 'dev-noop' };
      }
    };
  }

  return transporter;
}

class EmailService {
  async sendVerificationEmail(to, token) {
    const url = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/verify-email/${token}`;
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || 'noreply@globetrotter.nl',
      to,
      subject: 'Verifieer je e-mailadres – Globetrotter',
      html: `<p>Klik op de link om je account te bevestigen:</p><p><a href="${url}">${url}</a></p>`
    });
    logger.info('[EmailService] Verification email sent', { to });
  }

  async sendPasswordResetEmail(to, token) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || 'noreply@globetrotter.nl',
      to,
      subject: 'Wachtwoord opnieuw instellen – Globetrotter',
      html: `<p>Klik op de link om je wachtwoord te resetten (geldig 1 uur):</p><p><a href="${url}">${url}</a></p>`
    });
    logger.info('[EmailService] Password reset email sent', { to });
  }

  async sendWelcomeEmail(to, firstName) {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || 'noreply@globetrotter.nl',
      to,
      subject: `Welkom bij Globetrotter, ${firstName}!`,
      html: `<p>Hoi ${firstName}, welkom op Globetrotter! 🌍</p><p>Je account is aangemaakt en klaar voor gebruik.</p>`
    });
  }
}

module.exports = new EmailService();
