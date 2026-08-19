/* ============================================================
   SynthLab — main.js
   Wires everything: transport bar (play, tempo, swing, record),
   the amber LCD oscilloscope, module tabs and toasts.
   ============================================================ */
(function (root) {
  'use strict';

  const Main = {};
  let playBtn, recBtn, bpmKnob, swingKnob, scopeCanvas, scopeCtx, lcdStatus;
  let isRecording = false;
  let lastExportUrl = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    buildTransport();
    buildTabs();

    SynthUI.build(document.getElementById('panel-synth'));
    DrumsUI.build(document.getElementById('panel-drums'));
    ComposerUI.build(document.getElementById('panel-composer'));
    GuitarUI.build(document.getElementById('panel-guitar'));

    Transport.onStep((step, when) => ComposerUI.scheduleStep(step, when));

    // one-time unlock hint
    document.body.addEventListener('pointerdown', () => Engine.resume(), { once: true });

    drawScope();
  }

  /* ---------------- transport ---------------- */

  function buildTransport() {
    const bar = document.getElementById('transport');

    playBtn = document.getElementById('btn-play');
    playBtn.addEventListener('click', togglePlay);
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        togglePlay();
      }
    });

    recBtn = document.getElementById('btn-rec');
    recBtn.addEventListener('click', toggleRecord);

    const knobs = document.getElementById('transport-knobs');
    bpmKnob = Widgets.makeKnob({
      label: 'Tempo', accent: 'var(--c-amber)', min: 50, max: 200, step: 1, value: Transport.bpm,
      format: (v) => Math.round(v) + ' BPM',
      onChange: (v) => { Transport.bpm = Math.round(v); updateLCD(); },
    });
    swingKnob = Widgets.makeKnob({
      label: 'Swing', accent: 'var(--c-amber)', min: 0, max: 0.5, step: 0.01, value: Transport.swing,
      format: (v) => Math.round(v * 200) + '%',
      onChange: (v) => { Transport.swing = v; },
    });
    knobs.appendChild(bpmKnob.el);
    knobs.appendChild(swingKnob.el);

    scopeCanvas = document.getElementById('scope');
    scopeCtx = scopeCanvas.getContext('2d');
    lcdStatus = document.getElementById('lcd-status');
    updateLCD();
    void bar;
  }

  function togglePlay() {
    if (Transport.isPlaying) {
      Transport.stop();
      ComposerUI.clearPlayhead();
      playBtn.classList.remove('is-on');
      playBtn.innerHTML = '<span class="tri"></span> PLAY';
    } else {
      Transport.start();
      playBtn.classList.add('is-on');
      playBtn.innerHTML = '<span class="sq"></span> STOP';
    }
    updateLCD();
  }

  async function toggleRecord() {
    Engine.resume();
    if (!Engine.canRecord()) {
      Main.flash('Recording is not supported in this browser');
      return;
    }
    if (!isRecording) {
      Engine.startRecording();
      isRecording = true;
      recBtn.classList.add('is-rec');
      recBtn.textContent = '● REC…';
      Main.flash('Recording the master output — play something!');
    } else {
      const blob = await Engine.stopRecording();
      isRecording = false;
      recBtn.classList.remove('is-rec');
      recBtn.textContent = '● REC';
      if (blob && blob.size) {
        if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
        lastExportUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = lastExportUrl;
        const ext = (blob.type || '').includes('mp4') ? 'm4a' : 'webm';
        a.download = 'synthlab-take.' + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        Main.flash('Take exported — check your downloads');
      }
    }
    updateLCD();
  }

  function updateLCD() {
    if (!lcdStatus) return;
    const mode = Transport.isPlaying
      ? (Score.playMode === 'chain' ? 'SONG' : 'SCENE ' + Score.sceneId)
      : 'READY';
    lcdStatus.textContent =
      Math.round(Transport.bpm) + ' BPM · ' + mode + (isRecording ? ' · REC' : '');
  }
  Main.syncTransportUI = function () {
    if (bpmKnob) bpmKnob.set(Transport.bpm);
    if (swingKnob) swingKnob.set(Transport.swing);
    updateLCD();
  };

  /* ---------------- oscilloscope ---------------- */

  function drawScope() {
    requestAnimationFrame(drawScope);
    const w = scopeCanvas.width, h = scopeCanvas.height;
    scopeCtx.clearRect(0, 0, w, h);

    // faint grid
    scopeCtx.strokeStyle = 'rgba(255,177,0,0.14)';
    scopeCtx.lineWidth = 1;
    scopeCtx.beginPath();
    for (let x = 0; x <= w; x += w / 8) { scopeCtx.moveTo(x, 0); scopeCtx.lineTo(x, h); }
    for (let y = 0; y <= h; y += h / 4) { scopeCtx.moveTo(0, y); scopeCtx.lineTo(w, y); }
    scopeCtx.stroke();

    scopeCtx.strokeStyle = '#FFB100';
    scopeCtx.lineWidth = 2;
    scopeCtx.shadowColor = 'rgba(255,177,0,0.7)';
    scopeCtx.shadowBlur = 6;
    scopeCtx.beginPath();

    if (Engine.analyser) {
      const data = new Uint8Array(Engine.analyser.fftSize);
      Engine.analyser.getByteTimeDomainData(data);
      const step = data.length / w;
      for (let x = 0; x < w; x++) {
        const v = data[Math.floor(x * step)] / 128 - 1;
        const y = h / 2 + v * (h / 2 - 4);
        if (x === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
      }
    } else {
      scopeCtx.moveTo(0, h / 2);
      scopeCtx.lineTo(w, h / 2);
    }
    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
  }

  /* ---------------- tabs ---------------- */

  function buildTabs() {
    const tabs = Array.from(document.querySelectorAll('.rail-btn'));
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabs.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.panel').forEach((p) => {
          p.classList.toggle('is-active', p.id === 'panel-' + btn.dataset.panel);
        });
      });
    });
  }

  /* ---------------- toasts ---------------- */

  let toastTimer = null;
  Main.flash = function (msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 2600);
  };

  function isTyping(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  root.Main = Main;
})(window);
