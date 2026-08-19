/* ============================================================
   SynthLab — composer-ui.js
   Score model + COMPOSER module. A track is built from four
   scenes (A–D). Each scene = one drum pattern + one melody
   pattern. Scenes chain into a song.
   ============================================================ */
(function (root) {
  'use strict';

  const ACCENT = 'var(--c-comp)';
  const SCENE_IDS = ['A', 'B', 'C', 'D'];
  const ROWS = 15; // scale degrees shown, bottom = root

  /* ---------------- Score model ---------------- */

  function emptyDrums() {
    const o = {};
    ['kick', 'snare', 'clap', 'hatC', 'hatO', 'tom', 'rim', 'cow'].forEach((k) => { o[k] = new Array(16).fill(0); });
    return o;
  }
  function emptyMelody() {
    return Array.from({ length: 16 }, () => []);
  }

  const Score = {
    scenes: {},
    sceneId: 'A',
    chain: ['A', 'A', 'B', 'B'],
    playMode: 'scene', // 'scene' | 'chain'
    root: 'C',
    scaleName: 'minor',
    baseOctave: 3,
    gate: 0.8,

    currentScene() { return this.scenes[this.sceneId]; },

    rowMidis() {
      const rootMidi = (this.baseOctave + 1) * 12 + Theory.NOTE_NAMES.indexOf(this.root);
      return Theory.scaleNotes(rootMidi, this.scaleName, ROWS);
    },
  };
  SCENE_IDS.forEach((id) => { Score.scenes[id] = { drums: emptyDrums(), melody: emptyMelody() }; });

  /* ---------------- Composer UI ---------------- */

  let cellEls = []; // [row][step]
  let sceneBtns = {};
  let chainEl = null;
  let modeSwitch = null;

  function build(el) {
    el.innerHTML = '';

    /* Scene strip */
    const strip = div('comp-toolbar');
    strip.appendChild(label('SCENES'));
    sceneBtns = {};
    SCENE_IDS.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scene-btn';
      b.textContent = id;
      b.addEventListener('click', () => {
        Score.sceneId = id;
        paintScenes();
        refreshGrid();
        DrumsUI.refresh();
      });
      sceneBtns[id] = b;
      strip.appendChild(b);
    });
    const copyBtn = smallBtn('Copy scene →', () => {
      const order = SCENE_IDS;
      const next = order[(order.indexOf(Score.sceneId) + 1) % order.length];
      Score.scenes[next] = JSON.parse(JSON.stringify(Score.scenes[Score.sceneId]));
      Score.sceneId = next;
      paintScenes(); refreshGrid(); DrumsUI.refresh();
      Main.flash('Copied to scene ' + next);
    });
    strip.appendChild(copyBtn);

    const demo = document.createElement('button');
    demo.type = 'button';
    demo.className = 'chip chip-comp';
    demo.textContent = '★ Load demo track';
    demo.addEventListener('click', loadDemo);
    strip.appendChild(demo);
    el.appendChild(strip);

    /* Scale + settings row */
    const settings = div('comp-settings');
    settings.appendChild(makeSelect('Key', Theory.NOTE_NAMES, Score.root, (v) => { Score.root = v; refreshGrid(); }));
    settings.appendChild(makeSelect('Scale', [
      ['major', 'Major'], ['minor', 'Minor'], ['dorian', 'Dorian'], ['mixolydian', 'Mixolydian'],
      ['pentatonicMaj', 'Pentatonic maj'], ['pentatonicMin', 'Pentatonic min'], ['blues', 'Blues'],
    ], Score.scaleName, (v) => { Score.scaleName = v; refreshGrid(); }));
    settings.appendChild(makeSelect('Octave', [['2', 'C2'], ['3', 'C3'], ['4', 'C4']], String(Score.baseOctave), (v) => {
      Score.baseOctave = Number(v); refreshGrid();
    }));
    settings.appendChild(Widgets.makeKnob({
      label: 'Gate', accent: ACCENT, min: 0.15, max: 1.5, step: 0.05, value: Score.gate,
      format: (v) => Math.round(v * 100) + '%',
      onChange: (v) => { Score.gate = v; },
    }).el);
    const clearMel = smallBtn('Clear melody', () => {
      Score.currentScene().melody = emptyMelody();
      refreshGrid();
    });
    settings.appendChild(clearMel);
    el.appendChild(settings);

    /* Melody grid */
    const wrap = div('mel-scroll');
    const grid = div('mel-grid');
    cellEls = [];
    const midis = Score.rowMidis();
    for (let r = ROWS - 1; r >= 0; r--) {
      const rowEl = div('mel-row');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'mel-name';
      name.dataset.row = String(r);
      name.textContent = Theory.midiToName(midis[r]);
      name.addEventListener('click', () => {
        const m = Score.rowMidis()[r];
        Engine.playNote(m, Engine.now(), 0.3);
      });
      rowEl.appendChild(name);
      const rowCells = [];
      for (let stp = 0; stp < 16; stp++) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'mel-cell' + (stp % 4 === 0 ? ' beat-head' : '');
        c.addEventListener('click', () => {
          const mel = Score.currentScene().melody;
          const idx = mel[stp].indexOf(r);
          if (idx >= 0) mel[stp].splice(idx, 1);
          else {
            mel[stp].push(r);
            Engine.playNote(Score.rowMidis()[r], Engine.now(), 0.25);
          }
          c.classList.toggle('is-on', idx < 0);
        });
        rowCells.push(c);
        rowEl.appendChild(c);
      }
      cellEls[r] = rowCells;
      grid.appendChild(rowEl);
    }
    wrap.appendChild(grid);
    el.appendChild(wrap);

    /* Chain builder */
    const chainBar = div('chain-bar');
    chainBar.appendChild(label('SONG'));
    modeSwitch = Widgets.makeSwitch({
      label: '', accent: ACCENT, value: Score.playMode,
      options: [{ value: 'scene', text: 'Loop scene' }, { value: 'chain', text: 'Play song' }],
      onChange: (v) => { Score.playMode = v; },
    });
    chainBar.appendChild(modeSwitch.el);
    SCENE_IDS.forEach((id) => {
      const b = smallBtn('+ ' + id, () => {
        Score.chain.push(id);
        paintChain();
      });
      chainBar.appendChild(b);
    });
    const back = smallBtn('⌫', () => { Score.chain.pop(); paintChain(); });
    chainBar.appendChild(back);
    chainEl = div('chain-view');
    chainBar.appendChild(chainEl);
    el.appendChild(chainBar);

    paintScenes();
    paintChain();
    refreshGrid();
  }

  function paintScenes() {
    SCENE_IDS.forEach((id) => {
      if (sceneBtns[id]) sceneBtns[id].classList.toggle('is-on', id === Score.sceneId);
    });
  }

  function paintChain(activeBar) {
    if (!chainEl) return;
    chainEl.innerHTML = '';
    if (!Score.chain.length) {
      const empty = document.createElement('span');
      empty.className = 'chain-empty';
      empty.textContent = 'Add scenes to build a song';
      chainEl.appendChild(empty);
      return;
    }
    Score.chain.forEach((id, i) => {
      const s = document.createElement('span');
      s.className = 'chain-item' + (i === activeBar ? ' is-live' : '');
      s.textContent = id;
      chainEl.appendChild(s);
    });
  }

  function refreshGrid() {
    if (!cellEls.length) return;
    const mel = Score.currentScene().melody;
    const midis = Score.rowMidis();
    for (let r = 0; r < ROWS; r++) {
      const nameBtn = document.querySelector('.mel-name[data-row="' + r + '"]');
      if (nameBtn) nameBtn.textContent = Theory.midiToName(midis[r]);
      for (let stp = 0; stp < 16; stp++) {
        cellEls[r][stp].classList.toggle('is-on', mel[stp].includes(r));
      }
    }
  }

  /** Scene to schedule for a given bar index. */
  function sceneForBar(bar) {
    if (Score.playMode === 'chain' && Score.chain.length) {
      return Score.scenes[Score.chain[bar % Score.chain.length]];
    }
    return Score.currentScene();
  }

  /** Transport hook: schedule one 16th step. */
  function scheduleStep(step16, when) {
    const bar = Math.floor(step16 / 16);
    const stp = step16 % 16;
    const scene = sceneForBar(bar);
    DrumsUI.scheduleStep(scene.drums, stp, when);
    const midis = Score.rowMidis();
    const dur = Transport.sixteenthLength() * Score.gate;
    scene.melody[stp].forEach((r) => {
      if (midis[r] != null) Engine.playNote(midis[r], when, dur, 0.85);
    });
    // visuals
    const delay = Math.max(0, (when - Engine.now()) * 1000);
    setTimeout(() => {
      DrumsUI.highlight(stp);
      highlight(stp);
      if (Score.playMode === 'chain' && Score.chain.length) {
        paintChain(bar % Score.chain.length);
      }
    }, delay);
  }

  function highlight(stp) {
    if (!cellEls.length) return;
    for (let r = 0; r < ROWS; r++) {
      cellEls[r].forEach((c, i) => c.classList.toggle('is-playhead', i === stp));
    }
  }

  function clearPlayhead() {
    DrumsUI.highlight(-1);
    highlight(-1);
    paintChain();
  }

  /* ---------------- demo track ---------------- */

  function loadDemo() {
    Score.root = 'A';
    Score.scaleName = 'minor';
    Score.baseOctave = 3;
    Score.gate = 0.8;
    Score.chain = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'B'];
    Score.playMode = 'chain';
    Transport.bpm = 118;
    Transport.swing = 0.08;

    const S = Score.scenes;
    const D = (str) => str.split('').map(Number);

    // Scene A — sparse intro
    S.A.drums = Object.assign(emptyDrums(), {
      kick: D('1000000010000000'), hatC: D('0010001000100010'), rim: D('0000100000001000'),
    });
    S.A.melody = melodyFrom([
      [0, [0]], [3, [2]], [6, [4]], [10, [3]], [12, [2]],
    ]);

    // Scene B — full groove
    S.B.drums = Object.assign(emptyDrums(), {
      kick: D('1000100010001000'), snare: D('0000100000001000'),
      hatC: D('1010101010101010'), hatO: D('0010001000100010'), clap: D('0000000000001000'),
    });
    S.B.melody = melodyFrom([
      [0, [0, 4]], [2, [2]], [4, [4]], [6, [5]], [8, [4]], [10, [2]], [12, [7]], [14, [5]],
    ]);

    // Scene C — lift
    S.C.drums = Object.assign(emptyDrums(), {
      kick: D('1000100010001010'), snare: D('0000100000001000'),
      hatC: D('1011101110111011'), cow: D('0000000010000000'), clap: D('0000100000001000'),
    });
    S.C.melody = melodyFrom([
      [0, [7]], [2, [9]], [4, [8]], [6, [7]], [8, [5]], [10, [7]], [12, [4]], [14, [2]],
    ]);

    // Scene D — breakdown
    S.D.drums = Object.assign(emptyDrums(), {
      kick: D('1000000000000000'), hatO: D('0000000000001000'), tom: D('0000000010010010'),
    });
    S.D.melody = melodyFrom([
      [0, [0, 2, 4]], [8, [0, 3, 5]],
    ]);

    Score.sceneId = 'B';
    const panel = document.getElementById('panel-composer');
    if (panel) build(panel);
    DrumsUI.refresh();
    if (Main && Main.syncTransportUI) Main.syncTransportUI();
    Main.flash('Demo track loaded — press play');
  }

  function melodyFrom(pairs) {
    const mel = emptyMelody();
    pairs.forEach(([stepIdx, rows]) => { mel[stepIdx] = rows.slice(); });
    return mel;
  }

  /* ---------------- helpers ---------------- */

  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
  function label(t) { const l = document.createElement('span'); l.className = 'bar-label'; l.textContent = t; return l; }
  function smallBtn(text, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-small'; b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function makeSelect(labelText, options, value, onChange) {
    const wrap = div('field');
    const sel = document.createElement('select');
    options.forEach((op) => {
      const [v, t] = Array.isArray(op) ? op : [op, op];
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (v === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = labelText;
    wrap.appendChild(sel);
    wrap.appendChild(lab);
    return wrap;
  }

  root.Score = Score;
  root.ComposerUI = { build, scheduleStep, clearPlayhead, refreshGrid };
})(window);
