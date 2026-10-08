/**
 * ============================================================
 * India Post Dashboard — Node port
 * change-requests.js
 * The approval queue for changes to a record's LINKED Google Sheet.
 *
 * Any logged-in user may RAISE a request to change a cell in a record's linked
 * sheet. Only an admin or editor may APPROVE it. Nothing here writes to a sheet
 * or to `records` when a request is raised — a pending request is inert by
 * construction, so a request that is never approved simply expires, and a
 * request that is approved writes exactly the one cell it named.
 *
 * This is deliberately the ONLY kind of request. Dashboard record fields are
 * not requestable: they are edited directly by admins/editors as before. The
 * gate exists because record-linked spreadsheets are the shared source of truth
 * that staff were editing by hand, with nobody reviewing what changed.
 *
 * Targets are NAMED, never coordinates: a request names a tab and a column
 * header, and the column is resolved from the sheet's own header row at
 * APPROVAL time. A raw "C42" captured when the request was raised would write to
 * whatever later moved into column C.
 *
 * Conflict safety: the cell's current value is re-read at approval and compared
 * with the value captured when the request was raised. If it moved underneath,
 * the request becomes CONFLICT and is NOT applied, so an approval can never
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

const MAX_NEW_VALUE_CHARS = 5000;
const MAX_REASON_CHARS = 1000;
const MAX_REVIEW_NOTE_CHARS = 1000;

function canApprove_(email) {
  return auth.isEditor(email);
}

function recordFromRow_(row) {
  return {
    id: String(row.id || ''),
    recordRow: Number(row.record_row) || 0,
    recordId: String(row.record_id || ''),
    sheetUrl: String(row.sheet_url || ''),
    sheetTab: String(row.sheet_tab || ''),
    sheetHeader: String(row.sheet_header || ''),
    sheetRow: Number(row.sheet_row) || 0,
    sheetCurrentValue: String(row.sheet_current_value || ''),
    newValue: String(row.new_value || ''),
    reason: String(row.reason || ''),
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

/** Requests the given user may see: a requester sees their own, an approver
 *  sees everything. */
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

function safeParseLinks_(raw) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) { return {}; }
}

/* The record's own linked Google Sheet. Taken from the record, never from the
   client, so a request cannot redirect the write to a different sheet. */
function firstSheetLink_(links) {
  const keys = Object.keys(links || {});
  for (let i = 0; i < keys.length; i++) {
    const v = links[keys[i]];
    const url = Array.isArray(v) ? (v[0] && v[0].url) : (v && v.url);
    if (url && /docs\.google\.com\/spreadsheets\//i.test(String(url))) return String(url);
  }
  return '';
}

/** The linked sheet URL for a record row, or '' when it has none. */
function linkedSheetUrl_(recordRow) {
  const rec = recordByRow_(recordRow);
  if (!rec) return '';
  return firstSheetLink_(safeParseLinks_(rec.links));
}

function recordLabel_(rec) {
  if (!rec) return 'a record';
  const id = Number(rec.row) - Number(config.CONFIG.SHEET.START_ROW) + 1;
  const desc = String(rec.description || '').trim();
  return '#' + id + (desc ? ' — ' + (desc.length > 60 ? desc.slice(0, 60) + '…' : desc) : '');
}

function truncate_(text, max) {
  const s = String(text == null ? '' : text);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * Describe a record's linked sheet so the request form can offer the real tabs
 * and column headers instead of asking a user to type them from memory.
 * Read-only; available to any logged-in user.
 */
async function getLinkSheetStructure(token, row) {
  auth.requireLogin(token);
  const url = linkedSheetUrl_(row);
  if (!url) return { success: true, available: false, reason: 'no-link' };
  try {
    const structure = await sheetWrite.getSheetStructure(url);
    if (!structure.ok) return { success: true, available: false, reason: 'unavailable', detail: structure.reason };
    return { success: true, available: true, tabs: structure.tabs, dryRun: sheetWrite.dryRunEnabled() };
  } catch (err) {
    return { success: true, available: false, reason: 'unavailable', detail: (err && err.message) || String(err) };
  }
}

/**
 * Raise a request to change one named cell in a record's linked sheet.
 *
 * args: (payload, token) where payload is
 *   { recordRow, sheetTab, sheetHeader, sheetRow, newValue, reason }
 */
async function createChangeRequest(payload, token) {
  const user = auth.requireLogin(token);
  payload = payload || {};

  const rec = recordByRow_(Number(payload.recordRow));
  if (!rec) return { success: false, message: 'Record not found.' };

  const sheetUrl = firstSheetLink_(safeParseLinks_(rec.links));
  if (!sheetUrl) {
    return { success: false, message: 'This record has no linked Google Sheet to change.' };
  }

  const newValue = String(payload.newValue == null ? '' : payload.newValue);
  const reason = String(payload.reason || '').trim().slice(0, MAX_REASON_CHARS);
  const sheetTab = String(payload.sheetTab || '').trim();
  const sheetHeader = String(payload.sheetHeader || '').trim();
  const sheetRow = Math.floor(Number(payload.sheetRow));

  if (!sheetTab) return { success: false, message: 'Choose the tab that holds the cell.' };
  if (!sheetHeader) return { success: false, message: 'Choose the column of the cell.' };
  if (!isFinite(sheetRow) || sheetRow < 1) return { success: false, message: 'Enter the row number of the cell.' };
  if (!newValue.trim()) return { success: false, message: 'Enter the value you want this cell to contain.' };
  if (newValue.length > MAX_NEW_VALUE_CHARS) {
    return { success: false, message: 'The proposed value is too long (limit ' + MAX_NEW_VALUE_CHARS + ' characters).' };
  }

  // Resolve now so the requester is told immediately if the target is wrong,
  // rather than at approval time by an approver. The value captured here is
  // only used for the conflict check; approval re-reads it.
  let resolved = null;
  try {
    resolved = await sheetWrite.resolveTarget({
      sheetUrl: sheetUrl,
      tabName: sheetTab,
      headerName: sheetHeader,
      oneBasedRow: sheetRow
    });
  } catch (err) {
    return { success: false, message: 'Could not reach the linked sheet: ' + ((err && err.message) || err) };
  }
  if (!resolved || !resolved.ok) {
    return { success: false, message: (resolved && resolved.reason) || 'That cell could not be located in the sheet.' };
  }

  const id = uuid_();
  db.prepare(
    'INSERT INTO change_requests (id, record_row, record_id, scope, field, old_value, new_value, reason, ' +
    'sheet_url, sheet_tab, sheet_header, sheet_row, sheet_current_value, status, requested_by, requested_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id, Number(rec.row) || 0, String(rec.record_id || ''), 'sheet', '', String(resolved.currentValue || ''), newValue, reason,
    sheetUrl, resolved.tab, sheetHeader, resolved.row, String(resolved.currentValue || ''), STATUS.PENDING,
    String(user.email || '').toLowerCase(), Date.now()
  );

  notifyApprovers_(rec, resolved, newValue, user.email);

  return { success: true, id: id, status: STATUS.PENDING, resolved: { range: resolved.range, currentValue: resolved.currentValue }, request: findRequest_(id) };
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

function notifyApprovers_(rec, resolved, newValue, requester) {
  let notifications;
  try { notifications = require('./notifications'); } catch (e) { return; }

  const title = 'Sheet change request: ' + resolved.cell;
  const body = requester + ' wants to change ' + resolved.cell + ' on ' + recordLabel_(rec) +
    '\nSheet: ' + resolved.tab + ' · column "' + resolved.headerName + '" · row ' + resolved.row +
    '\nCurrent: ' + truncate_(resolved.currentValue, 160) +
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

/**
 * Preview what approving a request would do, including the exact sheet cell it
 * resolves to right now. Read-only, so an approver can check safely.
 */
async function previewChangeRequest(id, token) {
  auth.requireLogin(token);
  const req = findRequest_(id);
  if (!req) return { success: false, message: 'Change request not found.' };

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
      resolvable: false,
      reason: (resolved && resolved.reason) || reason || 'Could not resolve the target cell.',
      conflict: false
    };
  }
  return {
    success: true,
    request: req,
    resolvable: true,
    range: resolved.range,
    cell: resolved.cell,
    columnLetter: resolved.columnLetter,
    tab: resolved.tab,
    currentValue: resolved.currentValue,
    proposedValue: req.newValue,
    conflict: String(resolved.currentValue) !== String(req.sheetCurrentValue),
    dryRun: sheetWrite.dryRunEnabled()
  };
}

/**
 * Approve a request: admin/editor only. Resolves the named cell again at this
 * moment (the column may have moved since it was raised), checks it has not
 * changed underneath, then writes that one cell.
 */
async function approveChangeRequest(id, token, note) {
  const user = auth.requireEditor(token); // throws for non-approvers
  const req = findRequest_(id);
  if (!req) return { success: false, message: 'Change request not found.' };
  if (req.status !== STATUS.PENDING) {
    return { success: false, message: 'This request was already ' + req.status.toLowerCase() + '.' };
  }

  const reviewNote = String(note || '').trim().slice(0, MAX_REVIEW_NOTE_CHARS);

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

  // The cell moved since the request was raised: refuse rather than overwrite.
  if (String(resolved.currentValue) !== String(req.sheetCurrentValue)) {
    mark_(id, STATUS.CONFLICT, user.email, reviewNote);
    audit_(req, user.email, 'SHEET_CHANGE_CONFLICT', resolved.cell + ' changed since the request');
    notifyRequester_(req, 'Sheet change could not be applied',
      'Cell ' + resolved.cell + ' on ' + recordLabel_(recordByRow_(req.recordRow)) +
      ' changed since you requested it, so nothing was written. It now contains: ' +
      truncate_(resolved.currentValue, 200));
    return {
      success: false,
      conflict: true,
      message: resolved.cell + ' changed since this was requested, so nothing was written. It now contains: ' +
        truncate_(resolved.currentValue, 120)
    };
  }

  const written = await sheetWrite.writeCell({
    spreadsheetId: resolved.spreadsheetId,
    range: resolved.range,
    newValue: req.newValue
  });
  if (!written.ok) {
    // Leave the request PENDING: a failed write must never look applied.
    return { success: false, message: written.message || 'The sheet write failed.' };
  }

  db.prepare('UPDATE change_requests SET applied_range = ?, applied_sheet = ? WHERE id = ?')
    .run(String(written.range || resolved.range), String(resolved.spreadsheetId || ''), id);
  mark_(id, STATUS.APPROVED, user.email, reviewNote);
  audit_(req, user.email, 'SHEET_CHANGE_APPROVED',
    resolved.cell + ' = ' + truncate_(req.newValue, 120) + (written.dryRun ? ' (dry run, not written)' : ''));
  notifyRequester_(req, 'Sheet change approved',
    'Your change to ' + resolved.cell + ' (' + resolved.tab + ', column "' + req.sheetHeader + '") on ' +
    recordLabel_(recordByRow_(req.recordRow)) + ' was approved by ' + user.email +
    (written.dryRun ? '. Dry run is on, so the sheet was NOT modified.' : '.'), STATUS.APPROVED);

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
  audit_(req, user.email, 'SHEET_CHANGE_REJECTED', reviewNote ? 'reason: ' + reviewNote : '');
  notifyRequester_(req, 'Sheet change rejected',
    'Your change to ' + req.sheetHeader + ' (row ' + req.sheetRow + ', tab ' + req.sheetTab + ') was rejected by ' +
    user.email + (reviewNote ? ': ' + reviewNote : '.'), STATUS.REJECTED);
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

function notifyRequester_(req, title, body) {
  try {
    require('./notifications').notify_(req.requestedBy, 'system', title, body, '', {
      priority: NOTIFICATION_PRIORITY ? NOTIFICATION_PRIORITY.NORMAL : 0,
      recordRow: req.recordRow
    });
  } catch (e) {}
}

module.exports = {
  STATUS,
  listChangeRequests,
  getLinkSheetStructure,
  createChangeRequest,
  previewChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  canApprove: canApprove_,
  __test: {
    firstSheetLink: firstSheetLink_,
    safeParseLinks: safeParseLinks_,
    recordLabel: recordLabel_
  }
};
