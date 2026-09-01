const cron = require('node-cron');
const { Op } = require('sequelize');
const { db } = require('../config/database');
const emailService = require('../services/emailService');

function startEmailJobs() {
  // Send settlement reminders every Monday at 9 AM
  cron.schedule('0 9 * * 1', async () => {
    console.log('[📧 cron] Running settlement reminder job...');
    try {
      const workspaces = await db.Workspace.findAll({
        where: { isDeleted: false, isActive: true }
      });
      for (const workspace of workspaces) {
        try {
          await emailService.sendBatchSettlementReminders(workspace.id);
        } catch (error) {
          console.error(`[📧 cron] Settlement reminder failed for workspace ${workspace.id}:`, error.message);
          await emailService.sendAdminAlertEmail('settlement-reminder-failed', {
            workspaceId: workspace.id,
            error: error.message
          });
        }
      }
    } catch (error) {
      console.error('[📧 cron] Settlement reminder job error:', error.message);
    }
  });

  // Retry failed emails every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[📧 cron] Running email retry job...');
    try {
      await emailService.retryFailedEmails();
    } catch (error) {
      console.error('[📧 cron] Email retry job error:', error.message);
    }
  });

  // Clean old email logs (sent) every month on the 1st at midnight
  cron.schedule('0 0 1 * *', async () => {
    console.log('[📧 cron] Cleaning old email logs...');
    try {
      if (!db.EmailLog) return;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await db.EmailLog.destroy({
        where: {
          createdAt: { [Op.lt]: thirtyDaysAgo },
          status: 'sent'
        }
      });
      console.log(`[📧 cron] Deleted ${deleted} old email log entries`);
    } catch (error) {
      console.error('[📧 cron] Email log cleanup error:', error.message);
    }
  });

  console.log('[📧] Email cron jobs scheduled');
}

module.exports = { startEmailJobs };
