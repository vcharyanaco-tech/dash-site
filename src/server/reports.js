/**
 * ============================================================
 * India Post Dashboard — Node port
 * reports.js
 * Report generation: summary/detailed/flagged payloads, .xlsx
 * export, PDF render and email delivery (port of Reports.gs).
 * ============================================================
 */

const auth = require('./auth');
const records = require('./records');
const helpers = require('./helpers');

const JSZip = require('jszip');
const PDFDocument = require('pdfkit');

const { sendMail_ } = require('./mailer');

function getPrintableReport() {
  const data = records.getData();
  return {
    title: records.getTitle_(),
    generatedOn: new Date(),
    summary: helpers.buildSummaryFromItems(data.items || []),
    items: data.items || []
  };
}

function getReportData(token, templateKey) {
  auth.requireLogin(token);
  const data = records.getData();
  const items = data.items || [];
  const key = String(templateKey || 'summary').toLowerCase();
  let filtered = items;
  if (key === 'flagged') filtered = items.filter(function (i) { return i.flagged; });
  return {
    title: records.getTitle_(),
    generatedOn: new Date(),
    template: key,
    summary: helpers.buildSummaryFromItems(filtered),
    items: filtered
  };
}

async function exportToSpreadsheet(token) {
  auth.requireLogin(token);
  const report = getPrintableReport();
  const zip = new JSZip();
  helpers.buildXlsxParts_(report.items).forEach(function (part) {
    zip.file(part.name, part.content);
  });
  const buffer = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = 'IndiaPostDashboard_Report_' + helpers.formatDate_(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
  return { filename: filename, base64: buffer.toString('base64') };
}

function buildPdfBuffer_(report) {
  return new Promise(function (resolve, reject) {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', function (c) { chunks.push(c); });
    doc.on('end', function () { resolve(Buffer.concat(chunks)); });
    doc.on('error', reject);

    const title = report.title || 'India Post Dashboard';
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).text('Generated on ' + helpers.formatDate_(report.generatedOn, 'dd.MM.yyyy HH:mm'), { align: 'center' });
    doc.moveDown();

    const s = report.summary || {};
    doc.fontSize(12).text('Summary');
    doc.fontSize(10)
      .text('Total: ' + s.total + '   Flagged: ' + s.flagged + '   Normal: ' + s.normal);
    doc.moveDown();

    const sectors = Object.keys(s.sectors || {}).sort();
    if (sectors.length) {
      doc.fontSize(12).text('Sector breakdown');
      sectors.forEach(function (key) {
        doc.fontSize(10).text(key + ': ' + s.sectors[key]);
      });
      doc.moveDown();
    }

    doc.fontSize(12).text('Records');
    doc.moveDown(0.3);

    const headers = ['ID', 'Sector', 'Description', 'Entry Date', 'Action', 'Responsibility', 'Review Date', 'Flagged'];
    const colWidths = [34, 70, 140, 62, 110, 90, 70, 46];
    const rowHeight = 14;
    let y = doc.y;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(8);
      doc.save();
      let x = doc.page.margins.left;
      headers.forEach(function (h, i) {
        doc.text(h, x + 2, y + 2, { width: colWidths[i] - 4, lineBreak: false });
        x += colWidths[i];
      });
      doc.restore();
      y += rowHeight;
    }

    function drawRow(row) {
      doc.font('Helvetica').fontSize(8);
      const values = [
        String(row.id),
        String(row.sector || ''),
        String(row.description || ''),
        String(row.entryDate || ''),
        String(row.action || ''),
        String(row.responsibility || ''),
        String(row.reviewDate || ''),
        row.flagged ? 'YES' : 'NO'
      ];
      let x = doc.page.margins.left;
      values.forEach(function (v, i) {
        doc.text(v, x + 2, y + 2, { width: colWidths[i] - 4, lineBreak: false });
        x += colWidths[i];
      });
      y += rowHeight;
    }

    function ensureSpace() {
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
    }

    drawHeader();
    (report.items || []).forEach(function (row) {
      ensureSpace();
      drawRow(row);
    });

    doc.end();
  });
}

async function createPdfReport(token) {
  auth.requireLogin(token);
  const report = getPrintableReport();
  const buffer = await buildPdfBuffer_(report);
  const filename = 'IndiaPostDashboard_Report_' + helpers.formatDate_(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
  return { filename: filename, base64: buffer.toString('base64') };
}

function emailReport(token, recipient, templateKey) {
  auth.requireLogin(token);
  if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    throw new Error('A valid recipient email is required.');
  }
  const key = String(templateKey || 'summary').toLowerCase();
  const report = getReportData(token, key);
  const templateLabel = {
    summary: 'Summary',
    detailed: 'Detailed',
    flagged: 'Flagged only'
  }[key] || 'Summary';
  const subject = report.title + ' — ' + templateLabel + ' report';
  const body = 'Please find attached the ' + templateLabel + ' report generated on ' +
    helpers.formatDate_(new Date(), 'dd.MM.yyyy HH:mm') + '.\n\n' +
    'Summary: ' + report.summary.total + ' total, ' + report.summary.flagged + ' flagged, ' +
    report.summary.normal + ' normal.';

  createPdfReport(token).then(function (pdf) {
    const pdfBuffer = Buffer.from(pdf.base64, 'base64');
    sendMail_(recipient, subject, body, [{ filename: pdf.filename, content: pdfBuffer }]);
  }).catch(function (err) {
    console.error('emailReport PDF generation failed: ' + err.message);
  });

  return { success: true, sentTo: recipient, template: key };
}

module.exports = {
  getPrintableReport,
  getReportData,
  exportToSpreadsheet,
  createPdfReport,
  emailReport
};
