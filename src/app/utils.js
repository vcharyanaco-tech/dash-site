
/* ---------------------------------- Date picker ---------------------------------- */

var DP_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var DP_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

var datePickerState = {
  open: false,
  input: null,
  month: new Date().getMonth(),
  year: new Date().getFullYear()
};

function parseDateFieldValue(str) {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  return null;
}

function formatDmy(date) {
  return String(date.getDate()).padStart(2, '0') + '.' +
    String(date.getMonth() + 1).padStart(2, '0') + '.' +
    date.getFullYear();
}

function dmyToIso(str) {
  const d = parseDateFieldValue(str);
  if (!d || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function ensureDatePickerPopup() {
  if (getEl('datePickerPopup')) return;
  const div = document.createElement('div');
  div.id = 'datePickerPopup';
  div.className = 'datepicker-popup hidden';
  div.innerHTML =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-dp="prev" aria-label="Previous month">&#8249;</button>' +
    '<div class="dp-title"></div>' +
    '<button type="button" class="dp-nav" data-dp="next" aria-label="Next month">&#8250;</button>' +
    '</div>' +
    '<div class="dp-weekdays">' + DP_WEEKDAYS.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
    '<div class="dp-grid"></div>' +
    '<div class="dp-foot">' +
    '<button type="button" class="dp-btn dp-today" data-dp="today">Today</button>' +
    '<button type="button" class="dp-btn dp-clear" data-dp="clear">Clear</button>' +
    '</div>';
  div.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-dp]');
    if (!btn) return;
    const act = btn.getAttribute('data-dp');
    if (act === 'prev') {
      datePickerState.month--;
      if (datePickerState.month < 0) { datePickerState.month = 11; datePickerState.year--; }
      renderDatePicker();
    } else if (act === 'next') {
      datePickerState.month++;
      if (datePickerState.month > 11) { datePickerState.month = 0; datePickerState.year++; }
      renderDatePicker();
    } else if (act === 'today') {
      const now = new Date();
      datePickerState.month = now.getMonth();
      datePickerState.year = now.getFullYear();
      renderDatePicker();
      if (datePickerState.input) {
        datePickerState.input.value = formatDmy(now);
        datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDatePicker();
      }
    } else if (act === 'clear') {
      if (datePickerState.input) {
        datePickerState.input.value = '';
        datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDatePicker();
      }
    }
  });
  div.addEventListener('click', function (e) {
    const dayBtn = e.target.closest('[data-dp-day]');
    if (!dayBtn) return;
    const d = new Date(datePickerState.year, datePickerState.month, Number(dayBtn.getAttribute('data-dp-day')));
    if (datePickerState.input) {
      datePickerState.input.value = formatDmy(d);
      datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeDatePicker();
  });
  document.body.appendChild(div);
}

function renderDatePicker() {
  const popup = getEl('datePickerPopup');
  if (!popup) return;
  popup.querySelector('.dp-title').textContent = DP_MONTHS[datePickerState.month] + ' ' + datePickerState.year;
  const grid = popup.querySelector('.dp-grid');
  grid.innerHTML = '';
  const first = new Date(datePickerState.year, datePickerState.month, 1);
  const startCol = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(datePickerState.year, datePickerState.month + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDmy(today);
  const parsedSel = datePickerState.input ? parseDateFieldValue(datePickerState.input.value) : null;
  const selStr = parsedSel ? formatDmy(parsedSel) : '';
  for (let i = 0; i < startCol; i++) {
    const blank = document.createElement('span');
    blank.className = 'dp-cell dp-blank';
    grid.appendChild(blank);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'dp-cell';
    cell.setAttribute('data-dp-day', String(d));
    cell.textContent = String(d);
    const dstr = formatDmy(new Date(datePickerState.year, datePickerState.month, d));
    if (dstr === todayStr) cell.classList.add('dp-today');
    if (dstr === selStr) cell.classList.add('dp-selected');
    grid.appendChild(cell);
  }
}

function openDatePicker(input) {
  ensureDatePickerPopup();
  const popup = getEl('datePickerPopup');
  const field = input.closest('.date-field') || input.parentElement;
  const parsed = parseDateFieldValue(input.value);
  if (parsed) {
    datePickerState.month = parsed.getMonth();
    datePickerState.year = parsed.getFullYear();
  } else {
    const now = new Date();
    datePickerState.month = now.getMonth();
    datePickerState.year = now.getFullYear();
  }
  datePickerState.input = input;
  popup.classList.remove('hidden');
  field.appendChild(popup);
  popup.style.top = 'calc(100% + 4px)';
  popup.style.bottom = 'auto';
  const card = input.closest('.modal-card');
  const inputRect = input.getBoundingClientRect();
  const popupH = popup.offsetHeight;
  const cardRect = card ? card.getBoundingClientRect() : null;
  if (cardRect && (inputRect.bottom + popupH + 8 > cardRect.bottom)) {
    popup.style.top = 'auto';
    popup.style.bottom = 'calc(100% + 4px)';
  }
  renderDatePicker();
  datePickerState.open = true;
}

function closeDatePicker() {
  const popup = getEl('datePickerPopup');
  if (popup) popup.classList.add('hidden');
  datePickerState.open = false;
  datePickerState.input = null;
}

function initDatePicker() {
  document.addEventListener('click', function (e) {
    const field = e.target.closest('input[data-datepicker]');
    if (field) {
      e.preventDefault();
      openDatePicker(field);
      return;
    }
    const popup = getEl('datePickerPopup');
    if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target)) {
      closeDatePicker();
    }
  });
}

/* ---------------------------------- Live clock ---------------------------------- */

var clockOffsetMs = 0;

function startLiveClock() {
  renderClock(new Date());
  setInterval(function () { renderClock(new Date(Date.now() + clockOffsetMs)); }, 1000);
  ApiService.getServerTime().then(function (ts) {
    const serverNow = Number(ts);
    if (serverNow > 0) clockOffsetMs = serverNow - Date.now();
  }).catch(function () {});
}

function renderClock(d) {
  const el = getEl('liveClock');
  if (!el) return;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  el.textContent = h + ':' + mm + ':' + ss + ' ' + ampm;
}

/* ---------------------------------- Auto refresh ---------------------------------- */
/* Periodically re-fetches dashboard data in the background (silently) so edits
   made directly in the spreadsheet appear without a manual refresh. Skips when
   the tab is hidden, a modal is open, or a request is already in flight. */

var autoRefreshTimerId = null;
var autoRefreshInFlight = false;

function startAutoRefresh(intervalMs) {
  stopAutoRefresh();
  autoRefreshTimerId = setInterval(function () { autoRefreshTick(); }, intervalMs || 60000);
}

function stopAutoRefresh() {
  if (autoRefreshTimerId) { clearInterval(autoRefreshTimerId); autoRefreshTimerId = null; }
}

function autoRefreshTick() {
  if (autoRefreshInFlight) return;
  if (!getAuthToken()) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (document.body.classList.contains('modal-open')) return;
  autoRefreshInFlight = true;
  const seqAtStart = appState.submissionSeq || 0;
  ApiService.getAppData().then(function (data) {
    autoRefreshInFlight = false;
    if (!data || !data.user || !data.user.loggedIn) {
      setAuthToken('');
      return;
    }
    if ((appState.submissionSeq || 0) !== seqAtStart) {
      // A submission changed while this request was in flight — the payload is
      // stale for submission fields and would revert the card's badge/updates.
      // Discard it and retry shortly so the fresh state wins.
      if (!appState.refreshRetryScheduled) {
        appState.refreshRetryScheduled = true;
        setTimeout(function () {
          appState.refreshRetryScheduled = false;
          autoRefreshTick();
        }, 2000);
      }
      return;
    }
    applyAppData(data);
    populateFilters();
    populateResponsibilitySelect();
    renderDashboard(true);
    refreshCounts();
    generateReviewNotifications();
    EventBus.emit('DataRefreshed');
  }).catch(function (err) {
    autoRefreshInFlight = false;
    if (handleServerFailure(err)) return;
  });
}
