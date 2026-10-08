/**
 * ============================================================
 * India Post Dashboard — Node port
 * change-requests.js
 * The approval queue for record edits.
 *
 * Any logged-in user may RAISE a change request. Only an admin or editor may
 * APPROVE one. Nothing in this module writes to `records` or to a Google Sheet
 * when a request is raised — a pending request is inert by construction, so a
 * user who never gets approved simply loses their request, never corrupts data.
 *
 * Two scopes:
 *   'record' - one dashboard field of one record.
 *   'sheet'  - one named cell in the record's linked Google Sheet (tab name +
 *              header name + row). The column is resolved at APPROVAL time, not
 *              when the request is raised, so a column inserted or reordered in
 *              the meantime cannot make the write land in the wrong cell.
 *
 * Conflict safety: `old_value` is captured at raise time and re-checked at
 * approval. If the record field (or the sheet cell) changed underneath, the
 * request goes to CONFLICT and is NOT applied — an approval must never
 * silently overwrite a newer edit by someone else.
 * ============================================================
 */

const { db } = require('./db');
const config = require('./config');
const { ROLES, NOTIFICATION_PRIORITY } = config;
const { uuid_ } = require('./helpers');
const auth = require('./auth');
const records = require('./records');
const sheetWrite = require('./sheet-write');

const STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CONFLICT: 'CONFLICT'
});

/* The dashboard fields a request may propose to change. Kept as an explicit
   allow-list rather than "any key the client sends" so a request cannot target
   a column that is not a user-editable field (row, source, displayed, ...). */
const EDITABLE_FIELDS = Object.freeze({
  sector: 'Sector',
  description: 'Description',
  entryDate: 'Entry Date',
  action: 'Action',
  lastMeetingInstructions: 'Last meeting instructions',
  responsibility: 'Responsibility',
  reviewDate: 'Review Date'
});

const MAX_NEW_VALUE_CHARS = 5000;
const MAX_REASON_CHARS = 1000;
const MAX_REVIEW_NOTE_CHARS = 1000;

function canApprove_(email) {
  return auth.isEditor(email);
}

function recordFromRow_(row) {
  const scope = String(row.scope || 'record');
  return {
    id: String(row.id || ''),
    recordRow: Number(row.record_row) || 0,
    recordId: String(row.record_id || ''),
    scope: scope,
    field: String(row.field || ''),
    fieldLabel: EDITABLE_FIELDS[String(row.field || '')] || String(row.field || ''),
    oldValue: String(row.old_value || ''),
    newValue: String(row.new_value || ''),
    reason: String(row.reason || ''),
    sheetUrl: String(row.sheet_url || ''),
    sheetTab: String(row.sheet_tab || ''),
    sheetHeader: String(row.sheet_header || ''),
    sheetRow: Number(row.sheet_row) || 0,
    sheetCurrentValue: String(row.sheet_current_value || ''),
    status: String(row.status || STATUS.PENDING),
    requestedBy: String(row.requested_by || ''),
    requestedAt: Number(row.requested_at) || 0,
    reviewedBy: String(row.reviewed_by || ''),
    reviewedAt: Number(row.reviewed_at) || 0,
    reviewNote: String(row.review_note || ''),
    appliedRange: String(row.applied_range || ''),
    appliedSheet: String(row.applied_sheet || '')
  };
}

function findRequest_(id) {
  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(String(id || ''));
  return row ? recordFromRow_(row) : null;
}

/** Requests the given user is allowed to see: a requester sees their own,
 *  an approver sees everything. */
function listChangeRequests(token, opts) {
  const user = auth.requireLogin(token);
  opts = opts || {};
  const approver = canApprove_(user.email);
  const mine = String(opts.mine || '') === 'true';
  const status = String(opts.status || '').trim().toUpperCase();

  let sql = 'SELECT * FROM change_requests';
  const where = [];
  const args = [];
  if (!approver || mine) {
    where.push('requested_by = ?');
    args.push(String(user.email || '').toLowerCase());
  }
  if (status && Object.keys(STATUS).some(function (k) { return STATUS[k] === status; })) {
    where.push('status = ?');
    args.push(status);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY requested_at DESC LIMIT 500';

  const stmt = db.prepare(sql);
  const rows = stmt.all.apply(stmt, args).map(recordFromRow_);
  return {
    success: true,
    canApprove: approver,
    requests: rows,
    pendingCount: rows.filter(function (r) { return r.status === STATUS.PENDING; }).length
  };
}

function recordByRow_(row) {
  return records.resolveRecord_(row);
}

/**
 * Raise a change request. Any logged-in user.
 *
 * args: (payload, token) where payload is
 *   { recordRow, scope, field, newValue, reason,
 *     sheetTab, sheetHeader, sheetRow }
 */
function createChangeRequest(payload, token) {
  const user = auth.requireLogin(token);
  payload = payload || {};

  const row = Number(payload.recordRow);
  const rec = isFinite(row) ? recordByRow_(row) : null;
  if (!rec) return { success: false, message: 'Record not found.' };

  const scope = String(payload.scope || 'record') === 'sheet' ? 'sheet' : 'record';
  const newValue = String(payload.newValue == null ? '' : payload.newValue);
  const reason = String(payload.reason || '').trim().slice(0, MAX_REASON_CHARS);

  if (!newValue.trim()) return { success: false, message: 'Enter the new value you are proposing.' };
  if (newValue.length > MAX_NEW_VALUE_CHARS) {
    return { success: false, message: 'The proposed value is too long (limit ' + MAX_NEW_VALUE_CHARS + ' characters).' };
  }

  let field = '';
  let oldValue = '';
  let sheetUrl = '';
  let sheetTab = '';
  let sheetHeader = '';
  let sheetRow = 0;
  let sheetCurrentValue = '';

  if (scope === 'record') {
    field = String(payload.field || '');
    if (!EDITABLE_FIELDS[field]) {
      return { success: false, message: 'That field cannot be changed through a change request.' };
    }
    oldValue = String(rec[field] == null ? '' : rec[field]);
    if (oldValue === newValue) {
      return { success: false, message: 'That is already the current value — nothing to request.' };
    }
  } else {
    // 'sheet' scope: capture the linked sheet URL from the record itself, never
    // from the client, so a request cannot redirect the write to another sheet.
    const links = safeParseLinks_(rec.links);
    sheetUrl = firstSheetLink_(links);
    if (!sheetUrl) {
      return { success: false, message: 'This record has no linked Google Sheet to change.' };
    }
    sheetTab = String(payload.sheetTab || '').trim();
    sheetHeader = String(payload.sheetHeader || '').trim();
    sheetRow = Math.floor(Number(payload.sheetRow));
    if (!sheetTab) return { success: false, message: 'Name the tab that holds the cell.' };
    if (!sheetHeader) return { success: false, message: 'Name the column header of the cell.' };
    if (!isFinite(sheetRow) || sheetRow < 1) return { success: false, message: 'Enter the row number of the cell.' };
    oldValue = '';
  }

  const id = uuid_();
  db.prepare(
    'INSERT INTO change_requests (id, record_row, record_id, scope, field, old_value, new_value, reason, ' +
    'sheet_url, sheet_tab, sheet_header, sheet_row, sheet_current_value, status, requested_by, requested_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id, Number(rec.row) || 0, String(rec.record_id || ''), scope, field, oldValue, newValue, reason,
    sheetUrl, sheetTab, sheetHeader, sheetRow, sheetCurrentValue, STATUS.PENDING,
    String(user.email || '').toLowerCase(), Date.now()
  );

  notifyApprovers_(rec, field, oldValue, newValue, scope, sheetTab, sheetHeader, sheetRow, user.email);

  return { success: true, id: id, status: STATUS.PENDING, request: findRequest_(id) };
}

function safeParseLinks_(raw) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) { return {}; }
}

function firstSheetLink_(links) {
  const keys = Object.keys(links || {});
  for (let i = 0; i < keys.length; i++) {
    const v = links[keys[i]];
    const url = Array.isArray(v) ? (v[0] && v[0].url) : (v && v.url);
    if (url && /docs\.google\.com\/spreadsheets\//i.test(String(url))) return String(url);
  }
  return '';
}

function recordLabel_(rec) {
  if (!rec) return 'a record';
  const id = Number(rec.row) - Number(config.CONFIG.SHEET.START_ROW) + 1;
  const desc = String(rec.description || '').trim();
  return '#' + id + (desc ? ' — ' + (desc.length > 60 ? desc.slice(0, 60) + '…' : desc) : '');
}

function describeChange_(req) {
  if (req.scope === 'sheet') {
    return 'sheet cell "' + req.sheetHeader + '" (tab ' + req.sheetTab + ', row ' + req.sheetRow + ')';
  }
  return req.fieldLabel;
}

/* Everyone who can approve: the admins/editors from config plus anyone the
   admin panel has promoted to that role. Users may carry several comma-
   separated emails in one row, so each is considered separately. */
function approverEmails_() {
  const out = [];
  const add = function (email) {
    const e = String(email || '').trim().toLowerCase();
    if (e && out.indexOf(e) === -1) out.push(e);
  };
  try {
    (config.ADMIN_USERS || []).forEach(add);
    (config.EDITOR_USERS || []).forEach(add);
  } catch (e) {}
  try {
    auth.listUserRecords_().forEach(function (u) {
      if (!u || !u.role) return;
      if (u.role !== ROLES.ADMIN && u.role !== ROLES.EDITOR) return;
      String(u.email || '').split(',').forEach(add);
    });
  } catch (e) {}
  return out;
}

function notifyApprovers_(rec, field, oldValue, newValue, scope, sheetTab, sheetHeader, sheetRow, requester) {
  let notifications;
  try { notifications = require('./notifications'); } catch (e) { return; }

  const title = 'Change request: ' + (scope === 'sheet' ? 'linked sheet cell' : (EDITABLE_FIELDS[field] || field));
  const target = scope === 'sheet'
    ? sheetHeader + ' · ' + sheetTab + ' row ' + sheetRow
    : (EDITABLE_FIELDS[field] || field);
  const body = requester + ' wants to change ' + target + ' on ' + recordLabel_(rec) +
    '\nCurrent: ' + truncate_(scope === 'sheet' ? '(read on approval)' : oldValue, 160) +
    '\nProposed: ' + truncate_(newValue, 160);

  approverEmails_().forEach(function (email) {
    // Do not notify an approver about their own request.
    if (String(email).toLowerCase() === String(requester).toLowerCase()) return;
    try {
      notifications.notify_(email, 'system', title, body, '', {
        priority: NOTIFICATION_PRIORITY ? NOTIFICATION_PRIORITY.HIGH : 1,
        recordRow: Number(rec.row) || 0
      });
    } catch (e) {}
  });
}

function truncate_(text, max) {
  const s = String(text == null ? '' : text);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * Preview what approving a request would do, including the exact sheet cell it
 * resolved to. Read-only, so it is safe for an approver to call repeatedly.
 */
async function previewChangeRequest(id, token) {
  auth.requireLogin(token);
  const req = findRequest_(id);
  if (!req) return { success: false, message: 'Change request not found.' };

  if (req.scope === 'record') {
    const rec = recordByRow_(req.recordRow);
    if (!rec) return { success: false, message: 'The record for this request no longer exists.' };
    const current = String(rec[req.field] == null ? '' : rec[req.field]);
    return {
      success: true,
      request: req,
      scope: 'record',
      fieldLabel: req.fieldLabel,
      currentValue: current,
      proposedValue: req.newValue,
      conflict: current !== req.oldValue
    };
  }

  let resolved = null;
  let reason = '';
  try {
    resolved = await sheetWrite.resolveTarget({
      sheetUrl: req.sheetUrl,
      tabName: req.sheetTab,
      headerName: req.sheetHeader,
      oneBasedRow: req.sheetRow
    });
  } catch (err) {
    reason = (err && err.message) || String(err);
  }
  if (!resolved || !resolved.ok) {
    return {
      success: true,
      request: req,
      scope: 'sheet',
      resolvable: false,
      reason: (resolved && resolved.reason) || reason || 'Could not resolve the target cell.',
      conflict: false
    };
  }
  return {
    success: true,
    request: req,
    scope: 'sheet',
    resolvable: true,
    range: resolved.range,
    cell: resolved.cell,
    columnLetter: resolved.columnLetter,
    tab: resolved.tab,
    currentValue: resolved.currentValue,
    proposedValue: req.newValue,
    conflict: resolved.currentValue !== req.sheetCurrentValue && !!req.sheetCurrentValue,
    dryRun: sheetWrite.dryRunEnabled()
  };
}

/**
 * Approve a request: admin/editor only.
 *
 * The record write reuses records.updateItem, so validation, notifications,
 * history and the existing lock behaviour all apply as they do to a direct
 * edit — there is no second, weaker write path.
 */
async function approveChangeRequest(id, token, note) {
  const user = auth.requireEditor(token); // throws for non-approvers
  const req = findRequest_(id);
  if (!req) return { success: false, message: 'Change request not found.' };
  if (req.status !== STATUS.PENDING) {
    return { success: false, message: 'This request was already ' + req.status.toLowerCase() + '.' };
  }

  const reviewNote = String(note || '').trim().slice(0, MAX_REVIEW_NOTE_CHARS);

  if (req.scope === 'record') {
    const rec = recordByRow_(req.recordRow);
    if (!rec) return { success: false, message: 'The record for this request no longer exists.' };
    const current = String(rec[req.field] == null ? '' : rec[req.field]);
    if (current !== req.oldValue) {
      mark_(id, STATUS.CONFLICT, user.email, reviewNote);
      notifyRequester_(req, 'Change request could not be applied',
        'The ' + req.fieldLabel + ' changed since this was requested, so the request was not applied. '
        + 'Current value: ' + truncate_(current, 200), req.status);
      return {
        success: false,
        conflict: true,
        message: 'This field changed since the request was raised, so nothing was applied. '
          + 'Current value: ' + truncate_(current, 120)
      };
    }

    const item = {
      id: String(rec.record_id || rec.row),
      row: Number(rec.row),
      recordId: String(rec.record_id || ''),
      sector: rec.sector,
      description: rec.description,
      entryDate: rec.entry_date,
      action: rec.action,
      lastMeetingInstructions: rec.last_meeting_instructions,
      responsibility: rec.responsibility,
      reviewDate: rec.review_date,
      links: safeParseLinks_(rec.links)
    };
    item[req.field] = req.newValue;

    try {
      // No extra runWithLock_ here: updateItem already serialises its own
      // write, and wrapping it again would only queue it twice.
      await records.updateItem(item, token);
    } catch (err) {
      return { success: false, message: 'The record could not be updated: ' + ((err && err.message) || err) };
    }

    mark_(id, STATUS.APPROVED, user.email, reviewNote);
    audit_(req, user.email, 'CHANGE_REQUEST_APPROVED', req.fieldLabel + ' updated');
    notifyRequester_(req, 'Change request approved',
      'Your change to ' + req.fieldLabel + ' on ' + recordLabel_(rec) + ' was approved by ' + user.email + '.', STATUS.APPROVED);
    return { success: true, status: STATUS.APPROVED, request: findRequest_(id) };
  }

  // 'sheet' scope: resolve the column at approval time, then write that one cell.
  let resolved = null;
  try {
    resolved = await sheetWrite.resolveTarget({
      sheetUrl: req.sheetUrl,
      tabName: req.sheetTab,
      headerName: req.sheetHeader,
      oneBasedRow: req.sheetRow
    });
  } catch (err) {
    return { success: false, message: 'Could not reach the linked sheet: ' + ((err && err.message) || err) };
  }
  if (!resolved || !resolved.ok) {
    return { success: false, message: (resolved && resolved.reason) || 'Could not resolve the target cell.' };
  }

  const written = await sheetWrite.writeCell({
    spreadsheetId: resolved.spreadsheetId,
    range: resolved.range,
    newValue: req.newValue
  });
  if (!written.ok) {
    return { success: false, message: written.message || 'The sheet write failed.' };
  }

  db.prepare('UPDATE change_requests SET applied_range = ?, applied_sheet = ? WHERE id = ?')
    .run(String(written.range || resolved.range), String(resolved.spreadsheetId || ''), id);
  mark_(id, STATUS.APPROVED, user.email, reviewNote);
  audit_(req, user.email, 'CHANGE_REQUEST_APPROVED',
    'linked sheet cell ' + resolved.range + ' set' + (written.dryRun ? ' (dry run, not written)' : ''));
  notifyRequester_(req, 'Change request approved',
    'Your change to ' + req.sheetHeader + ' (row ' + req.sheetRow + ', tab ' + resolved.tab + ') on '
    + recordLabel_(recordByRow_(req.recordRow) || {}) + ' was approved by ' + user.email
    + (written.dryRun ? '. Dry run is on, so the sheet was NOT modified.' : '.'), STATUS.APPROVED);

  return {
    success: true,
    status: STATUS.APPROVED,
    dryRun: written.dryRun === true,
    range: written.range || resolved.range,
    request: findRequest_(id)
  };
}

/** Reject a request: admin/editor only. Never writes anything. */
function rejectChangeRequest(id, token, note) {
  const user = auth.requireEditor(token);
  const req = findRequest_(id);
  if (!req) return { success: false, message: 'Change request not found.' };
  if (req.status !== STATUS.PENDING) {
    return { success: false, message: 'This request was already ' + req.status.toLowerCase() + '.' };
  }
  const reviewNote = String(note || '').trim().slice(0, MAX_REVIEW_NOTE_CHARS);
  mark_(id, STATUS.REJECTED, user.email, reviewNote);
  audit_(req, user.email, 'CHANGE_REQUEST_REJECTED', reviewNote ? 'reason: ' + reviewNote : '');
  notifyRequester_(req, 'Change request rejected',
    'Your change to ' + describeChange_(req) + ' was rejected by ' + user.email +
    (reviewNote ? ': ' + reviewNote : '.'), STATUS.REJECTED);
  return { success: true, status: STATUS.REJECTED, request: findRequest_(id) };
}

function mark_(id, status, reviewer, note) {
  db.prepare('UPDATE change_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?')
    .run(String(status), String(reviewer || ''), Date.now(), String(note || ''), String(id));
}

function audit_(req, who, action, details) {
  try {
    // logAudit_(action, recordId, details, userEmail) — the argument order is
    // the opposite of what it looks like, so it is spelled out here.
    require('./audit').logAudit_(action, req.recordId || String(req.recordRow), String(details || ''), who);
  } catch (e) {}
}

function notifyRequester_(req, title, body, status) {
  try {
    require('./notifications').notify_(req.requestedBy, 'system', title, body, '', {
      priority: NOTIFICATION_PRIORITY ? NOTIFICATION_PRIORITY.NORMAL : 0,
      recordRow: req.recordRow
    });
  } catch (e) {}
}

module.exports = {
  STATUS,
  EDITABLE_FIELDS,
  listChangeRequests,
  createChangeRequest,
  previewChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  canApprove: canApprove_,
  __test: {
    firstSheetLink: firstSheetLink_,
    safeParseLinks: safeParseLinks_,
    describeChange: describeChange_
  }
};
