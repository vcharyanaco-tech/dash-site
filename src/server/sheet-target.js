/**
 * ============================================================
 * India Post Dashboard — Node port
 * sheet-target.js
 * Resolving a NAMED cell in a Google Sheet to a concrete A1 range.
 *
 * A change request names a tab and a header ("Sheet1" / "Action"), never a
 * raw column letter. The column is resolved here from the sheet's own header
 * row at the moment of writing, so inserting or reordering a column cannot
 * make a request land on the wrong cell. A raw "C42" captured when the request
 * was raised would silently write to whatever moved into column C.
 *
 * Deliberately pure: no network, no clock, no globals. Everything here is
 * unit-testable, which is where the real risk lives (off-by-one in the
 * column letters, mismatched header duplicates, a tab named like a range).
 * ============================================================
 */

/* A column index -> its spreadsheet letters: 0 -> A, 25 -> Z, 26 -> AA.
   Written out rather than done with a char-code loop because the boundary
   cases (Z -> AA, ZZ -> AAA) are exactly the ones a loop gets wrong. */
function columnLetters_(zeroBasedIndex) {
  const n = Number(zeroBasedIndex);
  if (!isFinite(n) || n < 0) return '';
  let n1 = Math.floor(n) + 1; // 1-based
  let out = '';
  while (n1 > 0) {
    const rem = (n1 - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n1 = Math.floor((n1 - 1) / 26);
  }
  return out;
}

/* A1 notation for a single cell. */
function cellA1_(zeroBasedCol, oneBasedRow) {
  const letters = columnLetters_(zeroBasedCol);
  const row = Number(oneBasedRow);
  if (!letters || !isFinite(row) || row < 1) return '';
  return letters + String(Math.floor(row));
}

/* "Sheet1" -> 'Sheet1'; "Monthly Plan (2026)" -> "'Monthly Plan (2026)'".
   A tab name that needs quoting (spaces, punctuation, or anything that could
   be read as a range/cell reference) must be single-quoted, with any embedded
   apostrophe doubled. */
function quoteTabName_(name) {
  const text = String(name == null ? '' : name).trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_]+$/.test(text)) return text;
  return "'" + text.replace(/'/g, "''") + "'";
}

/* Case- and whitespace-insensitive header comparison. Sheets users type
   "Action " with a trailing space, or "action" in a different case; both must
   resolve to the same column rather than failing the request. */
function headerKey_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find the column index (0-based) whose header matches `headerName`.
 * Returns { index, matches, duplicate } — `duplicate` is reported rather than
 * silently picking one, because two columns with the same header make the
 * target ambiguous and writing to either could be wrong.
 */
function findHeaderColumn_(headerRow, headerName) {
  const wanted = headerKey_(headerName);
  const row = headerRow || [];
  const matches = [];
  for (let i = 0; i < row.length; i++) {
    if (headerKey_(row[i]) === wanted) matches.push(i);
  }
  return { index: matches.length ? matches[0] : -1, matches: matches, duplicate: matches.length > 1 };
}

/**
 * Resolve a named cell against a sheet's grid.
 *
 * opts: { tabName, headerRow, headerName, oneBasedRow }
 * Returns { ok, range, columnIndex, columnLetter, currentValue, reason }.
 * `reason` is a human-readable, safe-to-show explanation when ok is false.
 */
function resolveNamedCell(opts) {
  opts = opts || {};
  const tab = String(opts.tabName == null ? '' : opts.tabName).trim();
  const headerRow = opts.headerRow || [];
  const oneBasedRow = Math.floor(Number(opts.oneBasedRow));

  if (!tab) return { ok: false, reason: 'No tab was named for this request.' };
  if (!isFinite(oneBasedRow) || oneBasedRow < 1) {
    return { ok: false, reason: 'Row must be 1 or greater.' };
  }

  const found = findHeaderColumn_(headerRow, opts.headerName);
  if (found.index === -1) {
    const available = headerRow
      .map(function (h, i) { return { index: i, header: h }; })
      .filter(function (h) { return String(h.header || '').trim() !== ''; })
      .map(function (h) { return String(h.header).trim(); });
    return {
      ok: false,
      reason: 'Column "' + String(opts.headerName || '') + '" is not in the "' + tab +
        '" header row.' + (available.length ? ' Available: ' + available.join(', ') + '.' : '')
    };
  }
  if (found.duplicate) {
    const letters = found.matches.map(columnLetters_).join(' and ');
    return {
      ok: false,
      reason: 'Column "' + String(opts.headerName || '') + '" appears more than once in "' + tab +
        '" (at ' + letters + '). Rename one of them so the target is unambiguous.'
    };
  }

  const letter = columnLetters_(found.index);
  return {
    ok: true,
    range: quoteTabName_(tab) + '!' + cellA1_(found.index, oneBasedRow),
    columnIndex: found.index,
    columnLetter: letter,
    cell: cellA1_(found.index, oneBasedRow)
  };
}

/* Clamp a row number to the sheet's real extent. Sheets silently accepts a
   write to row 10 of a 3-row sheet by growing it, which is how a typo turns
   into a blank appended row that then reads back as a real record. */
function clampRow_(oneBasedRow, rowCount) {
  const row = Math.floor(Number(oneBasedRow));
  const max = Math.floor(Number(rowCount));
  if (!isFinite(row) || row < 1) return 0;
  if (isFinite(max) && max > 0 && row > max) return 0; // 0 = out of range
  return row;
}

module.exports = {
  columnLetters_: columnLetters_,
  cellA1_: cellA1_,
  quoteTabName_: quoteTabName_,
  headerKey_: headerKey_,
  findHeaderColumn_: findHeaderColumn_,
  resolveNamedCell: resolveNamedCell,
  clampRow_: clampRow_,
  __test: {
    columnLetters: columnLetters_,
    cellA1: cellA1_,
    quoteTabName: quoteTabName_,
    findHeaderColumn: findHeaderColumn_
  }
};
