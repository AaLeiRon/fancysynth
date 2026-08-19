/* ============================================================
   SynthLab — drums-ui.js
   The DRUMS module: 8 synthesized instruments × 16 steps.
   Cells cycle off → on → accent. State lives in Score.scenes.
   ============================================================ */
(function (root) {
  'use strict';

  const ACCENT = 'var(--c-drums)';
  const TRACKS = [
    { id: 'kick', name: 'Kick' },
    { id: 'snare', name: 'Snare' },
    { id: 'clap', name: 'Clap' },
    { id: 'hatC', name: 'Hat · closed' },
    { id: 'hatO', name: 'Hat · open' },
    { id: 'tom', name: 'Tom' },
    { id: 'rim', name: 'Rim' },
    { id: 'cow', name: 'Cowbell' },
  ];

  const DRUM_PRESETS = {
    'Four on the floor': {
      kick: '1000100010001000', snare: '0000100000001000', clap: '0000000000000000',
      hatC: '1010101010101010', hatO: '0010001000100010', tom: '0000000000000000',
      rim: '0000000000000000', cow: '0000000000000000',
    },
    'Boom bap': {
      kick: '1000000010100000', snare: '0000100000001000', clap: '0000000000000001',
      hatC: '1010101010101010', hatO: '0000000000000010', tom: '0000000000000000',
      rim: '0000001000000000', cow: '0000000000000000',
    },
    'Breakbeat': {
      kick: '1000000001100000', snare: '0000100100001001', clap: '0000000000000000',
      hatC: '1011101110111011', hatO: '0000000000000100', tom: '0000000000010000',
      rim: '0000000000000000', cow: '0000000000000000',
    },
    'Latin heat': {
      kick: '1000001010000010', snare: '0000100000001000', clap: '0000000000000000',
      hatC: '1010101010101010', hatO: '0000000000000000', tom: '0010000100100001',
      rim: '0100010001000100', cow: '1000100010001000',
    },
  };

  let container = null;
  let cellEls = []; // [trackIndex][step]

  function pattern() { return Score.currentScene().drums; }

  function build(el) {
    container = el;
    el.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'drum-toolbar';
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = 'GROOVES';
    head.appendChild(label);
    Object.keys(DRUM_PRESETS).forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip chip-drums'; b.textContent = name;
      b.addEventListener('click', () => { loadPreset(name); });
      head.appendChild(b);
    });
    const clear = document.createElement('button');
    clear.type = 'button'; b3(clear, 'Clear');
    clear.addEventListener('click', () => {
      TRACKS.forEach((t) => { pattern()[t.id] = new Array(16).fill(0); });
      refresh();
    });
    head.appendChild(clear);
    el.appendChild(head);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'drum-scroll';
    const grid = document.createElement('div');
    grid.className = 'drum-grid';
    cellEls = [];

    TRACKS.forEach((t, ti) => {
      const row = document.createElement('div');
      row.className = 'drum-row';

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'drum-name';
      name.textContent = t.name;
      name.title = 'Preview ' + t.name;
      name.addEventListener('click', () => { Engine.playDrum(t.id); });
      row.appendChild(name);

      const cells = [];
      for (let stp = 0; stp < 16; stp++) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'drum-cell' + (stp % 4 === 0 ? ' beat-head' : '');
        c.setAttribute('aria-label', t.name + ' step ' + (stp + 1));
        c.addEventListener('click', () => {
          const p = pattern();
          p[t.id][stp] = (p[t.id][stp] + 1) % 3; // off -> on -> accent
          paintCell(c, p[t.id][stp]);
          if (p[t.id][stp]) Engine.playDrum(t.id, null, p[t.id][stp] === 2);
        });
        cells.push(c);
        row.appendChild(c);
      }
      cellEls.push(cells);
      void ti;
      grid.appendChild(row);
    });

    gridWrap.appendChild(grid);
    el.appendChild(gridWrap);

    // per-track levels
    const mix = document.createElement('div');
    mix.className = 'drum-mix';
    const SHORT = { kick: 'Kick', snare: 'Snare', clap: 'Clap', hatC: 'Hat C', hatO: 'Hat O', tom: 'Tom', rim: 'Rim', cow: 'Cowbell' };
    TRACKS.forEach((t) => {
      mix.appendChild(Widgets.makeKnob({
        label: SHORT[t.id], accent: ACCENT, min: 0, max: 1.2, step: 0.01,
        value: Engine.drums.levels[t.id],
        format: (v) => Math.round(v * 100) + '%',
        onChange: (v) => { Engine.drums.levels[t.id] = v; },
      }).el);
    });
    mix.appendChild(Widgets.makeKnob({
      label: 'Drum bus', accent: ACCENT, min: 0, max: 1.2, step: 0.01,
      value: Engine.drums.volume,
      format: (v) => Math.round(v * 100) + '%',
      onChange: (v) => {
        Engine.drums.volume = v;
        if (Engine.drumBus) Engine.drumBus.gain.setTargetAtTime(v, Engine.now(), 0.02);
      },
    }).el);
    el.appendChild(mix);

    refresh();
  }

  function b3(btn, text) { btn.className = 'btn-small'; btn.textContent = text; }

  function paintCell(c, v) {
    c.classList.toggle('is-on', v === 1);
    c.classList.toggle('is-accent', v === 2);
  }

  function refresh() {
    if (!cellEls.length) return;
    const p = pattern();
    TRACKS.forEach((t, ti) => {
      for (let stp = 0; stp < 16; stp++) paintCell(cellEls[ti][stp], p[t.id][stp]);
    });
  }

  function loadPreset(name) {
    const preset = DRUM_PRESETS[name];
    const p = pattern();
    TRACKS.forEach((t) => {
      p[t.id] = preset[t.id].split('').map(Number);
    });
    refresh();
  }

  /** Called by the transport for every 16th. */
  function scheduleStep(pat, step, when) {
    TRACKS.forEach((t) => {
      const v = pat[t.id][step];
      if (v) Engine.playDrum(t.id, when, v === 2);
    });
  }

  /** Playhead visual. */
  function highlight(step) {
    if (!container || !container.offsetParent) return;
    cellEls.forEach((cells) => {
      cells.forEach((c, i) => c.classList.toggle('is-playhead', i === step));
    });
  }

  root.DrumsUI = { build, refresh, scheduleStep, highlight, TRACKS };
})(window);
