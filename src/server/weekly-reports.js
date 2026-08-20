/**
 * ============================================================
 * India Post Dashboard — Node port
 * weekly-reports.js
 * Automated weekly summary report delivery. Generates a digest
 * of dashboard activity for the past 7 days and emails it to
 * admin users. Runs via the daily-jobs cron (fired on Monday
 * mornings by the Worker cron job at 09:05 IST).
 * ============================================================
 */

const auth = require('./auth');
const records = require('./records');
const helpers = require('./helpers');
const { sendMail_ } = require('./mailer');
const { db } = require('./db');
const { CONFIG } = require('./config');

/**
 * Build a 7-day activity summary from the audit log.
 * Returns { newRecords, updatedRecords, deletedRecords, logins, submissions, newUsers }
 */
function buildWeeklyActivity_() {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const auditRows = db.prepare(
    'SELECT * FROM audit WHERE timestamp >= ? ORDER BY timestamp ASC'
  ).all(oneWeekAgo);

  const activity = {
    newRecords: 0,
    updatedRecords: 0,
    deletedRecords: 0,
    logins: 0,
    submissions: 0,
    newUsers: 0,
    reviewDone: 0,
    reviewReopened: 0,
    totalAuditEvents: auditRows.length
  };

  auditRows.forEach(function (row) {
    const action = String(row.action || '').toUpperCase();
    if (action === 'ADD') activity.newRecords++;
    else if (action === 'UPDATE') activity.updatedRecords++;
    else if (action === 'DELETE') activity.deletedRecords++;
    else if (action === 'LOGIN') activity.logins++;
    else if (action === 'REVIEW_DONE') activity.reviewDone++;
    else if (action === 'REVIEW_NOT_DONE') activity.reviewReopened++;
    else if (action === 'USER_ADD') activity.newUsers++;
    else if (action && action.indexOf('SUBMISSION') !== -1) activity.submissions++;
  });

  return activity;
}

/**
 * Build a summary of current dashboard health.
 */
function buildDashboardHealth_() {
  const data = records.getData();
  const items = data.items || [];
  const summary = helpers.buildSummaryFromItems(items);
  const analytics = helpers.buildAnalytics_(items);

  const reviewDueItems = items.filter(function (i) { return i.reviewStatus === 'due'; });
  const overdueItems = reviewDueItems.filter(function (i) {
    const days = helpers.daysUntilDate_(i.reviewDate);
    return days !== null && days < 0;
  });

  return {
    totalRecords: summary.total,
    flagged: summary.flagged,
    normal: summary.normal,
    sectorCount: Object.keys(summary.sectors).length,
    overdueCount: overdueItems.length,
    overdueItems: overdueItems.slice(0, 5).map(function (i) {
      return { id: i.id, sector: i.sector, reviewDate: i.reviewDate };
    })
  };
}

/**
 * Build the email body for the weekly report.
 */
function buildWeeklyEmailBody_(activity, health) {
  const now = new Date();
  const weekEnd = helpers.formatDate_(now, 'dd.MM.yyyy');
  const weekStart = helpers.formatDate_(new Date(now.getTime() - 7 * 86400000), 'dd.MM.yyyy');

  let body = 'WEEKLY DASHBOARD REPORT\n';
  body += 'India Post Dashboard — Circle Office Haryana\n';
  body += 'Period: ' + weekStart + ' to ' + weekEnd + '\n';
  body += '\n';
  body += '=== DASHBOARD HEALTH ===\n';
  body += 'Total records: ' + health.totalRecords + '\n';
  body += 'Review due:    ' + health.flagged + '\n';
  body += 'Normal:        ' + health.normal + '\n';
  body += 'Sectors:       ' + health.sectorCount + '\n';
  body += 'Overdue:       ' + health.overdueCount + '\n';

  if (health.overdueItems.length) {
    body += '\nOverdue records:\n';
    health.overdueItems.forEach(function (item) {
      body += '  #' + item.id + ' (' + item.sector + ') — review was ' + item.reviewDate + '\n';
    });
  }

  body += '\n=== WEEKLY ACTIVITY ===\n';
  body += 'New records:    ' + activity.newRecords + '\n';
  body += 'Updated:        ' + activity.updatedRecords + '\n';
  body += 'Deleted:        ' + activity.deletedRecords + '\n';
  body += 'Reviews done:   ' + activity.reviewDone + '\n';
  body += 'Reviews opened: ' + activity.reviewReopened + '\n';
  body += 'Logins:         ' + activity.logins + '\n';
  body += 'New users:      ' + activity.newUsers + '\n';
  body += 'Submissions:    ' + activity.submissions + '\n';
  body += 'Audit events:   ' + activity.totalAuditEvents + '\n';
  body += '\n---\n';
  body += 'India Post Dashboard — Auto-generated weekly report\n';

  return body;
}

/**
 * Generate and email the weekly report to all admin users.
 * Called by the daily-jobs cron on Monday mornings.
 * @param {string} [token] - Optional auth token (skip auth when called by cron)
 */
function sendWeeklyReport(token) {
  if (token) auth.requireAdmin(token);

  const activity = buildWeeklyActivity_();
  const health = buildDashboardHealth_();
  const body = buildWeeklyEmailBody_(activity, health);

  const now = new Date();
  const subject = 'Weekly Dashboard Report — ' + helpers.formatDate_(now, 'dd.MM.yyyy');

  // Email all admin users
  const users = auth.listUserRecords_();
  let sent = 0;
  const admins = users.filter(function (u) { return u.role === 'ADMIN'; });

  // Always include bootstrap admin
  const bootstrapEmail = (require('./config').ADMIN_USERS[0] || '').toLowerCase();
  const adminEmails = {};
  admins.forEach(function (u) {
    const email = String(u.primaryEmail || u.email || '').toLowerCase().trim();
    if (email) adminEmails[email] = true;
  });
  if (bootstrapEmail) adminEmails[bootstrapEmail] = true;

  Object.keys(adminEmails).forEach(function (email) {
    if (sendMail_(email, subject, body)) sent++;
  });

  return {
    success: true,
    sent: sent,
    period: helpers.formatDate_(new Date(now.getTime() - 7 * 86400000), 'dd.MM.yyyy') + ' — ' + helpers.formatDate_(now, 'dd.MM.yyyy'),
    activity: activity,
    health: health
  };
}

module.exports = {
  buildWeeklyActivity_,
  buildDashboardHealth_,
  sendWeeklyReport
};
