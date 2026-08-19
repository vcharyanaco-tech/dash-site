/**
 * ============================================================
 * India Post Dashboard — Node port
 * index-dispatch.js
 * Pure function map (client arg order) shared by the Express
 * dispatcher (index.js) and enterprise.processOfflineQueue.
 * Each entry: (args) => result | Promise.
 * ============================================================
 */

const auth = require('./auth');
const audit = require('./audit');
const dashboardstudio = require('./dashboardstudio');
const documents = require('./documents');
const enterprise = require('./enterprise');
const notifications = require('./notifications');
const records = require('./records');
const reports = require('./reports');
const submissions = require('./submissions');
const tasks = require('./tasks');
const helpers = require('./helpers');

const A = function (args, n) { return args[n]; };

const dispatch = {
  getServerTime: function (args) { return records.getServerTime(); },

  getAppData: function (args) { return records.getAppData(A(args, 0)); },
  getData: function (args) { return records.getData(); },
  addItem: function (args) { return records.addItem(A(args, 0), A(args, 1)); },
  updateItem: function (args) { return records.updateItem(A(args, 0), A(args, 1)); },
  deleteItem: function (args) { return records.deleteItem(A(args, 0), A(args, 1)); },
  markReviewDone: function (args) { return records.markReviewDone(A(args, 0), A(args, 1)); },
  markReviewNotDone: function (args) { return records.markReviewNotDone(A(args, 0), A(args, 1)); },
  generateReviewNotifications: function (args) { return records.generateReviewNotifications(A(args, 0)); },

  login: function (args) { return auth.login(A(args, 0), A(args, 1)); },
  logout: function (args) { return auth.logout(A(args, 0)); },
  validateSession: function (args) { return auth.validateSession(A(args, 0)); },
  requestPasswordReset: function (args) { return auth.requestPasswordReset(A(args, 0)); },
  changePassword: function (args) { return auth.changePassword(A(args, 0), A(args, 1), A(args, 2)); },

  adminGetUsers: function (args) { return auth.adminGetUsers(A(args, 0)); },
  adminAddUser: function (args) { return auth.adminAddUser(A(args, 0), A(args, 1), A(args, 2), A(args, 3), A(args, 4), A(args, 5), A(args, 6), A(args, 7)); },
  adminUpdateUser: function (args) { return auth.adminUpdateUser(A(args, 0), A(args, 1), A(args, 2)); },
  adminExportUsers: function (args) { return auth.adminExportUsers(A(args, 0)); },
  adminImportUsers: function (args) { return auth.adminImportUsers(A(args, 0), A(args, 1)); },
  adminGetUserActivity: function (args) { return auth.adminGetUserActivity(A(args, 0)); },
  adminDeleteUser: function (args) { return auth.adminDeleteUser(A(args, 0), A(args, 1)); },
  adminResetPassword: function (args) { return auth.adminResetPassword(A(args, 0), A(args, 1), A(args, 2)); },
  adminEmailAllUsers: function (args) { return auth.adminEmailAllUsers(A(args, 0), A(args, 1), A(args, 2)); },
  getAssignableUsers: function (args) { return auth.getAssignableUsers(A(args, 0)); },

  getMyNotifications: function (args) { return notifications.getMyNotifications(A(args, 0)); },
  markNotificationsRead: function (args) { return notifications.markNotificationsRead(A(args, 0), A(args, 1)); },
  clearMyNotifications: function (args) { return notifications.clearMyNotifications(A(args, 0)); },

  getTaskCounts: function (args) { return tasks.getTaskCounts(A(args, 0)); },

  createTask: function (args) { return tasks.createTask(A(args, 0), A(args, 1)); },
  getTasks: function (args) { return tasks.getTasks(A(args, 0), A(args, 1)); },
  getMyTasks: function (args) { return tasks.getMyTasks(A(args, 0)); },
  updateTask: function (args) { return tasks.updateTask(A(args, 0), A(args, 1), A(args, 2)); },
  deleteTask: function (args) { return tasks.deleteTask(A(args, 0), A(args, 1)); },

  getDashboardPreferences: function (args) { return dashboardstudio.getDashboardPreferences(A(args, 0)); },
  saveDashboardPreferences: function (args) { return dashboardstudio.saveDashboardPreferences(A(args, 0), A(args, 1)); },

  getReportTemplates: function (args) { return helpers.getReportTemplates(); },
  getReportData: function (args) { return reports.getReportData(A(args, 1), A(args, 0)); },
  exportToSpreadsheet: function (args) { return reports.exportToSpreadsheet(A(args, 0)); },
  createPdfReport: function (args) { return reports.createPdfReport(A(args, 0)); },
  emailReport: function (args) { return reports.emailReport(A(args, 0), A(args, 1), A(args, 2)); },

  getRecordDocuments: function (args) { return documents.getRecordDocuments(A(args, 0), A(args, 1)); },
  uploadDocument: function (args) { return documents.uploadDocument(A(args, 0), A(args, 1), A(args, 2), A(args, 3), A(args, 4), A(args, 5)); },
  deleteDocument: function (args) { return documents.deleteDocument(A(args, 0), A(args, 1)); },
  setDocumentKeep: function (args) { return documents.setDocumentKeep(A(args, 0), A(args, 1), A(args, 2)); },

  getSubmissions: function (args) { return submissions.getSubmissions(A(args, 0), A(args, 1)); },
  addSubmission: function (args) { return submissions.addSubmission(A(args, 0), A(args, 1), A(args, 2), A(args, 3)); },
  updateSubmission: function (args) { return submissions.updateSubmission(A(args, 0), A(args, 1), A(args, 2)); },
  lockSubmission: function (args) { return submissions.lockSubmission(A(args, 0), A(args, 1)); },
  unlockSubmission: function (args) { return submissions.unlockSubmission(A(args, 0), A(args, 1)); },
  deleteSubmission: function (args) { return submissions.deleteSubmission(A(args, 0), A(args, 1)); },
  markAllSubmissionsRead: function (args) { return submissions.markAllSubmissionsRead(A(args, 0)); },
  toggleSubmissionDisplay: function (args) { return submissions.toggleSubmissionDisplay(A(args, 0), A(args, 1)); },

  getAuditEntries: function (args) { return audit.getAuditEntries(A(args, 0)); },
  adminDeleteAuditRows: function (args) { return audit.adminDeleteAuditRows(A(args, 0), A(args, 1)); },
  adminClearAudit: function (args) { return audit.adminClearAudit(A(args, 0)); },

  exportReviewCalendarIcs: function (args) { return enterprise.exportReviewCalendarIcs(A(args, 0)); },
  sendWhatsAppReviewReminders: function (args) { return enterprise.sendWhatsAppReviewReminders(A(args, 0)); },
  getAiInsights: function (args) { return enterprise.getAiInsights(A(args, 0)); },
  getCardAiInsight: function (args) { return enterprise.getCardAiInsight(A(args, 0), A(args, 1)); },
  getLinkContentAiInsight: function (args) { return enterprise.getLinkContentAiInsight(A(args, 0), A(args, 1)); },
  askLinkAi: function (args) { return enterprise.askLinkAi(A(args, 0), A(args, 1), A(args, 2)); },
  getAllAskLinkHistory: function (args) { return enterprise.getAllAskLinkHistory(A(args, 0)); },
  saveAskLinkHistory: function (args) { return enterprise.saveAskLinkHistory(A(args, 0), A(args, 1), A(args, 2)); },
  processMeetingRecording: function (args) { return enterprise.processMeetingRecording(A(args, 0), A(args, 1)); },
  transcribeMeetingSegment: function (args) { return enterprise.transcribeMeetingSegment(A(args, 0), A(args, 1)); },
  generateMeetingMinutes: function (args) { return enterprise.generateMeetingMinutes(A(args, 0), A(args, 1)); },
  listMeetingFiles: function (args) { return enterprise.listMeetingFiles(A(args, 0)); },
  getMeetingFile: function (args) { return enterprise.getMeetingFile(A(args, 0), A(args, 1)); },
  deleteMeetingFile: function (args) { return enterprise.deleteMeetingFile(A(args, 0), A(args, 1)); },
  getFathomStatus: function (args) { return enterprise.getFathomStatus(A(args, 0)); },
  setFathomApiKey: function (args) { return enterprise.setFathomApiKey(A(args, 0), A(args, 1)); },
  listFathomMeetings: function (args) { return enterprise.listFathomMeetings(A(args, 0), A(args, 1)); },
  getFathomMeetingContent: function (args) { return enterprise.getFathomMeetingContent(A(args, 0), A(args, 1)); },
  getEnterpriseFrontendConfig: function (args) { return enterprise.getEnterpriseFrontendConfig(A(args, 0)); },

  setOpenRouterApiKey: function (args) { return enterprise.setOpenRouterApiKey(A(args, 0), A(args, 1)); },
  setGeminiApiKey: function (args) { return enterprise.setGeminiApiKey(A(args, 0), A(args, 1)); },
  setGroqApiKey: function (args) { return enterprise.setGroqApiKey(A(args, 0), A(args, 1)); },
  setHuggingFaceApiKey: function (args) { return enterprise.setHuggingFaceApiKey(A(args, 0), A(args, 1)); },
  setKiloApiKey: function (args) { return enterprise.setKiloApiKey(A(args, 0), A(args, 1)); },
  setupEnterpriseAddons: function (args) { return enterprise.setupEnterpriseAddons(); },
  installEnterpriseTriggers: function (args) { return enterprise.installEnterpriseTriggers(); },
  validateEnterpriseConfiguration: function (args) { return enterprise.validateEnterpriseConfiguration(); },
  getEnterpriseHealth: function (args) { return enterprise.getEnterpriseHealth(); },

  // Full database backup download (VACUUM'd SQLite copy). Admin only.
  exportFullBackup: function (args) { return require('./full-backup').exportFullBackup(A(args, 0)); },

  // Google Sheet sync (origin spreadsheet <-> SQLite). Admin only.
  adminSyncFromSheet: function (args) {
    auth.requireAdmin(A(args, 0));
    const sync = require('./sync-sheet');
    return sync.pullFromSheet().then(function (pulled) {
      return sync.pushToSheet().then(function (pushed) {
        return { pull: pulled, push: pushed };
      }).catch(function (pushErr) {
        return { pull: pulled, push: { pushed: false, ok: false, reason: (pushErr && pushErr.message) || String(pushErr) } };
      });
    });
  },

  // Computes what a sheet pull WOULD change and returns the preview WITHOUT
  // touching the DB. The admin reviews this (see app.js sync preview modal),
  // then adminSyncFromSheet applies it. Admin only.
  adminPreviewSyncFromSheet: function (args) {
    auth.requireAdmin(A(args, 0));
    return require('./sync-sheet').previewPullFromSheet();
  },

  // Push all DB records back to the spreadsheet. Admin only.
  adminPushToSheet: function (args) {
    auth.requireAdmin(A(args, 0));
    return require('./sync-sheet').pushToSheet();
  },

  // Auto-sync configuration + last run (periodic background sync). Public —
  // non-sensitive operational info (interval + most recent run summary).
  getSyncStatus: function () {
    return require('./auto-sync').getSyncStatus();
  }
};

module.exports = dispatch;
