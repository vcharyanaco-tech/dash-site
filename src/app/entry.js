/**
 * src/app/entry.js — ES module entry point for the India Post Dashboard
 *
 * This file is the single entry point loaded by app.html via
 * <script type="module" src="src/app/entry.js">.
 *
 * In development, it loads the 16 individual module scripts in dependency
 * order and attaches their declarations to window (for onclick handlers).
 *
 * In production, app.html loads the pre-built app.js (single file, IIFE-wrapped)
 * instead of this entry point.
 */

// ── Helper: load a script as a classic (non-module) script ────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// ── Module load order (dependency-first) ──────────────────────────────────
// i18n.js loads first (must be available before modules that use it).
// core.js must load second — all other modules depend on its helpers/state.
// session.js must load before dashboard.js (initApp, renderProfile).
// dashboard.js must load before init.js (wireGlobalEvents calls renderDashboard).
// init.js loads last (wires global events, calls initApp on window.load).
const MODULES = [
  'i18n.js',         // i18n translations (EN + HI) — must load before app modules
  'core.js',         // Constants, EventBus, ApiService, state, helpers
  'meetings.js',     // AI Meeting Notes, Fathom
  'recording.js',    // Live audio recording
  'ai.js',           // Per-record AI, link preview
  'session.js',      // Auth, theme, sidebar, notifications
  'dashboard.js',    // Filters, cards, table, analytics
  'audit.js',        // Audit log
  'reports.js',      // Reports, email
  'settings.js',     // Settings, user management
  'detail.js',       // Record detail dialog
  'tasks.js',        // Task management
  'utils.js',        // Date picker, clock, auto-refresh
  'studio.js',       // Dashboard Studio, Command Palette
  'edit.js',         // Edit modal, review badge
  'submissions.js',  // Submissions modal
  'realtime.js',     // SSE real-time, session refresh, keyboard shortcuts
  'init.js',         // About, offline, push, language toggle (loads last)
];

// ── Load all modules sequentially (order matters!) ────────────────────────
(async function () {
  for (const mod of MODULES) {
    try {
      // i18n.js lives in src/, not src/app/
      const src = mod === 'i18n.js' ? `src/${mod}` : `src/app/${mod}`;
      await loadScript(src);
    } catch (err) {
      console.error(`[entry.js] ${err.message}`);
    }
  }

  // Load the offline queue (standalone, not part of the 16 modules)
  try {
    await loadScript('offline-queue.js?v=2026.08.16a');
  } catch (err) {
    console.error(`[entry.js] offline-queue: ${err.message}`);
  }

  console.log(`[entry.js] All ${MODULES.length} modules loaded.`);
})();
