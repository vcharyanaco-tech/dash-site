/**
 * ============================================================
 * Circle Office Haryana Dashboard V3
 * RecordService.gs
 * Record CRUD service (every write runs inside the script lock;
 * authorization is checked before the lock is acquired)
 * ============================================================
 */

/**
 * Builds a RichTextValue whose text carries zero or more hyperlinks. Accepts
 * either a single {url, text} object or an array of them (the multi-link
 * format). When a link's text appears within the cell text, only that
 * substring is hyperlinked; otherwise the whole text is linked. Mirrors the
 * Node port's buildTextRuns_ so the sheet round-trips the same links JSON.
 * @param {string} text Full display text.
 * @param {Object|Array<{url: string, text: string}>} links A link object or
 *   an array of them (empty/absent builds plain text).
 * @returns {GoogleAppsScript.Spreadsheet.RichTextValue}
 */
function buildRichTextValue_(text, links) {
  const t = String(text == null ? "" : text);
  const builder = SpreadsheetApp.newRichTextValue().setText(t);
  const list = normalizeLinksField_(links);
  list.forEach(function (link) {
    const url = String(link.url || "");
    if (!url) return;
    const lt = String(link.text || "").trim();
    let idx = -1;
    if (lt) idx = t.indexOf(lt);
    try {
      if (idx >= 0) {
        builder.setLinkUrl(idx, idx + lt.length, url);
      } else {
        builder.setLinkUrl(url);
      }
    } catch (e) {}
  });
  return builder.build();
}

/**
 * Appends a new record to the sheet with an auto-incremented ID, borders
 * and a review-date flag background.
 * @param {Object} item The record payload.
 * @param {string} token Session token (editor+ required).
 * @returns {Object} Fresh getData() payload.
 */
function addRecord_(item, token) {
  const editor = requireEditor_(token);

  return runWithLock_(function () {
    const sheet = getSheet_();
    const normalized = normalizeItemForSheet_(item);

    const lastRow = Math.max(
      sheet.getLastRow(),
      CONFIG.SHEET.START_ROW - 1
    );

    const row = lastRow + 1;

    const id =
      row -
      CONFIG.SHEET.START_ROW +
      1;

    // Plain-value row write: one Advanced batchUpdate round-trip (falls back
    // to classic setValues() automatically). Rich-text links are applied
    // separately below because hyperlinks are not plain values.
    dataWriteValuesBatch_(sheet, [{
      row: row,
      col: 1,
      numRows: 1,
      numCols: CONFIG.SHEET.NUM_COLS,
      values: [[
        id,
        normalized.sector,
        normalized.description,
        normalized.entryDate,
        normalized.action,
        normalized.responsibility,
        normalized.reviewDate
      ]]
    }]);

    const links = normalizeLinksForStorage_(normalized.links || {});
    [
      [COL.SECTOR, "sector"],
      [COL.DESCRIPTION, "description"],
      [COL.ACTION, "action"]
    ].forEach(function (pair) {
      const list = links[pair[1]] || [];
      if (list.length) {
        sheet.getRange(row, pair[0]).setRichTextValue(buildRichTextValue_(normalized[pair[1]], list));
      }
    });

    sheet.getRange(row, 1, 1, CONFIG.SHEET.NUM_COLS).setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      CONFIG.COLORS.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

    sheet
      .getRange(
        row,
        COL.REVIEW_DATE
      )
      .setBackground(
        item.flagged
          ? CONFIG.COLORS.FLAG
          : CONFIG.COLORS.NORMAL
      );

    bumpDataGeneration_();

    try {
      notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'New item added', 'Record #' + id + ' · ' + normalized.sector + (normalized.description ? ' — ' + normalized.description : ''), '', editor.email);
    } catch (err) {}

    return getData();
  });
}

/**
 * Updates an existing record in place, preserving action-cell rich text
 * when the text is unchanged.
 * @param {Object} item The record payload (includes the sheet row number).
 * @param {string} token Session token (editor+ required).
 * @returns {Object} Fresh getData() payload.
 */
function updateRecord_(item, token) {
  const editor = requireEditor_(token);

  return runWithLock_(function () {
    const sheet = getSheet_();
    const normalized = normalizeItemForSheet_(item);
    const row = item.row;

    function toPlainText_(v) {
      if (v == null) return "";
      if (typeof v.getText === "function") { try { return String(v.getText()); } catch (e) {} }
      return String(v);
    }

    // Plain-value cells changed by this update are accumulated into one
    // Advanced batchUpdate round-trip (rich-text/linked cells are written
    // separately because hyperlinks are not plain values).
    const pendingWrites = [];

    function writeIfChanged(col, oldVal, newVal) {
      const o = toPlainText_(oldVal).replace(/\r\n/g, "\n");
      const n = String(newVal == null ? "" : newVal).replace(/\r\n/g, "\n");
      if (o !== n) {
        pendingWrites.push({ row: row, col: col, values: [[newVal]] });
      }
    }

    function readCellState(col) {
      const range = sheet.getRange(row, col);
      let rt = null;
      try { rt = range.getRichTextValue(); } catch (e) { rt = null; }
      const plain = rt ? String(rt.getText()) : String(range.getValue() == null ? "" : range.getValue());
      return { plain: plain, links: rt ? extractLinks_(rt) : [] };
    }

    // Compares a cell's current links JSON against the incoming normalized
    // array form so unchanged cells keep their rich text untouched.
    function sameLinks_(stateLinks, newLinks) {
      const a = JSON.stringify(normalizeLinksField_(stateLinks));
      const b = JSON.stringify(normalizeLinksField_(newLinks));
      return a === b;
    }

    function writeLinkedField(col, state, newVal, newLinks) {
      const o = state.plain.replace(/\r\n/g, "\n");
      const n = String(newVal == null ? "" : newVal).replace(/\r\n/g, "\n");
      const links = normalizeLinksField_(newLinks);
      if (o === n && sameLinks_(state.links, links)) return;
      if (links.length) {
        // Hyperlink-rich text is not a plain value; write it directly.
        sheet.getRange(row, col).setRichTextValue(buildRichTextValue_(newVal, links));
      } else {
        pendingWrites.push({ row: row, col: col, values: [[newVal]] });
      }
    }

    // Read old values and only write changed cells to preserve rich text / hyperlinks
    const links = normalizeLinksForStorage_(normalized.links || {});
    writeIfChanged(COL.ID, sheet.getRange(row, COL.ID).getValue(), normalized.id);
    writeLinkedField(COL.SECTOR, readCellState(COL.SECTOR), normalized.sector, links.sector || []);
    writeLinkedField(COL.DESCRIPTION, readCellState(COL.DESCRIPTION), normalized.description, links.description || []);
    writeIfChanged(COL.ENTRY_DATE, sheet.getRange(row, COL.ENTRY_DATE).getValue(), normalized.entryDate);
    writeLinkedField(COL.ACTION, readCellState(COL.ACTION), normalized.action, links.action || []);
    writeIfChanged(COL.RESPONSIBILITY, sheet.getRange(row, COL.RESPONSIBILITY).getValue(), normalized.responsibility);
    writeIfChanged(COL.REVIEW_DATE, sheet.getRange(row, COL.REVIEW_DATE).getValue(), normalized.reviewDate);

    // Flush all plain-value changes in a single batch round-trip.
    dataWriteValuesBatch_(sheet, pendingWrites);

    sheet
      .getRange(item.row, COL.REVIEW_DATE)
      .setBackground(
        item.flagged
          ? CONFIG.COLORS.FLAG
          : CONFIG.COLORS.NORMAL
      );

    patchCachedDataRow_(row);

    try {
      notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Record updated', 'Record #' + normalized.id + ' · ' + normalized.sector + (normalized.description ? ' — ' + normalized.description : ''), '', editor.email);
    } catch (err) {}

    return getData();
  });
}

/**
 * Deletes a record row and re-sequences the remaining IDs.
 * @param {number} row The physical sheet row to delete.
 * @param {string} token Session token (editor+ required).
 * @returns {Object} Fresh getData() payload.
 */
function deleteRecord_(row, token) {
  const editor = requireEditor_(token);

  return runWithLock_(function () {
    const sheet = getSheet_();
    const deletedId = row >= CONFIG.SHEET.START_ROW ? (row - CONFIG.SHEET.START_ROW + 1) : '';
    sheet.deleteRow(row);
    dataRenumber_();
    bumpDataGeneration_();

    try {
      notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Item deleted', 'Record #' + deletedId + ' was removed from the dashboard.', '', editor.email);
    } catch (err) {}

    return getData();
  });
}

/**
 * Marks a record's review as done by setting the review-date cell background
 * to the configured done colour.
 * @param {number} row The physical sheet row.
 * @param {string} token Session token (admin required).
 * @returns {{items: Object[], summary: Object}} Updated items + summary.
 */
function markReviewDone_(row, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    const sheet = getSheet_();
    sheet.getRange(row, COL.REVIEW_DATE).setBackground(CONFIG.COLORS.REVIEW_DONE);
    logAudit_(ACTIONS.REVIEW_DONE, String(row), 'Marked review as done');
    patchCachedDataRow_(row);

    try {
      notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Review marked done', 'Review for record #' + (row - CONFIG.SHEET.START_ROW + 1) + ' was marked as done.', '', admin.email);
    } catch (err) {}

    const data = getData();
    return {
      items: data.items || [],
      summary: buildSummaryFromItems(data.items || [])
    };
  });
}

/**
 * Reopens a record's review by resetting the review-date cell background to
 * the normal colour, converting it back to "review due" (or unflagged when the
 * review date is further out).
 * @param {number} row The physical sheet row.
 * @param {string} token Session token (admin required).
 * @returns {{items: Object[], summary: Object}} Updated items + summary.
 */
function markReviewNotDone_(row, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    const sheet = getSheet_();
    sheet.getRange(row, COL.REVIEW_DATE).setBackground(CONFIG.COLORS.NORMAL);
    logAudit_(ACTIONS.REVIEW_NOT_DONE, String(row), 'Marked review as not done');
    patchCachedDataRow_(row);

    try {
      notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Review reopened', 'Review for record #' + (row - CONFIG.SHEET.START_ROW + 1) + ' was marked as not done (review due again).', '', admin.email);
    } catch (err) {}

    const data = getData();
    return {
      items: data.items || [],
      summary: buildSummaryFromItems(data.items || [])
    };
  });
}

const RecordService = Object.freeze({
  add: addRecord_,
  update: updateRecord_,
  remove: deleteRecord_,
  markReviewDone: markReviewDone_,
  markReviewNotDone: markReviewNotDone_
});
