/* ----------------------------------- Imports ----------------------------------- */

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

/* ------------------------------------ Setup ------------------------------------ */

// My Day (Part 5) turns records (reviews/submissions/overdue work) into a
// TODAY summary, so the cold-boot question is real: a user can land on My Day
// (PWA shortcut, command palette, `goto-myday`) before the first getAppData
// resolves. appState.items starts empty and appState.lastUpdated stays '' on
// a cold boot. Painting "All clear" from an empty appState would be a false
// negative that hides overdue work. This test pins that My Day:
//
//   1. Guards the paint with a data-ready check (waits, doesn't guess).
//   2. Subscribes one-shot to the DataRefreshed bus event and re-renders the
//      moment the first refresh lands, so the guard never deadlocks.
//   3. Keeps reviews/submissions fed from records (appState.items), not the
//      narrower own-tasks list.
//   4. Still keeps the original load-failure empty state (no regression: the
//      catch path must survive).
//
// It scans the SOURCE module (the deliverable) directly, so the protection
// holds regardless of build-timing, and re-validates on every CI run.
const MYDAY_SRC = path.join(__dirname, '..', '..', 'app', 'myday.js');
const SRC = fs.readFileSync(MYDAY_SRC, 'utf8');

/* ------------------------------------- Tests ------------------------------------- */

test('My Day guards the cold-boot paint with a data-ready check', function () {
  // The guard is a bare `lastUpdated` check at the top of the build path —
  // if records have not landed yet, hold instead of painting "All clear".
  const i = SRC.indexOf('!appState.lastUpdated');
  assert.ok(i !== -1, 'guard keyed on appState.lastUpdated exists');
  assert.ok(
    SRC.indexOf('!appState.lastUpdated') < SRC.indexOf('renderMyDayContent_('),
    'guard is evaluated before any content is painted'
  );
});

test('My Day waits for the first DataRefreshed in a one-shot, then re-renders', function () {
  // waitForMyDayData_ subscribes on('DataRefreshed') and must remove itself
  // (off) before re-painting — otherwise a stale listener would re-render My
  // Day during a later refresh that is also in flight, hot-replacing the
  // panel underneath the user.
  assert.match(SRC, /function waitForMyDayData_\(panel\)\s*\{/);
  assert.match(SRC, /EventBus\.on\('DataRefreshed',\s*[a-zA-Z_]+\);/);
  assert.match(SRC, /EventBus\.off\('DataRefreshed',\s*[a-zA-Z_]+\);/);
  // The helper must exist as a named function (not inline anonymous) so the
  // on/off pair is obviously symmetric.
  assert.match(SRC, /EventBus\.off\('DataRefreshed',\s*retry\);\s*[\s\S]{0,80}renderMyDay\(\);/);
});

test('My Day feeds reviews/submissions from records, not the own-tasks list', function () {
  // buildMyDayData_ sources records from appState.items (all records), which
  // is what makes "reviews due", "reviews overdue" and submission counts
  // correct. If a future refactor switched these to the narrower own-tasks
  // array, My Day would silently under-count work for other users' records.
  const i = SRC.indexOf('function buildMyDayData_(');
  assert.ok(i !== -1, 'buildMyDayData_ exists');
  const fn = SRC.slice(i);
  assert.match(fn, /appState\.items\s*\|\|\s*\[\]/);
  assert.match(fn, /i\.reviewStatus\s*===\s*'due'/);
  assert.match(fn, /\.reviewStatus\s*===\s*'due'/);
});

test('My Day keeps the load-failure empty state (no regression)', function () {
  // The load-catch must still render the friendly error empty state — the
  // guard must never remove the failure path in the name of "waiting".
  assert.match(SRC, /Could not load your day/);
  assert.match(SRC, /Please try again later/);
});
