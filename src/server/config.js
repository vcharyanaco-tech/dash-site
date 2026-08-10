/**
 * ============================================================
 * India Post Dashboard — Node port
 * config.js
 * Global configuration and constants (port of Settings.gs and the
 * various sheet header/column constants from the GAS backend).
 * ============================================================
 */

const CONFIG = Object.freeze({
  SHEET: {
    NAME: 'Sheet1',
    START_ROW: 4,
    NUM_COLS: 7
  },
  TITLE: {
    DEFAULT: 'India Post Dashboard',
    DATE_FORMAT: 'dd.MM.yyyy'
  },
  COLORS: {
    FLAG: '#ffab00',
    REVIEW_DONE: '#c8e6c9',
    NORMAL: '#ffffff',
    BORDER: '#ded9d2',
    PRIMARY: '#da291c',
    SECONDARY: '#004b87'
  },
  CACHE: {
    ENABLED: true,
    TTL: 60
  },
  USERS: {
    SHEET_NAME: 'Users',
    SESSION_TTL_SECONDS: 21600,
    RESET_TTL_MINUTES: 30,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_MINUTES: 15,
    ACTIVITY_LIMIT: 500
  },
  SUBMISSIONS: {
    SHEET_NAME: 'Submissions',
    MAX_TEXT_LENGTH: 5000
  },
  NOTIFICATIONS: {
    SHEET_NAME: 'Notifications',
    MAX_PER_USER: 50
  },
  WORKFLOW: {
    APPROVALS_SHEET_NAME: 'Approvals'
  },
  TASKS: {
    SHEET_NAME: 'Tasks'
  },
  DOCUMENTS: {
    SHEET_NAME: 'Documents'
  },
  LOCK: {
    WAIT_TIME: 30000
  },
  APP: {
    NAME: 'India Post Dashboard',
    VERSION: '1.0.0',
    BRAND: 'India Post'
  }
});

const DATE_FORMAT = Object.freeze({
  DISPLAY: CONFIG.TITLE.DATE_FORMAT,
  SHEET: CONFIG.TITLE.DATE_FORMAT,
  FILE: 'yyyyMMdd'
});

const APP = CONFIG.APP;

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER'
});

const ACTIONS = Object.freeze({
  ADD: 'ADD',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ERROR: 'ERROR',
  AUDIT_DELETE: 'AUDIT_DELETE',
  AUDIT_CLEAR: 'AUDIT_CLEAR',
  LOGIN: 'LOGIN',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  USER_ADD: 'USER_ADD',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_IMPORT: 'USER_IMPORT',
  USER_RESET_PASSWORD: 'USER_RESET_PASSWORD',
  SUBMISSION_ADD: 'SUBMISSION_ADD',
  SUBMISSION_UPDATE: 'SUBMISSION_UPDATE',
  SUBMISSION_LOCK: 'SUBMISSION_LOCK',
  SUBMISSION_UNLOCK: 'SUBMISSION_UNLOCK',
  SUBMISSION_DELETE: 'SUBMISSION_DELETE',
  SUBMISSION_DISPLAY: 'SUBMISSION_DISPLAY',
  SUBMISSION_HIDE: 'SUBMISSION_HIDE',
  REVIEW_DONE: 'REVIEW_DONE',
  REVIEW_NOT_DONE: 'REVIEW_NOT_DONE'
});

const COL = Object.freeze({
  ID: 1,
  SECTOR: 2,
  DESCRIPTION: 3,
  ENTRY_DATE: 4,
  ACTION: 5,
  RESPONSIBILITY: 6,
  REVIEW_DATE: 7
});

const MODULES = Object.freeze({
  RECORDS: 'records',
  SUBMISSIONS: 'submissions',
  AUDIT: 'audit',
  USERS: 'users',
  REPORTS: 'reports',
  SETTINGS: 'settings'
});

const MODULE_ACTIONS = Object.freeze({
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  EXPORT: 'export',
  APPROVE: 'approve'
});

const PERMISSIONS = Object.freeze({
  ADMIN: {
    records: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
    submissions: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
    audit: ['view', 'delete', 'export'],
    users: ['view', 'create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    settings: ['view', 'edit']
  },
  EDITOR: {
    records: ['view', 'create', 'edit', 'export'],
    submissions: ['view', 'create', 'edit', 'export'],
    audit: ['view'],
    users: [],
    reports: ['view', 'export'],
    settings: []
  },
  VIEWER: {
    records: ['view'],
    submissions: ['view', 'create'],
    audit: [],
    users: [],
    reports: ['view'],
    settings: []
  }
});

const USER_GROUPS = Object.freeze({
  APPROVER: {
    label: 'Approver',
    permissions: { records: ['approve'] }
  },
  AUDITOR: {
    label: 'Auditor',
    permissions: { audit: ['view', 'export', 'delete'], users: ['view'] }
  },
  EXPORTER: {
    label: 'Exporter',
    permissions: { records: ['export'], audit: ['export'], reports: ['export'] }
  }
});

const USER_GROUP_KEYS = Object.freeze(Object.keys(USER_GROUPS));

const WORKFLOW_TYPES = Object.freeze({
  RECORD_REVIEW: {
    key: 'RECORD_REVIEW',
    module: MODULES.RECORDS,
    label: 'Record review'
  }
});

const APPROVAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

const PROP = Object.freeze({
  APP_NAME: 'APP_NAME',
  SHEET_NAME: 'SHEET_NAME',
  START_ROW: 'START_ROW',
  LAST_SYNC: 'LAST_SYNC'
});

/* ---------- Auth.gs constants ---------- */

const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

const ADMIN_USERS = ['vcharyanaco@gmail.com'];

const EDITOR_USERS = [];

const VIEWER_USERS = [];

const USER_SHEET_HEADERS = [
  'Email', 'Role', 'Salt', 'PasswordHash', 'MustChange', 'CreatedBy',
  'CreatedAt', 'ResetToken', 'ResetExpires', 'Group', 'Department', 'Office',
  'Preferences', 'ResetRequested', 'Username'
];

const USER_COL = Object.freeze({
  EMAIL: 1,
  ROLE: 2,
  SALT: 3,
  PASSWORD_HASH: 4,
  MUST_CHANGE: 5,
  CREATED_BY: 6,
  CREATED_AT: 7,
  RESET_TOKEN: 8,
  RESET_EXPIRES: 9,
  GROUP: 10,
  DEPARTMENT: 11,
  OFFICE: 12,
  PREFERENCES: 13,
  RESET_REQUESTED: 14,
  USERNAME: 15
});

/* ---------- Tasks.gs constants ---------- */

const TASK_SHEET_HEADERS = ['Id', 'RecordRow', 'RecordId', 'Title', 'Description', 'Assignee', 'Status', 'Priority', 'DueDate', 'CreatedBy', 'CreatedAt', 'UpdatedAt', 'CompletedAt'];

const TASK_COL = Object.freeze({
  ID: 1,
  RECORD_ROW: 2,
  RECORD_ID: 3,
  TITLE: 4,
  DESCRIPTION: 5,
  ASSIGNEE: 6,
  STATUS: 7,
  PRIORITY: 8,
  DUE_DATE: 9,
  CREATED_BY: 10,
  CREATED_AT: 11,
  UPDATED_AT: 12,
  COMPLETED_AT: 13
});

const TASK_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED'
});

const TASK_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
});

/* ---------- Submissions.gs constants ---------- */

const SUBMISSION_HEADERS = ['Id', 'CardRow', 'CardId', 'Email', 'Text', 'CreatedAt', 'UpdatedAt', 'LockedBy', 'LockedAt', 'Displayed'];

const SUBMISSION_COL = Object.freeze({
  ID: 1,
  CARD_ROW: 2,
  CARD_ID: 3,
  EMAIL: 4,
  TEXT: 5,
  CREATED_AT: 6,
  UPDATED_AT: 7,
  LOCKED_BY: 8,
  LOCKED_AT: 9,
  DISPLAYED: 10
});

/* ---------- Notifications.gs constants ---------- */

const NOTIFICATION_SHEET_HEADERS = ['Id', 'Email', 'Type', 'Title', 'Body', 'Link', 'CreatedAt', 'ReadAt'];

const NOTIFICATION_COL = Object.freeze({
  ID: 1,
  EMAIL: 2,
  TYPE: 3,
  TITLE: 4,
  BODY: 5,
  LINK: 6,
  CREATED_AT: 7,
  READ_AT: 8
});

const NOTIFICATION_TYPES = Object.freeze({
  RECORD: 'record',
  SUBMISSION: 'submission',
  USER: 'user',
  SYSTEM: 'system'
});

const NOTIFICATION_RECENT_LIMIT = 30;

/* ---------- Workflow.gs constants ---------- */

const WORKFLOW_SHEET_HEADERS = ['Id', 'Module', 'Type', 'TargetRow', 'TargetId', 'Summary', 'SubmittedBy', 'SubmittedAt', 'Status', 'ReviewedBy', 'ReviewedAt', 'Comment'];

const WORKFLOW_COL = Object.freeze({
  ID: 1,
  MODULE: 2,
  TYPE: 3,
  TARGET_ROW: 4,
  TARGET_ID: 5,
  SUMMARY: 6,
  SUBMITTED_BY: 7,
  SUBMITTED_AT: 8,
  STATUS: 9,
  REVIEWED_BY: 10,
  REVIEWED_AT: 11,
  COMMENT: 12
});

/* ---------- Audit.gs constants ---------- */

const AUDIT_SHEET = 'Audit Log';

/* ---------- Documents.gs constants ---------- */

const DOC_SHEET_HEADERS = ['Id', 'RecordRow', 'RecordId', 'FileName', 'DriveFileId', 'MimeType', 'Size', 'UploadedBy', 'UploadedAt'];

const DOC_COL = Object.freeze({
  ID: 1,
  RECORD_ROW: 2,
  RECORD_ID: 3,
  FILE_NAME: 4,
  DRIVE_FILE_ID: 5,
  MIME_TYPE: 6,
  SIZE: 7,
  UPLOADED_BY: 8,
  UPLOADED_AT: 9
});

/* ---------- DashboardStudio.gs constants ---------- */

const DASHBOARD_PREF_KEYS = Object.freeze({
  VIEW_MODE: 'viewMode',
  COLUMNS: 'columns',
  LAYOUT: 'layout'
});

const VIEW_MODES = Object.freeze({
  CARDS: 'cards',
  TABLE: 'table'
});

const DEFAULT_COLUMNS = Object.freeze({
  id: true,
  sector: true,
  description: true,
  entryDate: true,
  reviewDate: true,
  actions: true
});

/* ---------- Reports.gs constants ---------- */

const REPORT_TEMPLATES = Object.freeze({
  SUMMARY: { key: 'summary', label: 'Summary', description: 'Total, flagged, normal counts and sector breakdown' },
  DETAILED: { key: 'detailed', label: 'Detailed', description: 'All record fields with review status' },
  FLAGGED: { key: 'flagged', label: 'Flagged only', description: 'Only records with review due' }
});

/* ---------- EnterpriseSettings.gs ---------- */

const ENTERPRISE_SETTINGS = Object.freeze({
  PWA: { enabled: true, cacheBuster: '2026.08.07' },
  WHATSAPP: {
    enabled: false,
    apiBaseUrl: 'https://graph.facebook.com/v20.0',
    apiToken: '',
    phoneNumberId: '',
    senderNumber: '',
    templateName: ''
  },
  CALENDAR: { enabled: true, outputSheetName: 'ICS_EXPORT' },
  FATHOM: {
    enabled: true,
    apiBaseUrl: 'https://api.fathom.ai/external/v1',
    apiKey: '',
    maxMeetings: 20
  },
  AI_INSIGHTS: {
    enabled: true,
    provider: 'groq',
    apiKey: '',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    kiloFallback: true,
    dailySummary: { hour: 18, minute: 30 }
  }
});

/* ---------- EnterpriseService.gs constants ---------- */

const ENTERPRISE_AI_DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const ENTERPRISE_AI_OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const ENTERPRISE_AI_GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const ENTERPRISE_AI_HF_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const ENTERPRISE_AI_KILO_ENDPOINT = 'https://api.kilo.ai/api/gateway/chat/completions';
const ENTERPRISE_AI_GROQ_TRANSCRIBE_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const ENTERPRISE_AI_TRANSCRIBE_MODEL = 'whisper-large-v3';
const ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024;
const ENTERPRISE_AI_TRANSCRIPT_MAX_CHARS = 20000;
const ENTERPRISE_AI_MEETING_SYSTEM_PROMPT =
  'You are a review-meeting minute-taker for the India Post Haryana dashboard team. ' +
  'From the meeting transcript, produce STRICT JSON only (no markdown, no code fences, no commentary) with exactly these keys: ' +
  '"summary" (one concise paragraph, string), "decisions" (array of strings), ' +
  '"actionItems" (array of objects, each with "task" string, "assignee" string or empty, ' +
  '"priority" string one of LOW/MEDIUM/HIGH/URGENT, "dueDate" string in dd.mm.yyyy format or empty), ' +
  '"risks" (array of strings). Use empty arrays for anything not present.';
const ENTERPRISE_AI_SYSTEM_PROMPT =
  'You are a concise data-analytics assistant for the India Post Haryana dashboard. ' +
  'The user gives current dashboard summary numbers. Respond ONLY with exactly 3 short bullet ' +
  'points of concrete follow-up actions derived from those numbers. Do not describe India, ' +
  'its geography, history, or culture.';
const ENTERPRISE_AI_RECORD_SYSTEM_PROMPT =
  'You are a concise data-analytics assistant for the India Post Haryana dashboard. ' +
  'The user gives one dashboard record and optionally the text of its linked file. Respond ONLY with exactly 3 short bullet ' +
  'points of concrete follow-up actions derived from that record and link. Do not describe India, ' +
  'its geography, history, or culture.';
const ENTERPRISE_AI_LINK_MAX_CHARS = 25000;
const ENTERPRISE_AI_PREVIEW_MAX_ROWS = 50;
const ENTERPRISE_AI_PREVIEW_MAX_CELLS = 30;
const ENTERPRISE_AI_PREVIEW_MAX_CELL_CHARS = 300;

module.exports = {
  CONFIG,
  DATE_FORMAT,
  APP,
  ROLES,
  ACTIONS,
  COL,
  MODULES,
  MODULE_ACTIONS,
  PERMISSIONS,
  USER_GROUPS,
  USER_GROUP_KEYS,
  WORKFLOW_TYPES,
  APPROVAL_STATUS,
  PROP,
  DEFAULT_ADMIN_PASSWORD,
  ADMIN_USERS,
  EDITOR_USERS,
  VIEWER_USERS,
  USER_SHEET_HEADERS,
  USER_COL,
  TASK_SHEET_HEADERS,
  TASK_COL,
  TASK_STATUS,
  TASK_PRIORITY,
  SUBMISSION_HEADERS,
  SUBMISSION_COL,
  NOTIFICATION_SHEET_HEADERS,
  NOTIFICATION_COL,
  NOTIFICATION_TYPES,
  NOTIFICATION_RECENT_LIMIT,
  WORKFLOW_SHEET_HEADERS,
  WORKFLOW_COL,
  AUDIT_SHEET,
  DOC_SHEET_HEADERS,
  DOC_COL,
  DASHBOARD_PREF_KEYS,
  VIEW_MODES,
  DEFAULT_COLUMNS,
  REPORT_TEMPLATES,
  ENTERPRISE_SETTINGS,
  ENTERPRISE_AI_DEFAULT_ENDPOINT,
  ENTERPRISE_AI_OPENROUTER_ENDPOINT,
  ENTERPRISE_AI_GROQ_ENDPOINT,
  ENTERPRISE_AI_HF_ENDPOINT,
  ENTERPRISE_AI_KILO_ENDPOINT,
  ENTERPRISE_AI_GROQ_TRANSCRIBE_ENDPOINT,
  ENTERPRISE_AI_TRANSCRIBE_MODEL,
  ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES,
  ENTERPRISE_AI_TRANSCRIPT_MAX_CHARS,
  ENTERPRISE_AI_MEETING_SYSTEM_PROMPT,
  ENTERPRISE_AI_SYSTEM_PROMPT,
  ENTERPRISE_AI_RECORD_SYSTEM_PROMPT,
  ENTERPRISE_AI_LINK_MAX_CHARS,
  ENTERPRISE_AI_PREVIEW_MAX_ROWS,
  ENTERPRISE_AI_PREVIEW_MAX_CELLS,
  ENTERPRISE_AI_PREVIEW_MAX_CELL_CHARS
};
