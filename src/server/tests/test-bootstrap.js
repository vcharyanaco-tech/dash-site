// Test-only bootstrap secret. Production deployments must provide
// DASH_BOOTSTRAP_ADMIN_PASSWORD through their secret manager.
const crypto = require('crypto');

const password = process.env.DASH_BOOTSTRAP_ADMIN_PASSWORD ||
  crypto.randomBytes(24).toString('base64url') + 'A1!';
process.env.DASH_BOOTSTRAP_ADMIN_PASSWORD = password;

// Keep the shared local test database deterministic without putting a
// credential in the repository. This runs before index.js initializes auth.
const { db } = require('../db');
const { generateSalt_, hashPassword_ } = require('../helpers');
const salt = generateSalt_();
const hash = hashPassword_(password, salt);
const existing = db.prepare('SELECT id FROM users WHERE lower(trim(email)) = ?').get('vcharyanaco@gmail.com');
if (existing) {
  db.prepare('UPDATE users SET role = ?, salt = ?, password_hash = ?, must_change = 0 WHERE id = ?')
    .run('ADMIN', salt, hash, existing.id);
} else {
  db.prepare(
    'INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).run('vcharyanaco@gmail.com', 'ADMIN', salt, hash, 'test', Date.now(), 'co_admin');
}

module.exports = { password };
