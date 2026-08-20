
/* ---------------------------------- Live browser recording ---------------------------------- */

let meetingRecorder = null;
let meetingRecChunks = [];
let meetingRecStream = null;
let meetingRecTimerId = null;
let meetingRecElapsed = 0;
let meetingRecBlob = null;
let meetingRecMimeType = 'audio/webm';
let meetingRecCancelFlag = false;
let meetingRecSourceTracks = null;
let meetingRecAudioCtx = null;

function meetingRecordingFileName_() {
  const titleEl = getEl('meetingNotesTitleInput');
  const raw = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'Review meeting';
  const safe = raw.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return safe + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.webm';
}

function getMeetingRecStream_(useDisplay) {
  var displayTracks = null;
  function fallbackToMic_() {
    if (displayTracks) { displayTracks.forEach(function (t) { try { t.stop(); } catch (e) {} }); displayTracks = null; }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (mic) {
      return { stream: mic, sourceTracks: mic.getTracks(), sourceType: 'mic', audioCtx: null };
    });
  }
  if (!useDisplay) return fallbackToMic_();
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(function (displayStream) {
    displayTracks = displayStream.getTracks();
    displayStream.getVideoTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    var audio = displayStream.getAudioTracks();
    if (!audio.length) throw new Error('The shared tab has no audio to record.');
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (mic) {
      return mixAudioStreams_([audio, mic.getTracks()]).then(function (mixed) {
        return { stream: mixed.stream, sourceTracks: displayTracks.concat(mic.getTracks()), sourceType: 'tab+mic', audioCtx: mixed.audioCtx };
      }).catch(function () {
        return { stream: displayStream, sourceTracks: displayTracks, sourceType: 'tab', audioCtx: null };
      });
    }).catch(function () {
      return { stream: displayStream, sourceTracks: displayTracks, sourceType: 'tab', audioCtx: null };
    });
  }).catch(function (err) {
    return fallbackToMic_();
  });
}

function mixAudioStreams_(trackGroups) {
  return new Promise(function (resolve, reject) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { reject(new Error('AudioContext unsupported')); return; }
      var ctx = new Ctx();
      var dest = ctx.createMediaStreamDestination();
      trackGroups.forEach(function (group) {
        group.forEach(function (track) {
          var src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(dest);
        });
      });
      if (ctx.state === 'suspended') {
        ctx.resume().then(function () { resolve({ stream: dest.stream, audioCtx: ctx }); }, function () { resolve({ stream: dest.stream, audioCtx: ctx }); });
      } else {
        resolve({ stream: dest.stream, audioCtx: ctx });
      }
    } catch (e) { reject(e); }
  });
}

function meetingRecCleanup_() {
  if (meetingRecSourceTracks) {
    meetingRecSourceTracks.forEach(function (t) { try { t.stop(); } catch (e) {} });
    meetingRecSourceTracks = null;
  }
  if (meetingRecAudioCtx) { try { meetingRecAudioCtx.close(); } catch (e) {} meetingRecAudioCtx = null; }
  if (meetingRecStream) {
    try { meetingRecStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    meetingRecStream = null;
  }
}

function startMeetingRecording() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  if (meetingRecorder) { showToast('Recording already in progress.', 'warning'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    showToast('Live recording is not supported in this browser. Use Chrome, Edge, Firefox or Safari.', 'error');
    return;
  }
  var useDisplay = !!(navigator.mediaDevices.getDisplayMedia);
  if (useDisplay) {
    showToast('Select the meeting tab and tick "Share tab audio" (or your screen) to record meeting audio.', 'info');
  }
  getMeetingRecStream_(useDisplay).then(function (result) {
    meetingRecStream = result.stream;
    meetingRecSourceTracks = result.sourceTracks;
    meetingRecAudioCtx = result.audioCtx || null;
    meetingRecChunks = [];
    meetingRecElapsed = 0;
    meetingRecMimeType = 'audio/webm';
    let options = {};
    if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
    else if (window.MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
    meetingRecorder = new MediaRecorder(result.stream, options);
    meetingRecorder.ondataavailable = function (e) { if (e.data && e.data.size) meetingRecChunks.push(e.data); };
    meetingRecorder.onstop = function () {
      const type = (meetingRecorder && meetingRecorder.mimeType) || meetingRecMimeType || 'audio/webm';
      meetingRecBlob = new Blob(meetingRecChunks, { type: type });
      meetingRecChunks = [];
      stopMeetingRecTimer();
      const player = getEl('meetingNotesPlayer');
      if (player) { player.src = URL.createObjectURL(meetingRecBlob); player.style.display = 'block'; }
      meetingRecCleanup_();
      const wasCancel = meetingRecCancelFlag;
      meetingRecCancelFlag = false;
      if (wasCancel) {
        meetingRecBlob = null;
        setMeetingRecStatus('Recording cancelled.');
        return;
      }
      const titleEl = getEl('meetingNotesTitleInput');
      if (titleEl && !titleEl.value.trim()) {
        const d = new Date();
        titleEl.value = 'Review meeting ' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
      }
      setMeetingRecStatus('Recording finished \u2014 sending to Groq\u2026');
      processMeetingNotes();
    };
    meetingRecorder.start(1000);
    const startBtn = getEl('meetingNotesStartBtn');
    const endBtn = getEl('meetingNotesEndBtn');
    const cancelBtn = getEl('meetingNotesCancelBtn');
    const timer = getEl('meetingNotesRecTimer');
    const go = getEl('meetingNotesGo');
    const status = getEl('meetingNotesRecStatus');
    if (startBtn) startBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (timer) timer.style.display = 'inline-flex';
    if (go) { go.disabled = true; go.textContent = 'Recording\u2026'; }
    if (status) status.textContent = '';
    startMeetingRecTimer();
    syncMeetingRecFloat_();
    const note = result.sourceType === 'tab+mic'
      ? 'Recording meeting tab audio + microphone.'
      : (result.sourceType === 'tab' ? 'Recording meeting tab audio. Your voice may not be included.' : 'Recording microphone only.');
    showToast('Recording started. ' + note + ' Click "End recording" when done.', 'info');
  }).catch(function (err) {
    showToast('Could not start recording: ' + (err && err.message ? err.message : String(err || 'error')), 'error');
  });
}

function startMeetingRecTimer() {
  stopMeetingRecTimer();
  const timer = getEl('meetingNotesRecTimer');
  if (timer) {
    timer.textContent = '\u25CF ' + fmtMeetingRecElapsed_();
    const floatTimer = getEl('meetingRecFloatTimer');
    if (floatTimer) floatTimer.textContent = fmtMeetingRecElapsed_();
    meetingRecTimerId = setInterval(function () {
      meetingRecElapsed++;
      const t = fmtMeetingRecElapsed_();
      timer.textContent = '\u25CF ' + t;
      const floatTimer2 = getEl('meetingRecFloatTimer');
      if (floatTimer2) floatTimer2.textContent = t;
    }, 1000);
  }
}

function fmtMeetingRecElapsed_() {
  const m = String(Math.floor(meetingRecElapsed / 60)).padStart(2, '0');
  const s = String(meetingRecElapsed % 60).padStart(2, '0');
  return m + ':' + s;
}

function syncMeetingRecFloat_() {
  const floatBtn = getEl('meetingRecFloat');
  if (!floatBtn) return;
  const recording = !!(meetingRecorder && meetingRecorder.state === 'recording');
  const modal = getEl('meetingNotesModal');
  const modalOpen = modal && !modal.classList.contains('hidden');
  if (recording && !modalOpen) {
    const floatTimer = getEl('meetingRecFloatTimer');
    if (floatTimer) floatTimer.textContent = fmtMeetingRecElapsed_();
    floatBtn.classList.remove('hidden');
  } else {
    floatBtn.classList.add('hidden');
  }
}

function stopMeetingRecTimer() {
  if (meetingRecTimerId) { clearInterval(meetingRecTimerId); meetingRecTimerId = null; }
}

function stopMeetingRecording() {
  if (!meetingRecorder) return;
  meetingRecCancelFlag = false;
  try { meetingRecorder.stop(); } catch (err) {}
  const endBtn = getEl('meetingNotesEndBtn');
  const cancelBtn = getEl('meetingNotesCancelBtn');
  const timer = getEl('meetingNotesRecTimer');
  if (endBtn) { endBtn.disabled = true; endBtn.textContent = 'Processing\u2026'; }
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (timer) timer.textContent = '\u25CF Saving\u2026';
  syncMeetingRecFloat_();
}

function cancelMeetingRecording() {
  meetingRecCancelFlag = true;
  if (meetingRecorder && meetingRecorder.state === 'recording') {
    try { meetingRecorder.stop(); } catch (err) {}
  } else {
    meetingRecBlob = null;
    meetingRecChunks = [];
    meetingRecCleanup_();
    meetingRecorder = null;
    stopMeetingRecTimer();
    resetMeetingRecUi_();
    setMeetingRecStatus('Recording cancelled.');
  }
  syncMeetingRecFloat_();
}

function resetMeetingRecUi_() {
  const startBtn = getEl('meetingNotesStartBtn');
  const endBtn = getEl('meetingNotesEndBtn');
  const cancelBtn = getEl('meetingNotesCancelBtn');
  const timer = getEl('meetingNotesRecTimer');
  if (startBtn) startBtn.style.display = 'inline-flex';
  if (endBtn) { endBtn.style.display = 'none'; endBtn.disabled = false; endBtn.textContent = 'End recording'; }
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (timer) timer.style.display = 'none';
  syncMeetingRecFloat_();
}

function setMeetingRecStatus(msg) {
  const status = getEl('meetingNotesRecStatus');
  if (status) status.textContent = msg || '';
}
