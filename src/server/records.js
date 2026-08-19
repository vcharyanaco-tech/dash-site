/**
 * ============================================================
 * India Post Dashboard — Node port
 * records.js
 * Dashboard read/transform + record CRUD (port of code.gs,
 * RecordService.gs, DashboardService.gs and Data.gs against the
 * 'records' table).
 * ============================================================
 */

const { db, getAppSettings, cacheGetTTL, cachePut } = require('./db');
const { CONFIG, ROLES, COL, ACTIONS } = require('./config');
const {
  now_, today_, formatDate_, parseDisplayDate_, daysUntilDate_,
  escHtml_, looksLikeUrl_, linkifyText_, absUrl_,
  normalizeItemForSheet_, buildSummaryFromItems, buildAnalytics_,
  runWithLock_
} = require('./helpers');
const auth = require('./auth');

const HEADERS = ['ID', 'Sector', 'Description', 'Entry Date', 'Action', 'Responsibility', 'Review Date'];
const FIELD_KEYS = ['id', 'sector', 'description', 'entryDate', 'action', 'responsibility', 'reviewDate'];

/* ============================================================
 * Data cache (in-memory; cleared on every write)
 * ============================================================ */

let dataCache = null;

/* Notify all Divisional Head users (do_* username) when a record with
   'All Divisional Heads' responsibility is created or updated. */
function notifyDivisionalHeads_(type, title, body, link, excludeEmail) {
  const exclude = String(excludeEmail || '').toLowerCase().trim();
  const emails = auth.getDivisionalHeadEmails_();
  const notify = require('./notifications');
  emails.forEach(function (email) {
    if (exclude && email === exclude) return;
    try { notify.notify_(email, type, title, body, link); } catch (err) {}
  });
}

function bumpDataGeneration_() {
  dataCache = null;
  // Persist promptly: the KV bridge snapshot is what Render restores on the
  // next boot, so a write (new record, edit, link, delete) must reach KV
  // within seconds, not up to the 10-min auto-sync interval.
  try { require('./data-sync').requestBackup(); } catch (e) {}
}

/* ============================================================
 * Title
 * ============================================================ */

function stampTitle_() {
  const today = today_();
  const settings = getAppSettings();
  let heading = settings.appName || CONFIG.APP.NAME;
  const full = heading + ' on ' + today;
  return { full: full, heading: heading, asOf: today };
}

function getTitle_() {
  return stampTitle_().full;
}

/* ============================================================
 * Review status helpers
 * ============================================================ */

function isFlaggedBackground_(background) {
  if (!background) return false;
  const colour = String(background).toLowerCase();
  return colour !== '#ffffff' && colour !== '';
}

function isReviewDoneBackground_(background) {
  if (!background) return false;
  const hex = String(background).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return g >= 150 && g > r + 20 && g > b + 20;
}

function reviewStatusForRow_(row) {
  const bg = row.reviewBg || row.review_bg || CONFIG.COLORS.NORMAL;
  let status = isReviewDoneBackground_(bg)
    ? 'done'
    : (isFlaggedBackground_(bg) ? 'due' : '');
  const reviewDate = row.reviewDate || row.review_date;
  if (status !== 'done' && reviewDate) {
    const days = daysUntilDate_(reviewDate);
    if (days !== null && days <= 1) status = 'due';
  }
  return status;
}

/* ============================================================
 * Link helpers
 * ============================================================ */

// A field's links can be stored as a single link object ({url, text}) — the
// original one-link-per-field format — or as an array of them (the multi-link
// format). Normalize any input to an array of {url, text}.
function normalizeLinksField_(value) {
  if (Array.isArray(value)) {
    return value
      .filter(function (l) { return l && l.url; })
      .map(function (l) {
        return { url: String(l.url || ''), text: l.text != null ? String(l.text) : '' };
      });
  }
  if (value && typeof value === 'object' && value.url) {
    return [{ url: String(value.url), text: value.text != null ? String(value.text) : '' }];
  }
  return [];
}

// Normalizes the whole links object ({fieldKey: value|array}) to the array
// form, dropping empty fields. Used both when reading rows and before storing.
function normalizeLinksForStorage_(links) {
  const out = {};
  if (!links || typeof links !== 'object') return out;
  Object.keys(links).forEach(function (key) {
    const normalized = normalizeLinksField_(links[key]);
    if (normalized.length) out[key] = normalized;
  });
  return out;
}

function parseLinksRow_(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

// Older clients appended the link display text to the field value; drop a
// trailing occurrence so the text isn't duplicated next to the hyperlink.
function stripTrailingLinkText_(value, linkText) {
  const s = String(value == null ? '' : value);
  const t = String(linkText || '').trim();
  if (!s || !t) return s;
  const trimmed = s.replace(/\s+$/, '');
  if (trimmed.endsWith(t)) {
    return trimmed.slice(0, trimmed.length - t.length).replace(/\s+$/, '');
  }
  return s;
}

// Renders a field value plus its hyperlink list. Each link is shown on its
// own line with a blank line (one line space) between consecutive links, and
// the field's own text is separated from the first link by a blank line too.
function fieldHtml_(value, linkValue) {
  const links = normalizeLinksField_(linkValue);
  if (links.length) {
    const textHtml = linkifyText_(stripTrailingLinkText_(value, links[0].text || ''));
    const linksHtml = links.map(function (link) {
      const url = absUrl_(link.url);
      if (!url) return '';
      const text = String(link.text || '').trim() || String(value || '');
      return '<a href="' + escHtml_(url) + '" target="_blank" rel="noopener noreferrer" data-embed="1">' + escHtml_(text) + '</a>';
    }).filter(Boolean).join('<br><br>');
    return (textHtml ? textHtml + '<br><br>' : '') + linksHtml;
  }
  return linkifyText_(value);
}

/* ============================================================
 * Row -> item (port of DashboardService.buildDashboardItems_)
 * ============================================================ */

function rowToRowSpec_(row) {
  return {
    rowNumber: Number(row.row),
    idRaw: row.row - CONFIG.SHEET.START_ROW + 1,
    sector: row.sector || '',
    description: row.description || '',
    entryDate: row.entry_date || '',
    action: row.action || '',
    responsibility: row.responsibility || '',
    reviewDate: row.review_date || '',
    reviewBg: row.review_bg || CONFIG.COLORS.NORMAL,
    links: normalizeLinksForStorage_(parseLinksRow_(row.links))
  };
}

function buildItemFromRowSpec_(rowSpec) {
  const reviewStatus = reviewStatusForRow_(rowSpec);
  const flagged = reviewStatus === 'due';

  let actionHtml = escHtml_(rowSpec.action);
  const values = [
    rowSpec.idRaw,
    rowSpec.sector,
    rowSpec.description,
    rowSpec.entryDate,
    rowSpec.action,
    rowSpec.responsibility,
    rowSpec.reviewDate
  ];
  const labels = HEADERS;

  const displayFields = labels.map(function (label, i) {
    const value = values[i];
    const normalizedLabel = label.toLowerCase();
    const linkObj = rowSpec.links[FIELD_KEYS[i]];
    let formattedValue = value;
    if (normalizedLabel.indexOf('date') !== -1 && value !== '') {
      formattedValue = formatDate_(value);
    }
    let fieldHtml = '';
    if (normalizedLabel.indexOf('date') === -1) {
      const hasLink = normalizeLinksField_(linkObj).length > 0;
      if (hasLink) {
        fieldHtml = fieldHtml_(formattedValue, linkObj);
      } else if (looksLikeUrl_(formattedValue)) {
        fieldHtml = linkifyText_(formattedValue);
      }
    }
    if (normalizedLabel.indexOf('action') !== -1 && fieldHtml) {
      actionHtml = fieldHtml;
    }
    return { label: label, value: formattedValue, html: fieldHtml };
  });

  const linkUrls = {};
  const linkTexts = {};
  FIELD_KEYS.forEach(function (key) {
    const list = rowSpec.links[key] || [];
    if (list.length) {
      // First link kept in the legacy per-field shape for AI-insight and
      // older client code; the full list rides along in `links`.
      linkUrls[key] = String(list[0].url);
      if (list[0].text) linkTexts[key] = String(list[0].text);
    }
  });

  return {
    row: rowSpec.rowNumber,
    id: rowSpec.idRaw,
    sector: rowSpec.sector,
    description: rowSpec.description,
    entryDate: formatDate_(rowSpec.entryDate),
    action: rowSpec.action,
    actionHtml: actionHtml,
    responsibility: rowSpec.responsibility,
    reviewDate: formatDate_(rowSpec.reviewDate),
    flagged: flagged,
    reviewStatus: reviewStatus,
    displayFields: displayFields,
    linkUrls: linkUrls,
    linkTexts: linkTexts,
    // Full per-field link list (array form) for multi-link editing.
    links: rowSpec.links
  };
}

function buildItems(rows) {
  return rows.map(rowToRowSpec_).map(buildItemFromRowSpec_);
}

/* ============================================================
 * getData (port of code.gs getData)
 * ============================================================ */

function getAuditDerivedRows_() {
  const rows = db.prepare('SELECT * FROM audit').all();
  const out = [];
  rows.forEach(function (r, idx) {
    const action = String(r.action || '').toLowerCase();
    const details = r.details || '';
    if (action === 'add' || action === 'added' || (details && String(details).trim().charAt(0) === '{')) {
      try {
        const obj = typeof details === 'string' ? JSON.parse(details) : details;
        out.push({
          rowNumber: 0,
          id: obj.id || obj.ID || idx + 1,
          sector: obj.sector || obj.Sector || '',
          description: obj.description || obj.Description || '',
          entryDate: obj.entryDate || obj.EntryDate || '',
          action: obj.action || obj.Action || '',
          responsibility: obj.responsibility || obj.Responsibility || '',
          reviewDate: obj.reviewDate || obj.ReviewDate || ''
        });
      } catch (err) {
        // ignore
      }
    }
  });
  return out;
}

function getData() {
  if (dataCache) return dataCache;

  const title = stampTitle_();

  const rows = db.prepare('SELECT * FROM records ORDER BY row ASC').all();
  let items = [];
  if (rows.length) {
    items = buildItems(rows);
  } else {
    // Fallback: derive items from audit ADD rows (matches GAS behaviour).
    const derived = getAuditDerivedRows_();
    if (derived.length) {
      const statuses = {};
      items = derived.map(function (d) {
        const reviewStatus = statuses[String(d.rowNumber)] || '';
        return {
          row: 0,
          id: d.id,
          sector: d.sector,
          description: d.description,
          entryDate: formatDate_(d.entryDate),
          action: d.action,
          actionHtml: escHtml_(d.action),
          responsibility: d.responsibility,
          reviewDate: formatDate_(d.reviewDate),
          flagged: false,
          reviewStatus: reviewStatus,
          displayFields: [],
          linkUrls: {},
          linkTexts: {},
          links: {}
        };
      });
    }
  }

  const result = {
    title: title.full,
    heading: title.heading,
    asOf: title.asOf,
    items: items
  };
  dataCache = result;
  return result;
}

/* ============================================================
 * Scoping / responsibilities / reminders
 * ============================================================ */

function scopeItemsForUser_(items, user) {
  return items;
}

function responsibilityMatchesOffice_(responsibility, office) {
  const r = String(responsibility || '').trim().toLowerCase();
  const o = String(office || '').trim().toLowerCase();
  if (!r || !o) return false;
  return r === o || r.indexOf(o) !== -1 || o.indexOf(r) !== -1;
}

function responsibilityMatchesUser_(responsibility, user) {
  const r = String(responsibility || '').trim().toLowerCase();
  const username = String((user && user.username) || '').trim().toLowerCase();
  if (r === 'all postal divisional heads') return username.indexOf('do_') === 0;
  if (r === 'all divisional heads') return username.indexOf('rms_') === 0;
  return responsibilityMatchesOffice_(responsibility, user && user.office);
}

function getDistinctResponsibilities_(items, users) {
  const seen = {};
  const out = [];

  // Always include the 'All Divisional Heads' virtual group so it appears
  // as a selectable option even if no records currently reference it.
  seen['All Divisional Heads'] = 1;
  out.push('All Divisional Heads');

  (items || []).forEach(function (item) {
    const v = String(item.responsibility || '').trim();
    if (!v || seen[v]) return;
    seen[v] = 1;
    out.push(v);
  });
  (users || []).forEach(function (user) {
    const v = String(user.office || '').trim();
    if (!v || seen[v]) return;
    seen[v] = 1;
    out.push(v);
  });
  return out.sort(function (a, b) { return String(a).localeCompare(String(b)); });
}

function getReviewReminders_(items, user) {
  const office = String((user && user.office) || '').trim();
  const out = [];
  (items || []).forEach(function (item) {
    const responsibility = String(item.responsibility || '').trim();
    if (!responsibility) return;
    if (office && !responsibilityMatchesUser_(responsibility, user)) return;
    if (item.reviewStatus === 'done') return;
    const days = daysUntilDate_(item.reviewDate);
    if (days === null || days > 1) return;
    out.push({
      row: item.row,
      id: item.id,
      sector: item.sector,
      description: item.description,
      action: item.action,
      responsibility: item.responsibility,
      reviewDate: item.reviewDate,
      daysUntil: days
    });
  });
  return out;
}

/* ============================================================
 * getAppData (port of code.gs getAppData)
 * ============================================================ */

function getAppData(token) {
  const user = auth.requireLogin(token);
  try { auth.ensureUserRecord_(user.email); } catch (err) {}
  const context = auth.getUserContext(user.email);
  const data = getData();
  const items = scopeItemsForUser_(data.items || [], context);
  const settings = getAppSettings();
  const summary = buildSummaryFromItems(items);
  const analytics = buildAnalytics_(items);
  const submissionOverview = require('./submissions').getSubmissionOverview_();
  // Most recent data change across records (and submissions), as a display
  // date — used by the About dialog's Build row to show the last update.
  const lastUpdatedRow = db.prepare(
    'SELECT MAX(updated_at) AS m FROM (SELECT updated_at FROM records UNION ALL SELECT COALESCE(updated_at, created_at) AS updated_at FROM submissions)'
  ).get();
  const lastUpdatedMs = Number(lastUpdatedRow && lastUpdatedRow.m);
  const lastUpdated = isFinite(lastUpdatedMs) && lastUpdatedMs > 0
    ? formatDate_(new Date(lastUpdatedMs))
    : today_();
  return {
    lastUpdated: lastUpdated,
    user: {
      email: context.email,
      username: context.username || '',
      role: context.role,
      loggedIn: true,
      group: context.group,
      department: context.department,
      office: context.office,
      groups: context.groups,
      permissions: context.permissions
    },
    items: items,
    summary: summary,
    analytics: analytics,
    settings: settings,
    responsibilities: getDistinctResponsibilities_(data.items || [], auth.listUserRecords_()),
    reminders: getReviewReminders_(items, context),
    submissionCounts: submissionOverview.counts,
    submissionFlash: submissionOverview.flash,
    displayedSubmissions: submissionOverview.displayed
  };
}

/* ============================================================
 * RecordService (port of RecordService.gs + Data.gs)
 * ============================================================ */

function nextRow_() {
  const row = db.prepare('SELECT COALESCE(MAX(row), ' + (CONFIG.SHEET.START_ROW - 1) + ') AS m FROM records').get();
  return Number(row.m) + 1;
}

function addRecord_(item, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const normalized = normalizeItemForSheet_(item);
    const row = nextRow_();
    const id = row - CONFIG.SHEET.START_ROW + 1;

    db.prepare(
      'INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, source, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      row,
      String(normalized.sector || ''),
      String(normalized.description || ''),
      String(normalized.entryDate || ''),
      String(normalized.action || ''),
      String(normalized.responsibility || ''),
      String(normalized.reviewDate || ''),
      JSON.stringify(normalizeLinksForStorage_(normalized.links || {})),
      item.flagged ? CONFIG.COLORS.FLAG : CONFIG.COLORS.NORMAL,
      'app',
      Date.now(),
      Date.now()
    );

    bumpDataGeneration_();

    try {
      require('./notifications').notifyStaffLocked_('record', 'New item added', 'Record #' + id + ' · ' + (normalized.sector || '') + (normalized.description ? ' — ' + normalized.description : ''), '', editor.email);
    } catch (err) {}

    // When the record targets 'All Divisional Heads', fan out an in-app
    // notification to every do_* user so they are individually aware.
    try {
      if (String(normalized.responsibility || '').trim().toLowerCase() === 'all divisional heads') {
        notifyDivisionalHeads_(NOTIFICATION_TYPES.RECORD, 'New item for you',
          'Record #' + id + ' · ' + (normalized.sector || '') + (normalized.description ? ' — ' + normalized.description : ''),
          '', editor.email);
      }
    } catch (err) {}

    return getData();
  });
}

function updateRecord_(item, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const normalized = normalizeItemForSheet_(item);
    const row = Number(item.row);
    const existing = db.prepare('SELECT * FROM records WHERE row = ?').get(row);
    if (!existing) throw new Error('Record not found.');

    db.prepare(
      'UPDATE records SET sector = ?, description = ?, entry_date = ?, action = ?, responsibility = ?, review_date = ?, links = ?, review_bg = ?, updated_at = ? WHERE row = ?'
    ).run(
      String(normalized.sector || ''),
      String(normalized.description || ''),
      String(normalized.entryDate || ''),
      String(normalized.action || ''),
      String(normalized.responsibility || ''),
      String(normalized.reviewDate || ''),
      JSON.stringify(normalizeLinksForStorage_(normalized.links || {})),
      item.flagged ? CONFIG.COLORS.FLAG : CONFIG.COLORS.NORMAL,
      Date.now(),
      row
    );

    bumpDataGeneration_();

    try {
      require('./notifications').notifyStaffLocked_('record', 'Record updated', 'Record #' + normalized.id + ' · ' + (normalized.sector || '') + (normalized.description ? ' — ' + normalized.description : ''), '', editor.email);
    } catch (err) {}

    // When the record targets 'All Divisional Heads', fan out an in-app
    // notification to every do_* user so they are individually aware.
    try {
      if (String(normalized.responsibility || '').trim().toLowerCase() === 'all divisional heads') {
        notifyDivisionalHeads_(NOTIFICATION_TYPES.RECORD, 'Record updated for you',
          'Record #' + normalized.id + ' · ' + (normalized.sector || '') + (normalized.description ? ' — ' + normalized.description : ''),
          '', editor.email);
      }
    } catch (err) {}

    return getData();
  });
}

function dataRenumber_() {
  const rows = db.prepare('SELECT row FROM records ORDER BY row ASC').all();
  const startRow = CONFIG.SHEET.START_ROW;
  const stmt = db.prepare('UPDATE records SET row = ? WHERE row = ?');
  rows.forEach(function (r, i) {
    const newRow = startRow + i;
    if (Number(r.row) !== newRow) stmt.run(newRow, r.row);
  });
}

function deleteRecord_(row, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const existing = db.prepare('SELECT * FROM records WHERE row = ?').get(Number(row));
    const deletedId = existing ? (Number(row) - CONFIG.SHEET.START_ROW + 1) : '';
    db.prepare('DELETE FROM records WHERE row = ?').run(Number(row));
    dataRenumber_();
    bumpDataGeneration_();

    try {
      require('./notifications').notifyStaffLocked_('record', 'Item deleted', 'Record #' + deletedId + ' was removed from the dashboard.', '', editor.email);
    } catch (err) {}

    return getData();
  });
}

function markReviewDone_(row, token) {
  const admin = auth.requireAdmin(token);

  return runWithLock_(function () {
    db.prepare('UPDATE records SET review_bg = ? WHERE row = ?').run(CONFIG.COLORS.REVIEW_DONE, Number(row));
    require('./audit').logAudit_(ACTIONS.REVIEW_DONE, String(row), 'Marked review as done', admin.email);
    bumpDataGeneration_();

    try {
      require('./notifications').notifyStaffLocked_('record', 'Review marked done', 'Review for record #' + (Number(row) - CONFIG.SHEET.START_ROW + 1) + ' was marked as done.', '', admin.email);
    } catch (err) {}

    const data = getData();
    return {
      items: data.items || [],
      summary: buildSummaryFromItems(data.items || [])
    };
  });
}

function markReviewNotDone_(row, token) {
  const admin = auth.requireAdmin(token);

  return runWithLock_(function () {
    db.prepare('UPDATE records SET review_bg = ? WHERE row = ?').run(CONFIG.COLORS.NORMAL, Number(row));
    require('./audit').logAudit_(ACTIONS.REVIEW_NOT_DONE, String(row), 'Marked review as not done', admin.email);
    bumpDataGeneration_();

    try {
      require('./notifications').notifyStaffLocked_('record', 'Review reopened', 'Review for record #' + (Number(row) - CONFIG.SHEET.START_ROW + 1) + ' was marked as not done (review due again).', '', admin.email);
    } catch (err) {}

    const data = getData();
    return {
      items: data.items || [],
      summary: buildSummaryFromItems(data.items || [])
    };
  });
}

/* ============================================================
 * Public wrappers (port of code.gs)
 * ============================================================ */

async function updateItem(item, token) {
  await updateRecord_(item, token);
  return getAppData(token);
}

async function addItem(item, token) {
  await addRecord_(item, token);
  return getAppData(token);
}

async function deleteItem(row, token) {
  await deleteRecord_(row, token);
  return getAppData(token);
}

function markReviewDone(row, token) {
  return markReviewDone_(row, token);
}

function markReviewNotDone(row, token) {
  return markReviewNotDone_(row, token);
}

function getServerTime() {
  return Date.now();
}

/* ============================================================
 * Reminders / notifications (port of code.gs)
 * ============================================================ */

function sendReviewReminders(token) {
  if (token) auth.requireAdmin(token);

  const data = getData();
  const items = data.items || [];
  const users = auth.listUserRecords_();
  const todayKey = require('./helpers').formatDate_(new Date(), 'yyyy-MM-dd');

  let sent = 0;
  let skipped = 0;

  items.forEach(function (item) {
    const responsibility = String(item.responsibility || '').trim();
    if (!responsibility) return;
    if (item.reviewStatus === 'done') return;
    const days = daysUntilDate_(item.reviewDate);
    if (days !== 1) return;

    users.forEach(function (user) {
      const email = String(user.primaryEmail || '').trim().toLowerCase();
      if (!email || !require('./helpers').isValidEmail_(email)) return;
      if (!responsibilityMatchesUser_(responsibility, user)) return;

      const dedupeKey = 'remind_' + todayKey + '_' + item.row + '_' + email;
      if (cacheGetTTL(dedupeKey)) { skipped++; return; }

      const subject = 'Action reminder: next review date is tomorrow';
      const body =
        'Dear ' + (String(user.username || '').trim() || email) + ',\n\n' +
        'The following record is assigned to your office (' + responsibility + ') and its ' +
        'next review date is tomorrow (' + item.reviewDate + '):\n\n' +
        'Record #' + item.id + ' · ' + (item.sector || '') + '\n' +
        'Action to be taken: ' + (item.action || '—') + '\n\n' +
        'Please log in to the dashboard and complete the required action.\n\n' +
        'India Post Dashboard';

      const { sendMail_ } = require('./mailer');
      if (sendMail_(email, subject, body)) {
        cachePut(dedupeKey, '1', 21600);
        sent++;
      }
    });
  });

  return { success: true, sent: sent, skipped: skipped };
}

function generateReviewNotifications(token) {
  const user = auth.requireLogin(token);
  const context = auth.getUserContext(user.email);
  const data = getData();
  const items = data.items || [];
  const todayKey = require('./helpers').formatDate_(new Date(), 'yyyy-MM-dd');

  let created = 0;
  let skipped = 0;

  return runWithLock_(function () {
    let created = 0;
    let skipped = 0;
    items.forEach(function (item) {
      const responsibility = String(item.responsibility || '').trim();
      if (!responsibility) return;
      if (item.reviewStatus === 'done') return;
      if (!responsibilityMatchesUser_(responsibility, context)) return;
      const days = daysUntilDate_(item.reviewDate);
      if (days === null || days > 1) return;

      const dedupeKey = 'rvnotif_' + todayKey + '_' + item.row + '_' + user.email;
      if (cacheGetTTL(dedupeKey)) { skipped++; return; }

      const dueLabel = days === 0 ? 'today' : 'tomorrow';
      const title = 'Review due ' + dueLabel + ': Record #' + item.id;
      const body = (item.sector || '') +
        (item.action ? ' — ' + item.action : '') +
        ' (review date ' + item.reviewDate + ').';
      require('./notifications').appendNotification_(user.email, 'record', title, body, '');
      cachePut(dedupeKey, '1', 21600);
      created++;
    });
    return { success: true, created: created, skipped: skipped };
  });
}

function dailyDateUpdate() {
  stampTitle_();
  return { ok: true };
}

const RecordService = Object.freeze({
  add: addRecord_,
  update: updateRecord_,
  remove: deleteRecord_,
  markReviewDone: markReviewDone_,
  markReviewNotDone: markReviewNotDone_
});

module.exports = {
  HEADERS,
  getData,
  getAppData,
  getTitle_,
  stampTitle_,
  scopeItemsForUser_,
  responsibilityMatchesUser_,
  getReviewReminders_,
  buildItems,
  invalidateDataCache: bumpDataGeneration_,
  RecordService,
  updateItem,
  addItem,
  deleteItem,
  markReviewDone,
  markReviewNotDone,
  getServerTime,
  sendReviewReminders,
  generateReviewNotifications,
  dailyDateUpdate
};
