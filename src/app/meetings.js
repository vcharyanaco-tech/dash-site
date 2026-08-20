
/* ---------------------------------- AI Meeting Notes ---------------------------------- */
/* Admin-only: records or uploads a review-meeting audio, transcribes it via
   Groq Whisper, saves audio + minutes to Drive and renders structured minutes.
   Action items become "Create task" buttons plus a bulk "Add all" (never
   auto-created). */

function openMeetingNotes() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  openDialog('meetingNotesModal');
  const title = getEl('meetingNotesTitleInput');
  const file = getEl('meetingNotesFile');
  const body = getEl('meetingNotesResult');
  const loading = getEl('meetingNotesLoading');
  const go = getEl('meetingNotesGo');
  const player = getEl('meetingNotesPlayer');
  if (meetingRecorder && meetingRecorder.state === 'recording') {
    // Reopening the dialog must NOT cancel an active recording. Restore the
    // recording UI (timer / End / Cancel) and keep capturing.
    const startBtn = getEl('meetingNotesStartBtn');
    const endBtn = getEl('meetingNotesEndBtn');
    const cancelBtn = getEl('meetingNotesCancelBtn');
    const timer = getEl('meetingNotesRecTimer');
    if (startBtn) startBtn.style.display = 'none';
    if (endBtn) { endBtn.style.display = 'inline-flex'; endBtn.disabled = false; endBtn.textContent = 'End recording'; }
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (timer) timer.style.display = 'inline-flex';
    if (go) { go.disabled = true; go.textContent = 'Recording\u2026'; }
    if (loading) loading.style.display = 'none';
    startMeetingRecTimer();
  } else {
    if (title) title.value = '';
    if (file) file.value = '';
    if (body) body.innerHTML = '';
    if (loading) loading.style.display = 'none';
    if (go) go.disabled = false;
    if (player) { player.removeAttribute('src'); player.style.display = 'none'; }
    resetMeetingRecUi_();
    setMeetingRecStatus('');
  }
  syncMeetingRecFloat_();
  initFathomPanel();
  loadPreviousMeetings();
}

function closeMeetingNotes() {
  closeDialog('meetingNotesModal');
  // A live recording keeps running in the background; the floating indicator
  // lets the user reopen the dialog and stop it later.
  syncMeetingRecFloat_();
}

/* Previous recordings + notes saved on the server (data/meetings). Admin-only,
   like the rest of the meeting-notes feature. Notes download as editable
   markdown; audio downloads as the original file. Delete removes from the
   server (and its backup) permanently. The search box filters client-side by
   title, file name, or formatted date. */
let previousMeetingsCache = null;

function loadPreviousMeetings() {
  const list = getEl('previousMeetingsList');
  if (!list) return;
  list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">Loading saved recordings &amp; notes\u2026</p>';
  ApiService.listMeetingFiles().then(function (data) {
    if (!data || data.success !== true) {
      list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
        escapeHtml((data && data.message) || 'Could not load saved meetings.') + '</p>';
      return;
    }
    previousMeetingsCache = data;
    renderPreviousMeetings_();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
      escapeHtml(err && err.message ? err.message : String(err)) + '</p>';
  });
}

function filterPreviousMeetings() {
  renderPreviousMeetings_();
}

function localDayKey_(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const pad = function (v) { return String(v).padStart(2, '0'); };
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

function previousMeetingGroup_(modified) {
  const k = localDayKey_(modified);
  if (!k) return 'earlier';
  const todayKey = localDayKey_(new Date());
  if (k === todayKey) return 'today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (k === localDayKey_(y)) return 'yesterday';
  return 'earlier';
}

function renderPreviousMeetings_() {
  const list = getEl('previousMeetingsList');
  const input = getEl('meetingsSearchInput');
  if (!list) return;
  const data = previousMeetingsCache;
  if (!data) {
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">No saved meetings yet — recordings and notes appear here after you transcribe one.</p>';
    return;
  }
  const q = input ? String(input.value || '').trim().toLowerCase() : '';
  const matches = function (f) {
    if (!q) return true;
    const hay = ((f.title || '') + ' ' + (f.name || '') + ' ' + formatTimestamp(f.modified)).toLowerCase();
    return hay.indexOf(q) !== -1;
  };
  const itemRow = function (f) {
    const kind = /\.md$/i.test(f.name) ? 'notes (.md)' : 'recording';
    return '<div class="fathom-meeting-item">' +
      '<div class="fathom-meeting-title">' + escapeHtml(f.title) + '</div>' +
      '<div class="fathom-meeting-meta">' + escapeHtml(formatTimestamp(f.modified)) + ' &middot; ' +
      formatFileSize(f.size) + ' &middot; ' + kind + '</div>' +
      '<div class="fathom-meeting-actions">' +
      '<button class="btn btn-small btn-secondary" type="button" onclick="downloadMeetingFile(\'' + escapeAttr(f.name) + '\')">Download</button>' +
      '<button class="btn btn-small btn-danger-ghost" type="button" onclick="deleteMeetingFile(\'' + escapeAttr(f.name) + '\')">Delete</button>' +
      '</div></div>';
  };
  const all = (data.notes || []).concat(data.audio || []).filter(matches);
  if (!all.length) {
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
      (q ? 'No saved meetings match \u201C' + escapeHtml(input ? input.value : '') + '\u201D.' : 'No saved meetings yet — recordings and notes appear here after you transcribe one.') +
      '</p>';
    return;
  }
  const groups = { today: [], yesterday: [], earlier: [] };
  all.forEach(function (f) { groups[previousMeetingGroup_(f.modified)].push(f); });
  const labels = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' };
  let html = '<div class="meeting-notes-list">';
  ['today', 'yesterday', 'earlier'].forEach(function (g) {
    if (!groups[g].length) return;
    html += '<div class="meeting-date-group">' + labels[g] + '</div>';
    groups[g].forEach(function (f) { html += itemRow(f); });
  });
  html += '</div>';
  list.innerHTML = html;
}

function downloadMeetingFile(name) {
  if (!name) return;
  showOverlay('Preparing download\u2026');
  ApiService.getMeetingFile(name).then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      showToast((data && data.message) || 'Could not download the file.', 'error');
      loadPreviousMeetings();
      return;
    }
    let bytes;
    try {
      bytes = atob(data.base64);
    } catch (err) {
      showToast('Could not decode the file.', 'error');
      return;
    }
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: data.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.name || name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    showToast('Downloaded ' + (data.name || name), 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Download failed: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

function deleteMeetingFile(name) {
  if (!name) return;
  if (!window.confirm('Delete \u201C' + name + '\u201D from the server? This cannot be undone.')) return;
  ApiService.deleteMeetingFile(name).then(function (data) {
    if (data && data.success === true) {
      showToast('Deleted ' + name, 'success');
    } else {
      showToast((data && data.message) || 'Could not delete the file.', 'error');
    }
    loadPreviousMeetings();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Delete failed: ' + (err && err.message ? err.message : String(err)), 'error');
    loadPreviousMeetings();
  });
}

function processMeetingNotes() {
  const fileInput = getEl('meetingNotesFile');
  const go = getEl('meetingNotesGo');
  const loading = getEl('meetingNotesLoading');
  const body = getEl('meetingNotesResult');
  let file = null;
  if (fileInput && fileInput.files && fileInput.files.length) {
    file = fileInput.files[0];
  } else if (meetingRecBlob) {
    file = new File([meetingRecBlob], meetingRecordingFileName_(), { type: meetingRecMimeType });
  }
  if (!file) {
    showToast('Record or choose an audio file first.', 'warning');
    return;
  }
  const titleEl = getEl('meetingNotesTitleInput');
  const title = titleEl ? titleEl.value.trim() : '';
  if (go) go.disabled = true;
  if (loading) loading.style.display = 'flex';
  if (body) body.innerHTML = '';

  // Files over the 25 MB cap cannot be sent in one request; re-encode locally
  // into ~5-minute segments so the raw file never crosses the limit. Long
  // recordings also go straight to segments: a single request on a long file
  // makes Groq churn for minutes and can trip Cloudflare's origin timeout.
  if (file.size > 25 * 1024 * 1024) {
    processMeetingNotesSegmented(file, title, go, loading);
    return;
  }

  readAudioBuffer_(file).then(function (audioBuffer) {
    if (audioBuffer.duration > MEETING_SEGMENT_SECONDS * 2) {
      processMeetingNotesSegmented(file, title, go, loading);
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      const base64 = String(reader.result || '').replace(/^data:[^;]*;base64,/, '');
      ApiService.processMeetingRecording({
        title: title,
        base64: base64,
        mimeType: file.type || 'audio/mpeg',
        fileName: file.name
      }).then(function (data) {
        if (!data || data.success !== true) {
          const msg = (data && data.message) || 'Could not process the recording.';
          // Groq rejects some encodings (e.g. mixed sample-rate VBR MP3) with a
          // generic "Internal Server Error". Retry through the local re-encode path.
          if (msg === 'Internal Server Error') {
            return processMeetingNotesSegmented(file, title, go, loading);
          }
          showToast(msg, 'error');
          renderMeetingMinutesError(msg);
          return;
        }
        renderMeetingMinutes(data);
      }).catch(function (err) {
        if (handleServerFailure(err)) return;
        const msg = err && err.message ? err.message : String(err || 'Unknown error');
        // Timeouts (e.g. Cloudflare 524 while Groq churns through a long file)
        // and transient failures retry through the local re-encode path.
        if (/^HTTP \d{3}/.test(msg)) {
          return processMeetingNotesSegmented(file, title, go, loading);
        }
        showToast(msg, 'error');
        renderMeetingMinutesError(msg);
      }).then(function () {
        if (go) go.disabled = false;
        if (go) go.textContent = 'Transcribe & summarize';
        if (loading) loading.style.display = 'none';
        resetMeetingRecUi_();
      });
    };
    reader.onerror = function () {
      showToast('Could not read the audio file.', 'error');
      if (go) go.disabled = false;
    };
    reader.readAsDataURL(file);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    showToast(msg, 'error');
    renderMeetingMinutesError(msg);
    if (go) go.disabled = false;
  });
}

/* Fallback for recordings that exceed the 25 MB single-request cap or that
   Groq refuses to decode: decode in the browser, split into ~5-minute chunks,
   re-encode each as a compact 16 kHz mono WAV, then transcribe + draft minutes
   via sequential API calls. Each segment is retried on transient failures and
   the run continues past a bad segment instead of aborting everything. */
const MEETING_SEGMENT_SECONDS = 5 * 60;
const MEETING_SEGMENT_SAMPLE_RATE = 16000;
const MEETING_SEGMENT_MAX_ATTEMPTS = 3;

function processMeetingNotesSegmented(file, title, go, loading) {
  if (go) go.disabled = true;
  if (loading) {
    loading.style.display = 'flex';
    setMeetingNotesLoadingText(loading, 'Decoding audio in the browser\u2026');
  }
  readAudioBuffer_(file).then(function (audioBuffer) {
    const totalSeconds = audioBuffer.duration;
    const count = Math.max(1, Math.ceil(totalSeconds / MEETING_SEGMENT_SECONDS));
    const transcripts = [];
    const failures = [];
    let index = 0;
    const runNext = function () {
      if (index >= count) {
        const combined = transcripts.join('\n').trim();
        if (!combined) {
          renderMeetingMinutesError('No segments could be transcribed' +
            (failures.length ? ' (parts ' + failures.join(', ') + ')' : '') + '.');
          return;
        }
        setMeetingNotesLoadingText(loading, 'Drafting minutes\u2026');
        return ApiService.generateMeetingMinutes({ title: title, transcript: combined }).then(function (data) {
          if (!data || data.success !== true) {
            const msg = (data && data.message) || 'Could not draft the minutes.';
            showToast(msg, 'error');
            renderMeetingMinutesError(msg);
            return;
          }
          renderMeetingMinutes(data);
        });
      }
      const partNum = index + 1;
      const start = index * MEETING_SEGMENT_SECONDS;
      const duration = Math.min(MEETING_SEGMENT_SECONDS, totalSeconds - start);
      setMeetingNotesLoadingText(loading, 'Re-encoding + transcribing part ' + partNum + ' of ' + count + '\u2026');
      return transcribeSegmentWithRetry_(audioBuffer, start, duration, partNum, title, loading).then(function (text) {
        if (text) transcripts.push(text);
        else failures.push(partNum);
        index++;
        return runNext();
      });
    };
    return runNext();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    showToast(msg, 'error');
    renderMeetingMinutesError(msg);
  }).then(function () {
    if (go) go.disabled = false;
    if (go) go.textContent = 'Transcribe & summarize';
    if (loading) loading.style.display = 'none';
    resetMeetingRecUi_();
  });
}

/* Transcribes one segment, retrying on transient HTTP/network failures. Returns
   the transcript, or '' if the segment could not be transcribed after all
   attempts (the caller continues with the remaining segments). */
function transcribeSegmentWithRetry_(audioBuffer, start, duration, partNum, title, loading) {
  let attempt = 0;
  const tryOnce = function () {
    attempt++;
    if (attempt > 1) {
      setMeetingNotesLoadingText(loading, 'Retrying part ' + partNum + ' (attempt ' + attempt + ')\u2026');
    }
    return encodeWavSegment_(audioBuffer, start, duration).then(function (wav) {
      return ApiService.transcribeMeetingSegment({
        title: title,
        base64: wav.base64,
        mimeType: 'audio/wav',
        fileName: 'part_' + partNum + '.wav'
      });
    }).then(function (data) {
      if (!data || data.success !== true) {
        throw new Error((data && data.message) || 'Could not transcribe part ' + partNum + '.');
      }
      return String(data.transcript || '').trim();
    }).catch(function (err) {
      if (handleServerFailure(err)) throw err;
      const msg = err && err.message ? err.message : String(err || '');
      if (attempt < MEETING_SEGMENT_MAX_ATTEMPTS && /^(HTTP|TypeError|NetworkError|Failed to fetch)/.test(msg)) {
        return new Promise(function (resolve) { setTimeout(resolve, 1500 * attempt); }).then(tryOnce);
      }
      throw err;
    });
  };
  return tryOnce().catch(function () {
    return '';
  });
}

function setMeetingNotesLoadingText(loading, msg) {
  if (!loading) return;
  const span = loading.querySelector('span:last-child');
  if (span) span.textContent = msg || '';
}

function readAudioBuffer_(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return Promise.reject(new Error('Audio decoding is not supported in this browser. Use Chrome, Edge, Firefox or Safari.'));
  }
  const ctx = new Ctx();
  return file.arrayBuffer().then(function (buf) {
    return ctx.decodeAudioData(buf);
  }).then(function (buffer) {
    if (ctx.close) ctx.close();
    return buffer;
  });
}

function encodeWavSegment_(audioBuffer, startSeconds, durationSeconds) {
  const rate = MEETING_SEGMENT_SAMPLE_RATE;
  const OffCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frames = Math.max(1, Math.ceil(durationSeconds * rate));
  const off = new OffCtx(1, frames, rate);
  const src = off.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(off.destination);
  src.start(0, startSeconds, durationSeconds);
  return off.startRendering().then(function (rendered) {
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = function (offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve({ blob: blob, base64: String(reader.result || '').replace(/^data:[^;]*;base64,/, '') });
      };
      reader.onerror = function () { reject(new Error('Could not read the re-encoded audio.')); };
      reader.readAsDataURL(blob);
    });
  });
}

function renderMeetingMinutesError(msg) {
  const body = getEl('meetingNotesResult');
  if (!body) return;
  body.innerHTML = '<div class="meeting-notes-error">' + escapeHtml(msg) + '</div>';
}

function renderMeetingMinutes(data) {
  const body = getEl('meetingNotesResult');
  if (!body) return;
  const minutes = (data && data.minutes) || {};
  const summary = String(minutes.summary || '').trim();
  const decisions = Array.isArray(minutes.decisions) ? minutes.decisions : [];
  const actions = Array.isArray(minutes.actionItems) ? minutes.actionItems : [];
  const risks = Array.isArray(minutes.risks) ? minutes.risks : [];
  const meetingTitle = String((data && data.title) || 'Review meeting');
  let html = '<div class="meeting-notes-wrap">';
  if (data && data.fathomUrl) {
    html += '<div class="meeting-notes-drive">' +
      '<span>&#128279; Fathom recording: <a href="' + escapeHtml(data.fathomUrl) + '" target="_blank" rel="noopener noreferrer">Open in Fathom</a></span>' +
      '</div>';
  }
  if (summary) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Summary</span></div>' +
      '<div class="meeting-notes-section"><p>' + escapeHtml(summary) + '</p></div>';
  }
  if (actions.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Action items (' + actions.length + ')</span>' +
      '<button class="btn btn-small btn-secondary" type="button" onclick="addAllMeetingTasks()">Add all as tasks</button></div>' +
      '<table class="card-ai-table meeting-notes-table"><thead><tr>' +
      '<th>Task</th><th>Assignee</th><th>Priority</th><th>Due</th><th></th>' +
      '</tr></thead><tbody>';
    actions.forEach(function (a, i) {
      const task = String((a && a.task) || '').trim() || ('Action item ' + (i + 1));
      const assignee = String((a && a.assignee) || '').trim();
      const priority = String((a && a.priority) || 'MEDIUM').toUpperCase();
      const due = String((a && a.dueDate) || '').trim();
      html += '<tr>' +
        '<td>' + escapeHtml(task) + '</td>' +
        '<td>' + escapeHtml(assignee || '\u2014') + '</td>' +
        '<td><span class="meeting-priority" data-priority="' + escapeHtml(priority) + '">' + escapeHtml(priority) + '</span></td>' +
        '<td>' + escapeHtml(due || '\u2014') + '</td>' +
        '<td><button class="btn btn-small btn-secondary" type="button" onclick="createTaskFromMeetingAction(this)" data-title="' + escapeHtml(task) + '" data-assignee="' + escapeHtml(assignee) + '" data-priority="' + escapeHtml(priority) + '" data-due="' + escapeHtml(due) + '">Create task</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }
  if (decisions.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Decisions</span></div>' +
      '<ul class="meeting-notes-list">' + decisions.map(function (d) {
        return '<li>' + escapeHtml(String(d)) + '</li>';
      }).join('') + '</ul>';
  }
  if (risks.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Risks</span></div>' +
      '<ul class="meeting-notes-list">' + risks.map(function (r) {
        return '<li>' + escapeHtml(String(r)) + '</li>';
      }).join('') + '</ul>';
  }
  if (data && data.minutesText && !summary && !decisions.length && !actions.length && !risks.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Minutes</span></div>' +
      '<div class="meeting-notes-section"><p>' + escapeHtml(data.minutesText) + '</p></div>';
  }
  if (data && data.transcript) {
    const chars = data.transcriptChars || data.transcript.length;
    html += '<div class="card-ai-head"><span class="card-ai-title">Full transcript (' + chars + ' chars)</span>' +
      '<button class="btn btn-small btn-ghost" type="button" onclick="toggleMeetingTranscript()">Show</button></div>' +
      '<div id="meetingTranscript" class="meeting-notes-transcript hidden"><pre>' + escapeHtml(data.transcript) + '</pre></div>';
  }
  if (data && (data.driveAudio || data.driveMinutes)) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Saved to Drive</span></div>' +
      '<div class="meeting-notes-drive">' +
      (data.driveAudio ? '<span>&#127911; <a href="' + escapeHtml(data.driveAudio.url) + '" target="_blank" rel="noopener noreferrer">Audio</a></span>' : '') +
      (data.driveAudio && data.driveMinutes ? '<span class="meeting-drive-sep">&nbsp;&middot;&nbsp;</span>' : '') +
      (data.driveMinutes ? '<span>&#128196; <a href="' + escapeHtml(data.driveMinutes.url) + '" target="_blank" rel="noopener noreferrer">Minutes</a></span>' : '') +
      '</div>';
  }
  if (html === '<div class="meeting-notes-wrap">') {
    html += '<p style="color:var(--muted);font-size:14px;">Transcription succeeded (' + escapeHtml(meetingTitle) +
      '), but no minutes were generated. Try again.</p>';
  }
  html += '</div>';
  body.innerHTML = html;
  // A fresh transcription just saved new audio + notes on the server.
  loadPreviousMeetings();
}

function toggleMeetingTranscript() {
  const pre = getEl('meetingTranscript');
  if (!pre) return;
  pre.classList.toggle('hidden');
  const head = pre.previousElementSibling;
  const btn = head ? head.querySelector('button') : null;
  if (btn) btn.textContent = pre.classList.contains('hidden') ? 'Show' : 'Hide';
}

function createTaskFromMeetingAction(btn) {
  const params = {
    title: btn.getAttribute('data-title') || '',
    description: 'Created from meeting notes: ' + (btn.getAttribute('data-title') || ''),
    assignee: btn.getAttribute('data-assignee') || '',
    priority: btn.getAttribute('data-priority') || 'MEDIUM',
    dueDate: btn.getAttribute('data-due') || ''
  };
  showOverlay('Creating task\u2026');
  ApiService.createTask(params).then(function () {
    hideOverlay();
    btn.disabled = true;
    btn.textContent = 'Created';
    showToast('Task created.', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not create task: ' + (err.message || err), 'error');
  });
}

/* Bulk-creates tasks for every action item currently rendered. */
function addAllMeetingTasks() {
  const rows = Array.prototype.slice.call(document.querySelectorAll('#meetingNotesResult .meeting-notes-table tbody tr'));
  const items = [];
  rows.forEach(function (tr) {
    const btn = tr.querySelector('button[data-title]');
    if (!btn) return;
    items.push({
      title: btn.getAttribute('data-title') || '',
      assignee: btn.getAttribute('data-assignee') || '',
      priority: btn.getAttribute('data-priority') || 'MEDIUM',
      dueDate: btn.getAttribute('data-due') || ''
    });
  });
  if (!items.length) { showToast('No action items to add.', 'warning'); return; }
  showConfirm({
    title: 'Add ' + items.length + ' task(s)?',
    message: 'Create ' + items.length + ' task(s) from the meeting action items? They will appear in the Tasks dashboard.',
    okLabel: 'Add tasks'
  }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Adding tasks\u2026');
    const calls = items.map(function (it) {
      return ApiService.createTask({
        title: it.title,
        description: 'Created from meeting notes: ' + it.title,
        assignee: it.assignee,
        priority: it.priority,
        dueDate: it.dueDate
      });
    });
    Promise.all(calls).then(function () {
      hideOverlay();
      rows.forEach(function (tr) {
        const btn = tr.querySelector('button[data-title]');
        if (btn) { btn.disabled = true; btn.textContent = 'Created'; }
      });
      const bulkBtn = document.querySelector('#meetingNotesResult .card-ai-head button[onclick="addAllMeetingTasks()"]');
      if (bulkBtn) { bulkBtn.disabled = true; bulkBtn.textContent = 'Added'; }
      showToast(items.length + ' task(s) created.', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not add tasks: ' + (err && err.message ? err.message : String(err)), 'error');
    });
  });
}

/* ---------------------------------- Fathom AI meeting notes ---------------------------------- */
/* Admin-only: pulls summaries/transcripts/action items recorded by Fathom into
   the AI Meeting Notes modal. API key is stored server-side via setFathomApiKey
   (Script Properties) and never committed to the repo. */

let fathomMeetingsCache = [];

function initFathomPanel() {
  const list = getEl('fathomList');
  const keyRow = getEl('fathomKeyRow');
  const loadBtn = getEl('fathomLoadBtn');
  const status = getEl('fathomStatus');
  if (list) list.innerHTML = '';
  if (keyRow) keyRow.classList.add('hidden');
  if (loadBtn) loadBtn.disabled = false;
  if (status) status.textContent = '';
  ApiService.getFathomStatus().then(function (data) {
    const f = data && data.fathom;
    if (!f) return;
    if (!f.enabled) {
      if (status) status.textContent = 'Fathom integration is not enabled on the server.';
      if (loadBtn) loadBtn.style.display = 'none';
      return;
    }
    if (!f.configured) {
      if (status) status.textContent = 'Enter a Fathom API key to pull notes (Settings \u2192 API Access).';
      if (keyRow) keyRow.classList.remove('hidden');
      if (loadBtn) loadBtn.style.display = 'none';
      return;
    }
    if (loadBtn) loadBtn.style.display = 'inline-flex';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function saveFathomApiKey() {
  const input = getEl('fathomApiKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) { showToast('Paste your Fathom API key first.', 'warning'); return; }
  showOverlay('Saving key\u2026');
  ApiService.setFathomApiKey(key).then(function (res) {
    hideOverlay();
    if (res && res.ok) {
      if (input) input.value = '';
      showToast('Fathom API key saved.', 'success');
      initFathomPanel();
    } else {
      showToast((res && res.message) || 'Could not save the key.', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not save the key: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

function loadFathomMeetings() {
  const list = getEl('fathomList');
  const status = getEl('fathomStatus');
  const loadBtn = getEl('fathomLoadBtn');
  if (loadBtn) loadBtn.disabled = true;
  if (status) status.textContent = 'Loading recent Fathom meetings\u2026';
  if (list) list.innerHTML = '';
  ApiService.listFathomMeetings({}).then(function (data) {
    if (loadBtn) loadBtn.disabled = false;
    if (status) status.textContent = '';
    if (!data || data.success !== true) {
      if (status) status.textContent = (data && data.message) || 'Could not load Fathom meetings.';
      return;
    }
    fathomMeetingsCache = data.items || [];
    renderFathomMeetingList(fathomMeetingsCache);
  }).catch(function (err) {
    if (loadBtn) loadBtn.disabled = false;
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function renderFathomMeetingList(items) {
  const list = getEl('fathomList');
  const status = getEl('fathomStatus');
  if (!list) return;
  if (!items.length) {
    if (status) status.textContent = 'No Fathom meetings found yet.';
    return;
  }
  if (status) status.textContent = items.length + ' meeting(s) found \u2014 pick one to pull its notes.';
  let html = '<div class="fathom-meeting-list">';
  items.forEach(function (m, i) {
    const date = m.createdAt ? formatTimestamp(m.createdAt) : '';
    const actionCount = (m.actionItems && m.actionItems.length) || 0;
    html += '<div class="fathom-meeting-item" role="button" tabindex="0" onclick="viewFathomMeeting(' + i + ')">' +
      '<div class="fathom-meeting-title">' + escapeHtml(m.title) + '</div>' +
      '<div class="fathom-meeting-meta">' + escapeHtml(date) +
      (m.recordedBy ? ' &middot; ' + escapeHtml(m.recordedBy) : '') +
      (actionCount ? ' &middot; ' + actionCount + ' action item(s)' : '') + '</div>' +
      (m.summary ? '<div class="fathom-meeting-summary">' + escapeHtml(m.summary.substring(0, 220)) + '</div>' : '') +
      '<span class="btn btn-small btn-secondary" style="pointer-events:none;">View notes</span>' +
      '</div>';
  });
  html += '</div>';
  list.innerHTML = html;
}

function viewFathomMeeting(index) {
  const m = fathomMeetingsCache[index];
  if (!m) return;
  const body = getEl('meetingNotesResult');
  if (body) body.innerHTML = '<p class="meeting-notes-hint">Loading Fathom notes\u2026</p>';
  ApiService.getFathomMeetingContent(m.recordingId).then(function (data) {
    if (!data || data.success !== true) {
      renderMeetingMinutesError((data && data.message) || 'Could not load this meeting\u2019s content.');
      return;
    }
    const actionItems = (m.actionItems || []).map(function (a) {
      return {
        task: a.task || '',
        assignee: a.assignee || '',
        priority: 'MEDIUM',
        dueDate: ''
      };
    });
    renderMeetingMinutes({
      title: m.title,
      minutes: {
        summary: m.summary || '',
        decisions: [],
        actionItems: actionItems,
        risks: []
      },
      transcript: data.transcript || '',
      transcriptChars: data.transcriptChars || 0,
      fathomUrl: m.shareUrl || m.url || ''
    });
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    renderMeetingMinutesError(err && err.message ? err.message : String(err));
  });
}
