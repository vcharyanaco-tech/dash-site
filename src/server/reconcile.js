/**
 * ============================================================
 * India Post Dashboard — Node port
 * reconcile.js
 * One-shot repair for "record ↔ child row" ordering drift.
 *
 * Record rows are positional — id == row - START_ROW + 1 (START_ROW = 4) — and
 * every child row (submissions.card_row, tasks.record_row,
 * documents.record_row, record_changes.record_row, ask_ai_history.record_row)
 * references its parent by that row. An older delete path removed a record and
 * renumbered the records table WITHOUT moving the surviving children along, so
 * e.g. after deleting record #17 the submissions of old #18 stayed one row
 * below their parent and appeared under what was now #19. The new deleteRecord_
 * cascade prevents the corruption going forward; this module repairs databases
 * that were already affected.
 *
 * The repair re-anchors children against the *canonical* origin — the Google
 * Sheet (public gviz feed, no auth) — rather than against the possibly-shifted
 * live rows:
 *   - each child's current row is read as its position in canonical space
 *     (row - START_ROW + 1 == canonical display id);
 *   - that canonical record is matched by CONTENT into the live records table;
 *     the child is moved to the live record's row (the content moved, so the
 *     child follows it);
 *   - a canonical record with no live match (a record deleted before the fix,
 *     e.g. the original #17) leaves its children as orphans — they are removed;
 *   - rows outside the canonical range (children of dashboard-created records)
 *     are left untouched.
 *
 * The records table itself is re-densified into canonical-relative order
 * (present records only — deleted records are never resurrected; sheet records
 * first, dashboard-created records after). On an already-clean database the
 * whole operation is a strict no-op.
 *
 * Idempotent and transactional. Admin only. dryRun (default true) returns the
 * plan without touching anything. canonicalOverride exists for tests only.
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG } = require('./config');
const { runWithLock_ } = require('./helpers');
const auth = require('./auth');
const syncSheet = require('./sync-sheet');

const START_ROW = CONFIG.SHEET.START_ROW; // 4
const MAX_EXAMPLES = 5;

function norm_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
}

function contentKey_(sector, description) {
  return norm_(sector) + '|' + norm_(description);
}

async function fetchCanonicalFromSheet_() {
  const list = await syncSheet.fetchCanonicalRecords();
  return list.map(function (c) {
    return {
      displayId: c.displayId,
      row: c.row,
      sector: c.sector,
      description: c.description,
      key: contentKey_(c.sector, c.description)
    };
  });
}

// Canonical source, with a fixture override for tests (no network needed).
function canonicalInput_(override) {
  if (override) return Promise.resolve(override);
  return fetchCanonicalFromSheet_();
}
// The child tables that reference a record row. ask_ai_history has no stored
// record id — it is always anchored by row position alone.
const CHILDREN = [
  { table: 'submissions', rowCol: 'card_row', idCol: 'card_id', label: 'submissions' },
  { table: 'tasks', rowCol: 'record_row', idCol: 'record_id', label: 'tasks' },
  { table: 'documents', rowCol: 'record_row', idCol: 'record_id', label: 'documents' },
  { table: 'record_changes', rowCol: 'record_row', idCol: 'record_id', label: 'recordChanges' },
  { table: 'ask_ai_history', rowCol: 'record_row', idCol: null, label: 'askAiHistory' }
];

// Builds the full plan of what a reconcile would change — no writes.
// canonical: array of {displayId, row, sector, description, key}.
function planReconcile_(canonical) {
  // Normalize: test fixtures may omit derived fields; the sheet path provides
  // them, but re-deriving keeps both callers on identical semantics.
  canonical = canonical.map(function (c) {
    return {
      displayId: Number(c.displayId),
      row: Number(c.row),
      sector: String(c.sector == null ? '' : c.sector),
      description: String(c.description == null ? '' : c.description),
      key: c.key || contentKey_(c.sector, c.description)
    };
  });

  const report = {
    action: 'reconcileRecordOrder',
    canonicalCount: canonical.length,
    liveCount: 0,
    records: { reordered: [], unchanged: 0 },
    children: {}
  };

  const live = db.prepare('SELECT * FROM records ORDER BY row ASC').all();
  report.liveCount = live.length;

  // 1) Canonical-relative record ordering. Sheet records first in canonical
  //    order; any record whose content is not in the sheet (dashboard-created,
  //    or pruned from the sheet) keeps its relative order but sorts after.
  const canonByKey = new Map();
  canonical.forEach(function (c) { canonByKey.set(c.key, c.displayId); });
  const ranked = live.map(function (r) {
    const displayId = canonByKey.get(contentKey_(r.sector, r.description));
    return { rec: r, displayId: displayId || 0, isSheet: !!displayId };
  });
  ranked.sort(function (a, b) {
    if (a.isSheet && b.isSheet) return a.displayId - b.displayId || a.rec.row - b.rec.row;
    if (a.isSheet !== b.isSheet) return a.isSheet ? -1 : 1;
    return a.rec.row - b.rec.row;
  });

  // 2) Desired numbering: contiguous rows from START_ROW in canonical order.
  const recordMoves = [];
  // Live record row (pre-reorder) -> its post-reorder row. Child targets must
  // be computed against these post-reorder rows, never the pre-reorder ones,
  // because applyReconcile_ moves the records before it moves the children.
  const recordRowDesired = {};
  ranked.forEach(function (e, i) {
    const to = START_ROW + i;
    recordRowDesired[Number(e.rec.row)] = to;
    if (Number(e.rec.row) !== to) {
      recordMoves.push({
        from: Number(e.rec.row),
        to: to,
        id: e.isSheet ? e.displayId : '',
        sector: String(e.rec.sector || ''),
        description: String(e.rec.description || '')
      });
    }
  });
  if (recordMoves.length) {
    report.records.reordered = recordMoves;
  } else {
    report.records.unchanged = live.length;
  }

  // 3) Child rows. Anchor by the stored record id when there is one (numeric,
  //    1..canonicalCount) — the stored id was row - START_ROW + 1 at post time,
  //    i.e. the canonical display id, so it identifies the parent CONTENT even
  //    after records were compacted. id-less rows (ask_ai_history, legacy
  //    '') re-anchor by canonical-slot content, and never orphan a row that is
  //    occupied by a live record (ambiguous after a compaction).
  const liveByKey = {};
  ranked.forEach(function (e) {
    const key = contentKey_(e.rec.sector, e.rec.description);
    if (!liveByKey[key]) liveByKey[key] = [];
    liveByKey[key].push(e.rec);
  });
  // Row -> live record (for the post-compaction occupant guard).
  const liveByRow = {};
  ranked.forEach(function (e) { liveByRow[Number(e.rec.row)] = e.rec; });
  const canonicalById = {};
  canonical.forEach(function (c) { canonicalById[c.displayId] = c; });

  CHILDREN.forEach(function (child) {
    const rows = db.prepare('SELECT * FROM ' + child.table).all();
    const actions = [];
    let kept = 0;
    let beyond = 0;

    rows.forEach(function (r) {
      const id = r.id != null ? r.id : r[child.rowCol];
      const rowValue = Number(r[child.rowCol]) || 0;
      const canonIndex = rowValue - START_ROW;
      const storedId = child.idCol ? String(r[child.idCol] || '').trim() : '';

      if (canonIndex < 0 || canonIndex >= canonical.length) {
        // Outside canonical space (rows of dashboard-created records): no
        // sheet anchor — leave untouched.
        beyond++;
        return;
      }

      // Prefer the stored id: it pins the parent content exactly.
      const idIsUsable = child.idCol && /^\d+$/.test(storedId);
      const candidate = idIsUsable
        ? canonicalById[Number(storedId)] || null
        : canonical[canonIndex];

      if (!candidate) {
        // Stored id outside the canonical range but the row is inside it —
        // treat as an orphan; there is no record this content could belong to.
        actions.push({
          op: 'orphan',
          id: String(id),
          from: rowValue,
          displayId: idIsUsable ? Number(storedId) : canonIndex + 1,
          recordId: storedId
        });
        return;
      }

      const matches = liveByKey[candidate.key] || [];
      if (!matches.length) {
        // The parent record does not exist in the live table (deleted before
        // the fix). For id-less children, only orphan when the row is NOT
        // occupied by a live record — an occupied row is ambiguous after a
        // compaction and must never be blindly dropped.
        const occupied = !!liveByRow[rowValue];
        if (idIsUsable || !occupied) {
          actions.push({
            op: 'orphan',
            id: String(id),
            from: rowValue,
            displayId: candidate.displayId,
            recordId: storedId
          });
        } else {
          kept++; // uncertain occupant: leave in place
        }
        return;
      }

      // Prefer an in-place live record for this canonical content; fall back
      // to the first content match (covers a compacted/shifted ordering).
      // Rows are compared in POST-reorder space so targets stay valid after
      // applyReconcile_ moves the records first.
      const target =
        matches.find(function (m) { return recordRowDesired[Number(m.row)] === candidate.row; }) || matches[0];
      const targetRow = recordRowDesired[Number(target.row)];
      if (targetRow !== rowValue) {
        actions.push({
          op: 'rebind',
          id: String(id),
          from: rowValue,
          to: targetRow,
          displayId: candidate.displayId,
          recordId: storedId
        });
      } else {
        kept++;
      }
    });

    const rebound = actions.filter(function (a) { return a.op === 'rebind'; });
    const orphaned = actions.filter(function (a) { return a.op === 'orphan'; });

    report.children[child.label] = {
      total: rows.length,
      rebound: rebound.length,
      kept: kept,
      orphaned: orphaned.length,
      beyondCanonical: beyond,
      actions: actions,
      examples: {
        rebound: rebound.map(function (a) { return { id: a.id, from: a.from, to: a.to, displayId: a.displayId }; }).slice(0, MAX_EXAMPLES),
        orphaned: orphaned.map(function (a) { return { id: a.id, row: a.from, displayId: a.displayId, recordId: a.recordId }; }).slice(0, MAX_EXAMPLES)
      }
    };
  });

  report.changed =
    report.records.reordered.length > 0 ||
    Object.keys(report.children).some(function (key) {
      const c = report.children[key];
      return c.rebound > 0 || c.orphaned > 0;
    });

  return report;
}

// Applies a plan produced by planReconcile_(): record rows first (two-phase
// temp-key move so any permutation is collision-safe), then the child rows, and
// removes orphans. All mutations run inside the caller's write lock.
function applyReconcile_(report, adminEmail) {
  const moves = report.records.reordered;
  const updRec = db.prepare('UPDATE records SET row = ? WHERE row = ?');
  moves.forEach(function (m) { updRec.run(-Math.abs(m.to), m.from); });
  moves.forEach(function (m) { updRec.run(m.to, -Math.abs(m.to)); });

  CHILDREN.forEach(function (child) {
    const childReport = report.children[child.label];
    const hasIdCol = !!child.idCol;
    const upd = hasIdCol
      ? db.prepare('UPDATE ' + child.table + ' SET ' + child.rowCol + ' = ? WHERE id = ?')
      : db.prepare('UPDATE ' + child.table + ' SET ' + child.rowCol + ' = ? WHERE ' + child.rowCol + ' = ?');
    const del = hasIdCol
      ? db.prepare('DELETE FROM ' + child.table + ' WHERE id = ?')
      : db.prepare('DELETE FROM ' + child.table + ' WHERE ' + child.rowCol + ' = ?');

    const rebinds = childReport.actions.filter(function (a) { return a.op === 'rebind'; });
    const orphans = childReport.actions.filter(function (a) { return a.op === 'orphan'; });

    // Two-phase move, keyed by primary id (or the row column for
    // ask_ai_history which has no id): no intermediate collisions.
    if (hasIdCol) {
      rebinds.forEach(function (a) { upd.run(-Math.abs(a.to), a.id); });
      rebinds.forEach(function (a) { upd.run(a.to, a.id); });
    } else {
      rebinds.forEach(function (a) { upd.run(-Math.abs(a.to), a.from); });
      rebinds.forEach(function (a) { upd.run(a.to, -Math.abs(a.to)); });
    }
    orphans.forEach(function (o) { del.run(hasIdCol ? o.id : o.from); });
  });

  try {
    require('./audit').logAudit_('RECORD_RECONCILE', 'records',
      JSON.stringify({ moved: report.records.reordered.length, children: Object.keys(report.children).map(function (k) { return [k, report.children[k].rebound, report.children[k].orphaned]; }) }),
      adminEmail);
  } catch (err) { /* audit failure must not roll back the repair */ }
}

/**
 * Re-orders records into canonical-relative positions and re-anchors every
 * child row to its correct parent. Never resurrects deleted records.
 *
 *   reconcileRecordOrder(dryRun, token)
 *     dryRun  boolean — when true (default) nothing is written.
 *     token   admin session token.
 *
 * Returns a plan report; when applied, data caches are flushed and the app
 * immediately serves the corrected mapping.
 */
function reconcileRecordOrder(dryRun, token, canonicalOverride) {
  const admin = auth.requireAdmin(token);
  const dry = dryRun !== false;

  return canonicalInput_(canonicalOverride).then(function (canonical) {
    return runWithLock_(function () {
      const report = planReconcile_(canonical);
      report.dryRun = dry;
      report.success = true;
      if (report.changed) {
        if (!dry) {
          applyReconcile_(report, admin.email);
          try { require('./records').invalidateDataCache(); } catch (err) {}
        }
      }
      return report;
    });
  });
}

module.exports = {
  reconcileRecordOrder,
  _planReconcile: planReconcile_,
  _applyReconcile: applyReconcile_
};