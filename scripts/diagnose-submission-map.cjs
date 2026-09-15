#!/usr/bin/env node
/**
 * ============================================================
 * India Post Dashboard — scripts/diagnose-submission-map.cjs
 * Read-only anomaly check against the LIVE API after the
 * record #17 deletion (run under the pre-c4775e0 code, which
 * renumbered `records` but never cascade-deleted or remapped
 * child rows). Confirms whether submissions / tasks / documents
 * / change-history still map to the record they were created for:
 *
 *   child.recordId === id of the record currently at child.cardRow
 *
 * A mismatch means a child row is showing under the WRONG record.
 *
 * CONFIG (env vars):
 *   LIVE_DASH_BASE            API origin (default https://dashboardharyana.site)
 *   LIVE_DASH_EMAIL           login identifier (email or username)
 *   LIVE_DASH_PASS            login password
 *   LIVE_DASH_TOKEN           pre-issued session token (skips login)
 *   LIVE_DASH_CHECK_SUBS=0    skip the per-record submission sweep
 *                             (an admin account marks unread cards as read,
 *                             so set this for a strictly read-only run)
 *
 * Read-only: every call is a data query. The only server writes are the
 * unavoidable login session and, with an admin token and CHECK_SUBS=1, the
 * submission read-marks. No records or children are modified. Credentials
 * come from env vars/temp file and never appear in output.
 *
 * Exit codes: 0 clean · 1 anomalies found · 2 usage/config error.
 * ============================================================
 */

const BASE = process.env.LIVE_DASH_BASE || 'https://dashboardharyana.site';

// The Cloudflare Worker caps POST /api at 60 per IP per minute, so the script
// self-paces to ~50/min and waits through any 429 it still runs into.
const MIN_SPACING_MS = 1200;
let lastCallAt = 0;

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function jsonPost(fn, fullArgs) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCallAt ? (lastCallAt + MIN_SPACING_MS) - Date.now() : 0;
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    const resp = await fetch(BASE + '/api', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ function: fn, args: fullArgs }),
      signal: AbortSignal.timeout(30000)
    });
    const body = await resp.json();
    if (body && body.retryAfter) {
      const retry = Math.max(Number(body.retryAfter) || 60, 5);
      console.warn('rate limited on ' + fn + ' — waiting ' + retry + 's (attempt ' + (attempt + 1) + '/4)');
      await sleep(retry * 1000);
      continue;
    }
    if (body && body.error && !body.result) throw new Error(fn + ': ' + body.error);
    return body && body.result;
  }
  throw new Error(fn + ': still rate limited after retries');
}

const anomalies = [];
function anomaly(category, detail) {
  anomalies.push('[' + category + '] ' + detail);
  console.log('FAIL [' + category + '] ' + detail);
}
function ok(msg) { console.log('ok   ' + msg); }
const verbose = process.env.LIVE_DASH_VERBOSE === '1';

/* ---- canonical origin (public gviz, read-only, no auth) ---- */
const SHEET_ID = process.env.LIVE_DASH_SHEET_ID || '1xQaysoLjDIqNa5X_QnvA5FWp7J6lMr5r6lzLGalm-y8';
const SHEET_NAME = process.env.LIVE_DASH_SHEET_NAME || 'Sheet1';
const START_ROW = 4;

function norm(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
}
function contentKey(sector, description) {
  return norm(sector) + '|' + norm(description);
}
function trunc(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function fetchCanonical() {
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
    '/gviz/tq?tqx=out:json&headers=' + (START_ROW - 1) + '&sheet=' + encodeURIComponent(SHEET_NAME);
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error('gviz HTTP ' + resp.status);
  let t = await resp.text();
  t = t.replace(/^\/\*O_o\*\//, '').trim();
  const marker = 'setResponse(';
  const idx = t.indexOf(marker);
  if (idx !== -1) t = t.slice(idx + marker.length).replace(/\);\s*$/, '');
  const parsed = JSON.parse(t);
  if (parsed.status === 'error') {
    throw new Error((parsed.errors && parsed.errors[0] && parsed.errors[0].detailed_message) || 'gviz error');
  }
  const rows = (parsed.table && parsed.table.rows) || [];
  return rows.map(function (r, i) {
    function cell(c) {
      if (!c) return '';
      if (c.f !== '' && c.f != null) return String(c.f);
      return c.v != null ? String(c.v) : '';
    }
    const sector = cell(r.c[1]);
    const description = cell(r.c[2]);
    return { displayId: i + 1, row: START_ROW + i, sector: sector, description: description, key: contentKey(sector, description) };
  });
}

async function run() {
  const email = process.env.LIVE_DASH_EMAIL;
  const pass = process.env.LIVE_DASH_PASS;
  let token = process.env.LIVE_DASH_TOKEN;
  let who = token ? 'provided token' : '';

  if (!token) {
    if (!email || !pass) {
      console.error('Set LIVE_DASH_EMAIL + LIVE_DASH_PASS (or LIVE_DASH_TOKEN).');
      process.exit(2);
    }
    const login = await jsonPost('login', [email, pass]);
    if (!login || !login.token) {
      console.error('login failed: ' + (login && login.message ? login.message : 'no token returned'));
      process.exit(2);
    }
    token = login.token;
    who = email;
  }
  ok('authenticated as ' + who);

  const appData = await jsonPost('getAppData', [token]);
  if (!appData || !Array.isArray(appData.items)) {
    console.error('getAppData returned no items — aborting.');
    process.exit(2);
  }

  const recordByRow = {};
  appData.items.forEach(function (it) { recordByRow[Number(it.row)] = it; });
  const rows = Object.keys(recordByRow).map(Number).sort(function (a, b) { return a - b; });
  ok('records: ' + rows.length + ' (rows ' + rows[0] + '..' + rows[rows.length - 1] + ')');

  // Canonical alignment report: live content at each row vs the origin sheet.
  let canonical = [];
  try {
    canonical = await fetchCanonical();
    ok('canonical sheet: ' + canonical.length + ' records');
  } catch (err) {
    ok('canonical sheet unreachable (' + err.message + ') — skipping alignment checks');
    canonical = [];
  }

  const canonByKey = {};
  const canonById = {};
  canonical.forEach(function (c) {
    if (!canonByKey[c.key]) canonByKey[c.key] = c;
    canonById[c.displayId] = c;
  });
  // canonical content -> live row where that content currently lives.
  const liveRowForContent = {};
  rows.forEach(function (row) {
    const rec = recordByRow[row];
    const key = contentKey(rec.sector, rec.description);
    if (!liveRowForContent[key]) liveRowForContent[key] = row;
  });

  if (canonical.length) {
    let mismatches = 0;
    if (verbose) console.log('row | live# | live description            | canon# | canon description         | aligned');
    rows.forEach(function (row) {
      const rec = recordByRow[row];
      const canonIndex = row - START_ROW;
      let align = 'n/a';
      if (canonIndex >= 0 && canonIndex < canonical.length) {
        const canon = canonical[canonIndex];
        const same = contentKey(rec.sector, rec.description) === canon.key;
        align = same ? 'yes' : 'NO';
        if (!same) {
          mismatches++;
          const shiftedNext = canonical[canonIndex + 1] &&
            contentKey(rec.sector, rec.description) === canonical[canonIndex + 1].key;
          anomaly('RECORD-SHIFT',
            'row ' + row + ' holds "' + trunc(rec.description, 40) + '" but canonical #' + canon.displayId +
            ' is "' + trunc(canon.description, 40) + '"' +
            (shiftedNext ? ' — content matches canonical #' + canonical[canonIndex + 1].displayId + ' (offset by one; records compacted below a deleted/absent record)' : ''));
        }
      }
      if (verbose) {
        const canon = canonIndex >= 0 && canonIndex < canonical.length ? canonical[canonIndex] : null;
        console.log('  ' + row + ' | ' + String(rec.id).padEnd(5) + ' | ' + trunc(rec.description, 28).padEnd(29) + ' | ' +
          (canon ? String(canon.displayId).padEnd(6) : 'none  ') + ' | ' +
          (canon ? trunc(canon.description, 28).padEnd(29) : '—') + ' | ' + align);
      }
    });
    if (!mismatches) ok('record alignment vs canonical sheet: clean (' + rows.filter(function (row) { return row - START_ROW < canonical.length; }).length + '/' + canonical.length + ' canonical slots matched)');
  }

  const counts = appData.submissionCounts || {};
  const displayed = Array.isArray(appData.displayedSubmissions) ? appData.displayedSubmissions : [];

  Object.keys(counts).forEach(function (key) {
    if (!recordByRow[Number(key)]) {
      anomaly('COUNT-ORPHAN', 'submissionCounts references row ' + key + ', which has no record today');
    }
  });
  displayed.forEach(function (d) {
    if (!recordByRow[Number(d.cardRow)]) {
      anomaly('DISPLAYED-ORPHAN', 'displayed submission shows under row ' + d.cardRow + ' (' + d.email + '), which has no record today');
    }
  });

  const tasks = await jsonPost('getTasks', [{}, token]);
  if (Array.isArray(tasks)) {
    ok('tasks: ' + tasks.length);
    tasks.forEach(function (t) {
      const rec = recordByRow[Number(t.recordRow)];
      if (!rec) anomaly('TASK-ORPHAN', 'task "' + t.title + '" -> row ' + t.recordRow + ' (no record today)');
      else if (t.recordId && String(t.recordId) !== String(rec.id)) {
        anomaly('TASK-MIS-MAPPED',
          'task "' + t.title + '" on row ' + t.recordRow + ' has recordId ' + t.recordId +
          ', but that row is record #' + rec.id + ' (' + rec.sector + ' · ' + rec.description + ')');
      }
    });
  } else {
    console.error('getTasks returned an unexpected shape — skipped.');
  }

  const checkSubs = process.env.LIVE_DASH_CHECK_SUBS !== '0';
  if (checkSubs) {
    console.warn('note: the per-record submission sweep marks unread cards as read for admin accounts (set LIVE_DASH_CHECK_SUBS=0 to skip).');
  }

  const subIds = {};
  let subsChecked = 0;
  for (const row of rows) {
    const rec = recordByRow[row];

    if (checkSubs) {
      const subs = await jsonPost('getSubmissions', [token, row]);
      if (!Array.isArray(subs)) continue;
      subs.forEach(function (s) {
        subsChecked++;
        if (subIds[s.id]) anomaly('DUP-SUB-ID', 'submission ' + s.id + ' seen on both row ' + subIds[s.id] + ' and row ' + row);
        subIds[s.id] = row;
        if (s.cardId && String(s.cardId) !== String(rec.id)) {
          anomaly('SUB-MIS-MAPPED',
            'submission ' + s.id + ' by ' + s.email + ' carries cardId ' + s.cardId +
            ' but row ' + row + ' is record #' + rec.id + ' (' + rec.sector + ' · ' + rec.description + ')' +
            (Number(s.cardId) > Number(rec.id) ? ' (record #' + s.cardId + ' preceded the deleted record)' : ''));
        }
        // Content-anchored check: the sub must sit where its canonical record
        // (identified by the stored card_id) actually lives today.
        if (canonical.length && s.cardId && /^\d+$/.test(String(s.cardId))) {
          const wantId = Number(s.cardId);
          const canon = canonById[wantId];
          if (canon) {
            const liveRow = liveRowForContent[canon.key];
            if (liveRow == null) {
              anomaly('SUB-ORPHAN-CONTENT',
                'submission ' + s.id + ' references record #' + wantId + ' (' + trunc(canon.sector, 24) + ' · ' + trunc(canon.description, 40) +
                '), which no longer exists on the dashboard — it belongs to a deleted record');
            } else if (liveRow !== row) {
              anomaly('SUB-MIS-PLACED',
                'submission ' + s.id + ' by ' + s.email + ' sits on row ' + row + ' but record #' + wantId +
                ' (' + trunc(canon.sector, 24) + ' · ' + trunc(canon.description, 40) + ') lives on row ' + liveRow +
                ' — it shows under the wrong record');
            }
          }
        }
      });
    }

    const docs = await jsonPost('getRecordDocuments', [row, token]);
    if (Array.isArray(docs)) {
      docs.forEach(function (d) {
        if (d.recordId && String(d.recordId) !== String(rec.id)) {
          anomaly('DOC-MIS-MAPPED',
            'document "' + d.fileName + '" on row ' + row + ' has recordId ' + d.recordId + ', but that row is record #' + rec.id);
        }
      });
    }

    const history = await jsonPost('getRecordHistory', [row, token]);
    if (Array.isArray(history)) {
      history.forEach(function (h) {
        if (h.recordId && String(h.recordId) !== String(rec.id)) {
          anomaly('HISTORY-MIS-MAPPED',
            'change-history on row ' + row + ' has recordId ' + h.recordId + ', but that row is record #' + rec.id);
        }
      });
    }
  }

  console.log('');
  if (anomalies.length) {
    console.log('ANOMALIES FOUND: ' + anomalies.length + ' (see FAIL lines above)');
    process.exit(1);
  }
  console.log(rows.length + ' records · ' +
    (checkSubs ? subsChecked + ' submissions checked' : 'submission sweep skipped') +
    ' · all child rows resolve to their own record — no wrong mapping detected.');
  process.exit(0);
}

run().catch(function (err) {
  console.error('runner error: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});