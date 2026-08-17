// Report PDF: cells are rendered with lineBreak:false, so any text wider
// than its column overflows into the next column (the "overlapping text"
// bug in emailed report PDFs). truncateToWidth_ must keep every cell within
// its column, and buildPdfBuffer_ must handle long cell values.
const test = require('node:test');
const assert = require('node:assert');

const { truncateToWidth_, buildPdfBuffer_ } = require('../reports');

// Fake width measure: 6px per char (Helvetica 8pt is ~4-5px/char; 6 is a
// safe upper bound for the test's purpose).
const widthFn = function (s) { return s.length * 6; };

test('truncateToWidth_ keeps short text unchanged', function () {
  assert.strictEqual(truncateToWidth_('Short', 100, widthFn), 'Short');
  assert.strictEqual(truncateToWidth_('', 100, widthFn), '');
  assert.strictEqual(truncateToWidth_(null, 100, widthFn), '');
});

test('truncateToWidth_ fits long text into the width with an ellipsis', function () {
  const long = 'A very long description that would overflow its column and overlap the next one';
  const result = truncateToWidth_(long, 120, widthFn);
  assert.ok(widthFn(result) <= 120, 'truncated result fits the width');
  assert.ok(result.endsWith('…'), 'ellipsis appended');
  assert.ok(result.length < long.length, 'text was actually shortened');
});

test('truncateToWidth_ hits the exact width boundary', function () {
  // 20 chars * 6 = 120, exactly the limit → not truncated.
  const exact = 'abcdefghijklmnopqrst';
  assert.strictEqual(truncateToWidth_(exact, 120, widthFn), exact);
  // 21 chars overflows → truncated to 19 chars + ellipsis (120px).
  const over = truncateToWidth_(exact + 'x', 120, widthFn);
  assert.ok(widthFn(over) <= 120);
  assert.strictEqual(over, 'abcdefghijklmnopqrs…');
});

test('buildPdfBuffer_ resolves for records with very long cells', async function () {
  const report = {
    title: 'Test Dashboard',
    generatedOn: new Date(),
    summary: { total: 2, flagged: 1, normal: 1, sectors: { 'A very long sector name that goes on and on and on and on': 2 } },
    items: [
      { id: 1, sector: 'X', description: 'A '.repeat(300) + 'description', entryDate: '2026-01-01', action: 'Follow up with the regional office about the pending approvals and the annual review cycle that was scheduled for last quarter', responsibility: 'Circle Office', reviewDate: '2026-08-18', flagged: true },
      { id: 2, sector: 'Y', description: 'Short', entryDate: '2026-01-02', action: 'N/A', responsibility: 'HQ', reviewDate: '2026-09-01', flagged: false }
    ]
  };
  const buffer = await buildPdfBuffer_(report);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000, 'PDF has content');
});
