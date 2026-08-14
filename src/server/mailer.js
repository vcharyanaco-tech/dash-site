/**
 * ============================================================
 * India Post Dashboard — Node port
 * mailer.js
 * MailApp replacement. Local-first default: log the email to the
 * console and record it in an outbox file. When SMTP_* env vars are
 * present the email is sent over SMTP (nodemailer).
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const { isValidEmail_, primaryEmail_ } = require('./helpers');

const OUTBOX = process.env.DASH_OUTBOX || path.join(__dirname, '..', '..', 'data', 'outbox.log');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// HTTP transport: post the message over HTTPS (port 443 — allowed on hosts
// that block SMTP ports, e.g. Render free) to the Worker's /api/send-email
// relay, which speaks SMTP to the provider via the TCP connect() API.
function httpTransportConfigured() {
  return String(process.env.MAIL_TRANSPORT || '').toLowerCase() === 'http' &&
    !!(process.env.MAIL_HTTP_URL && process.env.WORKER_API_TOKEN);
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html'
};

function guessMime_(filename) {
  const ext = String(filename || '').toLowerCase().replace(/^.*(\.[a-z0-9]+)$/, '$1');
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function sendViaHttp_(to, subject, body, attachments) {
  const payload = {
    to: to,
    subject: String(subject),
    text: String(body || '')
  };
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments.map(function (a) {
      return {
        filename: a.filename,
        contentType: a.contentType || guessMime_(a.filename),
        contentBase64: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content || '')
      };
    });
  }
  fetch(process.env.MAIL_HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.WORKER_API_TOKEN },
    body: JSON.stringify(payload)
  }).then(function (resp) {
    if (!resp.ok) {
      console.error('sendMail_ http transport failed: HTTP ' + resp.status);
    }
  }, function (err) {
    console.error('sendMail_ http transport failed: ' + err.message);
  });
}

function sendMail_(to, subject, body, attachments) {
  const recipient = primaryEmail_(to);
  if (!recipient || !isValidEmail_(recipient)) return false;
  if (!subject) return false;
  try {
    const entry = JSON.stringify({
      to: recipient,
      subject: String(subject),
      body: String(body || ''),
      attachments: Array.isArray(attachments) ? attachments.map(function (a) { return { filename: a.filename, size: a.content ? a.content.length : 0 }; }) : undefined,
      at: new Date().toISOString()
    });
    try { fs.appendFileSync(OUTBOX, entry + '\n'); } catch (err) {}

    if (httpTransportConfigured()) {
      sendViaHttp_(recipient, subject, body, attachments);
    } else if (smtpConfigured() && nodemailer) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || '') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      const sender = process.env.SMTP_FROM || process.env.SMTP_USER;
      const mail = {
        from: sender,
        to: recipient,
        subject: String(subject),
        text: String(body || '')
      };
      if (Array.isArray(attachments) && attachments.length) {
        mail.attachments = attachments.map(function (a) {
          return { filename: a.filename, content: a.content };
        });
      }
      transporter.sendMail(mail).then(function () {}, function (err) { console.error('sendMail_ failed: ' + err.message); });
    } else {
      console.log('[mailer] to=' + recipient + ' subject=' + subject + (Array.isArray(attachments) && attachments.length ? ' attachments=' + attachments.length : ''));
    }
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { sendMail_, smtpConfigured, httpTransportConfigured };
