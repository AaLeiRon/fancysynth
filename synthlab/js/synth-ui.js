/* ============================================================
   SynthLab — synth-ui.js
   The SYNTH module: oscillators, filter, envelope, LFO, FX
   knobs and the playable two-octave keyboard.
   ============================================================ */
(function (root) {
  'use strict';

  const ACCENT = 'var(--c-synth)';
  const KEY_MAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8,
    h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, 'ö': 16,
  };
  let baseOctave = 4; // C4 = midi 60
  const heldKeys = new Set();
  const heldMidi = new Set();

  function build(container) {
    const s = Engine.synth;
    const W = Widgets;

    container.innerHTML = '';
    const grid = div('synth-grid');

    /* --- OSC 1 --- */
    const osc1 = section('OSC 1', 'The main voice');
    osc1.body.appendChild(W.makeSwitch({
      label: 'Wave', accent: ACCENT, value: s.osc1.wave,
      options: waveOptions(),
      onChange: (v) => { s.osc1.wave = v; },
    }).el);
    osc1.body.appendChild(W.makeKnob({
      label: 'Octave', accent: ACCENT, min: -2, max: 2, step: 1, value: s.osc1.octave,
      format: (v) => (v > 0 ? '+' + v : String(v)),
      onChange: (v) => { s.osc1.octave = v; },
    }).el);
    osc1.body.appendChild(W.makeKnob({
      label: 'Level', accent: ACCENT, min: 0, max: 1, step: 0.01, value: s.osc1.level,
      format: pct, onChange: (v) => { s.osc1.level = v; },
    }).el);

    /* --- OSC 2 --- */
    const osc2 = section('OSC 2', 'Layer & detune');
    osc2.body.appendChild(W.makeSwitch({
      label: 'Wave', accent: ACCENT, value: s.osc2.wave,
      options: waveOptions(),
      onChange: (v) => { s.osc2.wave = v; },
    }).el);
    osc2.body.appendChild(W.makeKnob({
      label: 'Octave', accent: ACCENT, min: -2, max: 2, step: 1, value: s.osc2.octave,
      format: (v) => (v > 0 ? '+' + v : String(v)),
      onChange: (v) => { s.osc2.octave = v; },
    }).el);
    osc2.body.appendChild(W.makeKnob({
      label: 'Detune', accent: ACCENT, min: -50, max: 50, step: 1, value: s.osc2.detune,
      format: (v) => v + '¢', onChange: (v) => { s.osc2.detune = v; },
    }).el);
    osc2.body.appendChild(W.makeKnob({
      label: 'Level', accent: ACCENT, min: 0, max: 1, step: 0.01, value: s.osc2.level,
      format: pct, onChange: (v) => { s.osc2.level = v; },
    }).el);

    /* --- FILTER --- */
    const filt = section('FILTER', 'Shape the tone');
    filt.body.appendChild(W.makeSwitch({
      label: 'Type', accent: ACCENT, value: s.filter.type,
      options: [
        { value: 'lowpass', text: 'LP' },
        { value: 'highpass', text: 'HP' },
        { value: 'bandpass', text: 'BP' },
      ],
      onChange: (v) => { s.filter.type = v; Engine.applySynthParams(); },
    }).el);
    filt.body.appendChild(W.makeKnob({
      label: 'Cutoff', accent: ACCENT, min: 60, max: 14000, value: s.filter.cutoff, log: true, step: 1,
      format: hz, onChange: (v) => { s.filter.cutoff = v; Engine.applySynthParams(); },
    }).el);
    filt.body.appendChild(W.makeKnob({
      label: 'Reso', accent: ACCENT, min: 0.1, max: 24, step: 0.1, value: s.filter.q,
      format: (v) => v.toFixed(1), onChange: (v) => { s.filter.q = v; Engine.applySynthParams(); },
    }).el);

    /* --- ENVELOPE --- */
    const env = section('ENVELOPE', 'Attack to release');
    [['attack', 'Attack', 0.001, 2], ['decay', 'Decay', 0.01, 2], ['sustain', 'Sustain', 0, 1], ['release', 'Release', 0.02, 4]]
      .forEach(([key, label, min, max]) => {
        env.body.appendChild(W.makeKnob({
          label, accent: ACCENT, min, max, step: 0.01, value: s.env[key],
          format: key === 'sustain' ? pct : sec,
          onChange: (v) => { s.env[key] = v; },
        }).el);
      });

    /* --- LFO --- */
    const lfo = section('LFO', 'Movement');
    lfo.body.appendChild(W.makeSwitch({
      label: 'Target', accent: ACCENT, value: s.lfo.target,
      options: [{ value: 'filter', text: 'Filter' }, { value: 'pitch', text: 'Pitch' }],
      onChange: (v) => { s.lfo.target = v; Engine.applySynthParams(); },
    }).el);
    lfo.body.appendChild(W.makeKnob({
      label: 'Rate', accent: ACCENT, min: 0.1, max: 20, step: 0.1, value: s.lfo.rate, log: true,
      format: (v) => v.toFixed(1) + ' Hz', onChange: (v) => { s.lfo.rate = v; Engine.applySynthParams(); },
    }).el);
    lfo.body.appendChild(W.makeKnob({
      label: 'Depth', accent: ACCENT, min: 0, max: 1, step: 0.01, value: s.lfo.depth,
      format: pct, onChange: (v) => { s.lfo.depth = v; Engine.applySynthParams(); },
    }).el);

    /* --- FX --- */
    const fx = section('EFFECTS', 'Space & grit');
    fx.body.appendChild(W.makeKnob({
      label: 'Drive', accent: ACCENT, min: 0, max: 1, step: 0.01, value: s.fx.drive,
      format: pct, onChange: (v) => { Engine.init(); Engine.setDrive(v); },
    }).el);
    fx.body.appendChild(W.makeKnob({
      label: 'Delay', accent: ACCENT, min: 0, max: 0.6, step: 0.01, value: s.fx.delayMix,
      format: pct, onChange: (v) => { s.fx.delayMix = v; Engine.applySynthParams(); },
    }).el);
    fx.body.appendChild(W.makeKnob({
      label: 'Dly time', accent: ACCENT, min: 0.05, max: 1, step: 0.01, value: s.fx.delayTime,
      format: sec, onChange: (v) => { s.fx.delayTime = v; Engine.applySynthParams(); },
    }).el);
    fx.body.appendChild(W.makeKnob({
      label: 'Feedback', accent: ACCENT, min: 0, max: 0.85, step: 0.01, value: s.fx.delayFeedback,
      format: pct, onChange: (v) => { s.fx.delayFeedback = v; Engine.applySynthParams(); },
    }).el);
    fx.body.appendChild(W.makeKnob({
      label: 'Reverb', accent: ACCENT, min: 0, max: 0.8, step: 0.01, value: s.fx.reverbMix,
      format: pct, onChange: (v) => { s.fx.reverbMix = v; Engine.applySynthParams(); },
    }).el);
    fx.body.appendChild(W.makeKnob({
      label: 'Volume', accent: ACCENT, min: 0, max: 1, step: 0.01, value: s.volume,
      format: pct, onChange: (v) => { s.volume = v; Engine.applySynthParams(); },
    }).el);

    [osc1, osc2, filt, env, lfo, fx].forEach((sec2) => grid.appendChild(sec2.el));
    container.appendChild(grid);

    /* --- Presets --- */
    const presetBar = div('preset-bar');
    presetBar.appendChild(labelEl('PRESETS'));
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-synth';
      b.textContent = p.name;
      b.addEventListener('click', () => { applyPreset(p); build(container); });
      presetBar.appendChild(b);
    });
    container.appendChild(presetBar);

    /* --- Keyboard --- */
    container.appendChild(buildKeyboard());
  }

  /* ---------------- keyboard ---------------- */

  function buildKeyboard() {
    const wrap = div('kbd-wrap');
    const head = div('kbd-head');
    const octLabel = document.createElement('span');
    octLabel.className = 'kbd-oct';
    const setOctText = () => { octLabel.textContent = 'Octave C' + baseOctave; };
    setOctText();

    const mkOctBtn = (txt, d) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-small'; b.textContent = txt;
      b.addEventListener('click', () => {
        baseOctave = Math.min(6, Math.max(1, baseOctave + d));
        setOctText();
      });
      return b;
    };
    head.appendChild(mkOctBtn('OCT −', -1));
    head.appendChild(octLabel);
    head.appendChild(mkOctBtn('OCT +', 1));
    const hint = document.createElement('span');
    hint.className = 'kbd-hint';
    hint.textContent = 'Play with your computer keys: A W S E D F T G H U J K … · Z / X shift octave';
    head.appendChild(hint);
    wrap.appendChild(head);

    const kb = div('kbd');
    kb.setAttribute('role', 'group');
    kb.setAttribute('aria-label', 'Playable keyboard');
    const WHITE = [0, 2, 4, 5, 7, 9, 11];
    const keys = [];
    for (let i = 0; i <= 24; i++) {
      const midiOffset = i;
      const pitchClass = i % 12;
      const isBlack = !WHITE.includes(pitchClass);
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key ' + (isBlack ? 'key-black' : 'key-white');
      key.dataset.offset = String(midiOffset);
      const down = (e) => {
        e.preventDefault();
        const midi = baseOctave * 12 + 12 + midiOffset;
        pressVisual(midiOffset, true);
        Engine.noteOn(midi);
        heldMidi.add(midi);
        key.dataset.midi = String(midi);
      };
      const up = () => {
        const midi = Number(key.dataset.midi || (baseOctave * 12 + 12 + midiOffset));
        pressVisual(midiOffset, false);
        Engine.noteOff(midi);
        heldMidi.delete(midi);
      };
      key.addEventListener('pointerdown', down);
      key.addEventListener('pointerup', up);
      key.addEventListener('pointerleave', up);
      keys.push(key);
    }
    // layout: whites in a row; blacks absolutely positioned
    const whites = keys.filter((k) => k.classList.contains('key-white'));
    whites.forEach((k) => kb.appendChild(k));
    // position blacks after layout
    requestAnimationFrame(() => {
      keys.forEach((k) => {
        if (!k.classList.contains('key-black')) return;
        kb.appendChild(k);
        const off = Number(k.dataset.offset);
        // count whites before this key
        let whitesBefore = 0;
        for (let j = 0; j < off; j++) if (WHITE.includes(j % 12)) whitesBefore++;
        k.style.left = 'calc(' + whitesBefore + ' * (100% / ' + whites.length + ') - 1.6%)';
      });
    });
    wrap.appendChild(kb);

    function pressVisual(offset, on) {
      const el = kb.querySelector('[data-offset="' + offset + '"]');
      if (el) el.classList.toggle('is-pressed', on);
    }
    buildKeyboard._pressVisual = pressVisual;
    return wrap;
  }

  /* computer keyboard */
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (isTyping(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === 'x') { baseOctave = Math.min(6, baseOctave + 1); return; }
    if (k === 'z') { baseOctave = Math.max(1, baseOctave - 1); return; }
    if (!(k in KEY_MAP) || heldKeys.has(k)) return;
    // only play when synth or composer tab is visible
    heldKeys.add(k);
    const midi = baseOctave * 12 + 12 + KEY_MAP[k];
    Engine.noteOn(midi);
    heldMidi.add(midi);
    if (buildKeyboard._pressVisual) buildKeyboard._pressVisual(KEY_MAP[k], true);
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (!heldKeys.has(k)) return;
    heldKeys.delete(k);
    const midi = baseOctave * 12 + 12 + KEY_MAP[k];
    Engine.noteOff(midi);
    heldMidi.delete(midi);
    if (buildKeyboard._pressVisual) buildKeyboard._pressVisual(KEY_MAP[k], false);
  });
  window.addEventListener('blur', () => {
    heldKeys.clear();
    for (const m of Array.from(heldMidi)) Engine.noteOff(m);
    heldMidi.clear();
  });

  function isTyping(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  /* ---------------- presets ---------------- */

  const PRESETS = [
    {
      name: 'Warm Keys',
      patch: { osc1: { wave: 'triangle', octave: 0, level: 0.9 }, osc2: { wave: 'sine', octave: -1, detune: 4, level: 0.5 },
        filter: { type: 'lowpass', cutoff: 3800, q: 1 }, env: { attack: 0.01, decay: 0.35, sustain: 0.5, release: 0.5 },
        lfo: { rate: 5, depth: 0, target: 'filter' }, fx: { drive: 0, delayTime: 0.3, delayFeedback: 0.3, delayMix: 0.12, reverbMix: 0.3 } },
    },
    {
      name: 'Acid Bass',
      patch: { osc1: { wave: 'sawtooth', octave: -1, level: 0.9 }, osc2: { wave: 'square', octave: -1, detune: 3, level: 0.4 },
        filter: { type: 'lowpass', cutoff: 700, q: 14 }, env: { attack: 0.003, decay: 0.16, sustain: 0.15, release: 0.12 },
        lfo: { rate: 6, depth: 0.15, target: 'filter' }, fx: { drive: 0.4, delayTime: 0.19, delayFeedback: 0.25, delayMix: 0.08, reverbMix: 0.05 } },
    },
    {
      name: 'Dream Pad',
      patch: { osc1: { wave: 'sawtooth', octave: 0, level: 0.7 }, osc2: { wave: 'sawtooth', octave: 0, detune: 12, level: 0.7 },
        filter: { type: 'lowpass', cutoff: 1600, q: 2 }, env: { attack: 0.8, decay: 1, sustain: 0.8, release: 2.2 },
        lfo: { rate: 0.4, depth: 0.3, target: 'filter' }, fx: { drive: 0, delayTime: 0.45, delayFeedback: 0.45, delayMix: 0.25, reverbMix: 0.55 } },
    },
    {
      name: 'Laser Lead',
      patch: { osc1: { wave: 'square', octave: 0, level: 0.85 }, osc2: { wave: 'sawtooth', octave: 1, detune: 9, level: 0.45 },
        filter: { type: 'lowpass', cutoff: 5200, q: 7 }, env: { attack: 0.005, decay: 0.12, sustain: 0.55, release: 0.2 },
        lfo: { rate: 6.5, depth: 0.25, target: 'pitch' }, fx: { drive: 0.25, delayTime: 0.24, delayFeedback: 0.4, delayMix: 0.28, reverbMix: 0.18 } },
    },
    {
      name: 'Glass Bells',
      patch: { osc1: { wave: 'sine', octave: 1, level: 0.9 }, osc2: { wave: 'triangle', octave: 2, detune: 5, level: 0.35 },
        filter: { type: 'bandpass', cutoff: 2600, q: 3 }, env: { attack: 0.004, decay: 0.9, sustain: 0.1, release: 1.4 },
        lfo: { rate: 4, depth: 0.06, target: 'pitch' }, fx: { drive: 0, delayTime: 0.38, delayFeedback: 0.5, delayMix: 0.3, reverbMix: 0.5 } },
    },
  ];

  function applyPreset(p) {
    const s = Engine.synth;
    Object.assign(s.osc1, p.patch.osc1);
    Object.assign(s.osc2, p.patch.osc2);
    Object.assign(s.filter, p.patch.filter);
    Object.assign(s.env, p.patch.env);
    Object.assign(s.lfo, p.patch.lfo);
    Object.assign(s.fx, p.patch.fx);
    Engine.init();
    Engine.setDrive(p.patch.fx.drive);
    Engine.applySynthParams();
  }

  /* ---------------- helpers ---------------- */

  function waveOptions() {
    return [
      { value: 'sine', text: '∿' },
      { value: 'triangle', text: '⋀' },
      { value: 'sawtooth', text: '⩘' },
      { value: 'square', text: '⊓' },
    ];
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function sec(v) { return v >= 1 ? v.toFixed(2) + ' s' : Math.round(v * 1000) + ' ms'; }
  function hz(v) { return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz'; }
  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
  function labelEl(text) { const l = document.createElement('span'); l.className = 'bar-label'; l.textContent = text; return l; }
  function section(title, sub) {
    const el = div('module');
    const h = div('module-head');
    h.innerHTML = '<span class="module-title">' + title + '</span><span class="module-sub">' + sub + '</span>';
    const body = div('module-body');
    el.appendChild(h); el.appendChild(body);
    return { el, body };
  }

  root.SynthUI = { build };
})(window);
