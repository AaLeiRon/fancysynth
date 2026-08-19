/* ============================================================
   SynthLab — guitar-ui.js
   The GUITAR module:
   · chord library with SVG fingering diagrams + strum playback
   · song chord writer: pick a key, get progressions, transpose
   · tab composer: click the fretboard, get real ASCII tab
   ============================================================ */
(function (root) {
  'use strict';

  const QUALITIES = [
    ['', 'maj'], ['m', 'min'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'],
    ['sus2', 'sus2'], ['sus4', 'sus4'],
  ];

  const state = {
    chordRoot: 'C',
    chordQuality: '',
    songKey: 'C',
    songMode: 'major',
    songChords: [],   // chord symbols
    tabColumns: [],   // see Theory.renderTab
    pendingNotes: [], // notes staged for current tab column
    playTimer: null,
  };

  function build(el) {
    el.innerHTML = '';
    const grid = div('guitar-grid');

    grid.appendChild(buildChordLibrary());
    grid.appendChild(buildSongWriter());
    el.appendChild(grid);
    el.appendChild(buildTabComposer());
  }

  /* ================= chord library ================= */

  function buildChordLibrary() {
    const box = module('CHORD LIBRARY', 'Every shape, ready to strum');
    const controls = div('chord-controls');

    const rootSel = select(Theory.NOTE_NAMES, state.chordRoot, (v) => { state.chordRoot = v; renderChord(); });
    const qualSel = select(QUALITIES, state.chordQuality, (v) => { state.chordQuality = v; renderChord(); });
    controls.appendChild(field(rootSel, 'Root'));
    controls.appendChild(field(qualSel, 'Type'));

    const diagWrap = div('chord-diagram-wrap');
    const info = div('chord-info');
    const btns = div('chord-actions');

    const strumD = smallBtn('▼ Strum down', () => strumCurrent(1));
    const strumU = smallBtn('▲ Strum up', () => strumCurrent(-1));
    const arp = smallBtn('≋ Arpeggio', () => {
      const v = currentVoicing();
      if (!v) return;
      Engine.strum(Theory.voicingToMidi(v), null, 1, 0.16);
    });
    const addToSong = smallBtn('+ Add to song', () => {
      state.songChords.push(state.chordRoot + state.chordQuality);
      renderSongChords();
      Main.flash('Added ' + state.chordRoot + state.chordQuality + ' to your song');
    });
    const addToTab = smallBtn('+ Add to tab', () => {
      const v = currentVoicing();
      if (!v) return;
      const notes = [];
      v.frets.forEach((f, i) => { if (f >= 0) notes.push({ string: 6 - i, fret: f }); });
      state.tabColumns.push({ type: 'notes', notes });
      renderTabOutput();
      strumCurrent(1);
    });
    [strumD, strumU, arp, addToSong, addToTab].forEach((b) => btns.appendChild(b));

    box.body.appendChild(controls);
    box.body.appendChild(diagWrap);
    box.body.appendChild(info);
    box.body.appendChild(btns);

    function renderChord() {
      const symbol = state.chordRoot + state.chordQuality;
      const v = Theory.guitarVoicing(symbol);
      diagWrap.innerHTML = '';
      if (!v) {
        info.textContent = 'No standard voicing for ' + symbol + ' — try another type.';
        return;
      }
      diagWrap.appendChild(chordSVG(symbol, v, 150));
      const names = Theory.voicingToMidi(v).map((m) => Theory.midiToName(m)).join(' · ');
      info.textContent = names + (v.barre ? '  ·  barre chord' : '  ·  open position');
    }
    buildChordLibrary._render = renderChord;
    renderChord();
    return box.el;
  }

  function currentVoicing() {
    return Theory.guitarVoicing(state.chordRoot + state.chordQuality);
  }

  function strumCurrent(dir) {
    const v = currentVoicing();
    if (v) Engine.strum(Theory.voicingToMidi(v), null, dir);
  }

  /* ================= song writer ================= */

  let songChordsEl = null, progListEl = null;

  function buildSongWriter() {
    const box = module('SONG WRITER', 'Chords for your song, in any key');
    const controls = div('chord-controls');
    controls.appendChild(field(select(Theory.NOTE_NAMES, state.songKey, (v) => { state.songKey = v; renderProgs(); }), 'Key'));
    controls.appendChild(field(select([['major', 'Major'], ['minor', 'Minor']], state.songMode, (v) => { state.songMode = v; renderProgs(); }), 'Mode'));
    box.body.appendChild(controls);

    progListEl = div('prog-list');
    box.body.appendChild(progListEl);

    const songHead = div('song-head');
    songHead.appendChild(label('YOUR SONG'));
    const t1 = smallBtn('Transpose −1', () => transposeSong(-1));
    const t2 = smallBtn('Transpose +1', () => transposeSong(1));
    const play = smallBtn('▶ Play song', playSongChords);
    const stop = smallBtn('■ Stop', stopSongChords);
    const copy = smallBtn('⧉ Copy sheet', copySheet);
    const clr = smallBtn('Clear', () => { state.songChords = []; renderSongChords(); });
    [t1, t2, play, stop, copy, clr].forEach((b) => songHead.appendChild(b));
    box.body.appendChild(songHead);

    songChordsEl = div('song-chords');
    box.body.appendChild(songChordsEl);

    renderProgs();
    renderSongChords();
    return box.el;
  }

  function renderProgs() {
    progListEl.innerHTML = '';
    const progs = Theory.progressionsForKey(state.songKey, state.songMode);
    progs.forEach((p) => {
      const row = div('prog-row');
      const name = document.createElement('div');
      name.className = 'prog-name';
      name.innerHTML = '<strong>' + p.name + '</strong><span>' + p.roman + '</span>';
      const chords = div('prog-chords');
      chords.textContent = p.chords.join(' – ');
      const use = smallBtn('Use', () => {
        state.songChords = p.chords.slice();
        renderSongChords();
        Main.flash('Loaded "' + p.name + '" in ' + state.songKey + ' ' + state.songMode);
      });
      row.appendChild(name);
      row.appendChild(chords);
      row.appendChild(use);
      progListEl.appendChild(row);
    });
  }

  function renderSongChords(liveIndex) {
    songChordsEl.innerHTML = '';
    if (!state.songChords.length) {
      const e = document.createElement('span');
      e.className = 'chain-empty';
      e.textContent = 'Pick a progression above or add chords from the library';
      songChordsEl.appendChild(e);
      return;
    }
    state.songChords.forEach((sym, i) => {
      const card = div('song-chord' + (i === liveIndex ? ' is-live' : ''));
      const v = Theory.guitarVoicing(sym);
      if (v) card.appendChild(chordSVG(sym, v, 92));
      else {
        const s = document.createElement('div');
        s.className = 'song-chord-name'; s.textContent = sym;
        card.appendChild(s);
      }
      card.title = 'Click to strum · ⌫ removes';
      card.addEventListener('click', () => {
        if (v) Engine.strum(Theory.voicingToMidi(v), null, 1);
      });
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'song-chord-rm'; rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove ' + sym);
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        state.songChords.splice(i, 1);
        renderSongChords();
      });
      card.appendChild(rm);
      songChordsEl.appendChild(card);
    });
  }

  function transposeSong(n) {
    state.songChords = state.songChords.map((c) => Theory.transposeChord(c, n));
    const rootIdx = (Theory.NOTE_NAMES.indexOf(state.songKey) + n + 12) % 12;
    state.songKey = Theory.NOTE_NAMES[rootIdx];
    renderProgs();
    renderSongChords();
  }

  function playSongChords() {
    stopSongChords();
    if (!state.songChords.length) return;
    Engine.resume();
    const beat = 60 / Transport.bpm;
    let i = 0;
    const playBar = () => {
      const sym = state.songChords[i % state.songChords.length];
      const v = Theory.guitarVoicing(sym);
      renderSongChords(i % state.songChords.length);
      if (v) {
        const midis = Theory.voicingToMidi(v);
        const t = Engine.now() + 0.03;
        // D · D-U · U-D-U folk strum across one bar
        Engine.strum(midis, t, 1);
        Engine.strum(midis, t + beat * 1.0, 1);
        Engine.strum(midis, t + beat * 1.5, -1);
        Engine.strum(midis, t + beat * 2.5, -1);
        Engine.strum(midis, t + beat * 3.0, 1);
        Engine.strum(midis, t + beat * 3.5, -1);
      }
      i++;
    };
    playBar();
    state.playTimer = setInterval(playBar, beat * 4000);
  }

  function stopSongChords() {
    if (state.playTimer) clearInterval(state.playTimer);
    state.playTimer = null;
    renderSongChords();
  }

  function copySheet() {
    if (!state.songChords.length) return;
    const lines = [
      'SONG SHEET — key of ' + state.songKey + ' ' + state.songMode,
      '',
      '| ' + state.songChords.join(' | ') + ' |',
      '',
    ];
    state.songChords.forEach((sym) => {
      const v = Theory.guitarVoicing(sym);
      if (v) {
        const frets = v.frets.map((f) => (f < 0 ? 'x' : f)).join(' ');
        lines.push(sym.padEnd(8) + ' EADGBe: ' + frets);
      }
    });
    copyText(lines.join('\n'));
    Main.flash('Chord sheet copied to clipboard');
  }

  /* ================= tab composer ================= */

  let tabOut = null, pendingEl = null, fretCells = [];

  function buildTabComposer() {
    const box = module('TAB COMPOSER', 'Click the fretboard — the tab writes itself');
    box.el.classList.add('module-wide', 'module-guitar');

    const fb = div('fretboard');
    fretCells = [];
    // header row with fret numbers
    const headRow = div('fb-row fb-head');
    headRow.appendChild(cellStatic('', 'fb-label'));
    for (let f = 0; f <= 12; f++) headRow.appendChild(cellStatic(String(f), 'fb-num' + ([3, 5, 7, 9, 12].includes(f) ? ' fb-marker' : '')));
    fb.appendChild(headRow);
    // strings: high e (string 1) on top
    for (let s = 1; s <= 6; s++) {
      const row = div('fb-row');
      const lab = cellStatic(Theory.GUITAR_STRING_LABELS[6 - s], 'fb-label');
      row.appendChild(lab);
      const cells = [];
      for (let f = 0; f <= 12; f++) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'fb-cell';
        c.setAttribute('aria-label', 'String ' + s + ' fret ' + f);
        c.addEventListener('click', () => stageNote(s, f, c));
        cells.push(c);
        row.appendChild(c);
      }
      fretCells.push(cells);
      fb.appendChild(row);
    }
    box.body.appendChild(fb);

    const bar = div('tab-toolbar');
    pendingEl = div('tab-pending');
    bar.appendChild(pendingEl);
    bar.appendChild(smallBtn('↵ Commit column', commitColumn));
    bar.appendChild(smallBtn('| Bar line', () => { commitColumn(); state.tabColumns.push({ type: 'bar' }); renderTabOutput(); }));
    bar.appendChild(smallBtn('⌫ Undo', () => {
      if (state.pendingNotes.length) { state.pendingNotes = []; paintPending(); return; }
      state.tabColumns.pop();
      renderTabOutput();
    }));
    bar.appendChild(smallBtn('▶ Play tab', playTab));
    bar.appendChild(smallBtn('⧉ Copy tab', () => { copyText(currentTabText()); Main.flash('Tab copied to clipboard'); }));
    bar.appendChild(smallBtn('Clear', () => { state.tabColumns = []; state.pendingNotes = []; paintPending(); renderTabOutput(); }));
    box.body.appendChild(bar);

    tabOut = document.createElement('pre');
    tabOut.className = 'tab-output crt';
    box.body.appendChild(tabOut);

    renderTabOutput();
    paintPending();
    return box.el;
  }

  function stageNote(string, fret, cellEl) {
    // one note per string in a column; clicking again removes it
    const existing = state.pendingNotes.findIndex((n) => n.string === string);
    if (existing >= 0 && state.pendingNotes[existing].fret === fret) {
      state.pendingNotes.splice(existing, 1);
    } else {
      if (existing >= 0) state.pendingNotes.splice(existing, 1);
      state.pendingNotes.push({ string, fret });
      Engine.pluck(Theory.GUITAR_TUNING[6 - string] + fret);
    }
    paintPending();
    void cellEl;
  }

  function paintPending() {
    // fretboard highlights
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 12; f++) {
        const on = state.pendingNotes.some((n) => n.string === s && n.fret === f);
        fretCells[s - 1][f].classList.toggle('is-on', on);
      }
    }
    if (!pendingEl) return;
    if (!state.pendingNotes.length) {
      pendingEl.textContent = 'Tap frets to stage notes, then commit the column';
    } else {
      pendingEl.textContent = 'Staged: ' + state.pendingNotes
        .slice().sort((a, b) => b.string - a.string)
        .map((n) => Theory.GUITAR_STRING_LABELS[6 - n.string] + n.fret)
        .join('  ');
    }
  }

  function commitColumn() {
    if (!state.pendingNotes.length) return;
    state.tabColumns.push({ type: 'notes', notes: state.pendingNotes.slice() });
    // play the committed column together
    const midis = state.pendingNotes
      .slice().sort((a, b) => b.string - a.string)
      .map((n) => Theory.GUITAR_TUNING[6 - n.string] + n.fret);
    Engine.strum(midis, null, 1, 0.015);
    state.pendingNotes = [];
    paintPending();
    renderTabOutput();
  }

  function currentTabText() {
    const cols = state.tabColumns.length ? state.tabColumns : [];
    return Theory.renderTab(cols);
  }

  function renderTabOutput() {
    if (!tabOut) return;
    if (!state.tabColumns.length) {
      tabOut.textContent = [
        'e|---------------------------|',
        'B|---------------------------|',
        'G|--- your tab starts here --|',
        'D|---------------------------|',
        'A|---------------------------|',
        'E|---------------------------|',
      ].join('\n');
      return;
    }
    tabOut.textContent = currentTabText();
  }

  function playTab() {
    Engine.resume();
    const gap = 60 / Transport.bpm / 2; // 8th notes
    let t = Engine.now() + 0.05;
    state.tabColumns.forEach((col) => {
      if (col.type !== 'notes') return;
      const midis = col.notes
        .slice().sort((a, b) => b.string - a.string)
        .map((n) => Theory.GUITAR_TUNING[6 - n.string] + n.fret);
      Engine.strum(midis, t, 1, midis.length > 2 ? 0.02 : 0.008);
      t += gap;
    });
  }

  /* ================= chord SVG ================= */

  /** Draw a fingering diagram for a voicing. */
  function chordSVG(symbol, v, width) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const W = width, H = width * 1.25;
    svg.setAttribute('viewBox', '0 0 100 125');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.classList.add('chord-svg');

    const fretted = v.frets.filter((f) => f > 0);
    const maxF = Math.max(1, ...fretted);
    const minF = fretted.length ? Math.min(...fretted) : 1;
    const startFret = maxF <= 4 ? 1 : minF;
    const NFRETS = 4;

    const left = 18, right = 92, top = 30, bottom = 112;
    const stringX = (i) => left + (i * (right - left)) / 5; // i: 0 lowE .. 5 highE
    const fretY = (f) => top + (f * (bottom - top)) / NFRETS;

    const mk = (tag, attrs, text) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, val]) => el.setAttribute(k, val));
      if (text != null) el.textContent = text;
      svg.appendChild(el);
      return el;
    };

    // title
    mk('text', { x: 50, y: 12, class: 'cs-title', 'text-anchor': 'middle' }, symbol);

    // nut or start fret label
    if (startFret === 1) {
      mk('rect', { x: left - 1, y: top - 3.4, width: right - left + 2, height: 3.4, class: 'cs-nut' });
    } else {
      mk('text', { x: left - 12, y: fretY(0) + 12, class: 'cs-fretnum' }, String(startFret));
    }

    // grid
    for (let f = 0; f <= NFRETS; f++) {
      mk('line', { x1: left, y1: fretY(f), x2: right, y2: fretY(f), class: 'cs-line' });
    }
    for (let s2 = 0; s2 < 6; s2++) {
      mk('line', { x1: stringX(s2), y1: top, x2: stringX(s2), y2: bottom, class: 'cs-line' });
    }

    // barre
    if (v.barre) {
      const barreFret = startFret === 1 ? Math.min(...fretted) : startFret;
      const rel = barreFret - startFret;
      if (rel >= 0 && rel < NFRETS) {
        const y = fretY(rel) + (fretY(rel + 1) - fretY(rel)) / 2;
        const strings = v.frets
          .map((f, i) => ({ f, i }))
          .filter((o) => o.f === barreFret)
          .map((o) => o.i);
        if (strings.length >= 2) {
          const x1 = stringX(Math.min(...strings));
          const x2 = stringX(Math.max(...strings));
          mk('rect', { x: x1 - 5, y: y - 5, width: x2 - x1 + 10, height: 10, rx: 5, class: 'cs-dot' });
        }
      }
    }

    // dots / open / muted
    v.frets.forEach((f, i) => {
      const x = stringX(i);
      if (f < 0) {
        mk('text', { x, y: top - 7, class: 'cs-x', 'text-anchor': 'middle' }, '×');
      } else if (f === 0) {
        mk('circle', { cx: x, cy: top - 10, r: 4, class: 'cs-open' });
      } else {
        const rel = f - startFret;
        if (rel >= 0 && rel < NFRETS) {
          const y = fretY(rel) + (fretY(rel + 1) - fretY(rel)) / 2;
          mk('circle', { cx: x, cy: y, r: 6.4, class: 'cs-dot' });
        }
      }
    });

    return svg;
  }

  /* ================= helpers ================= */

  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
  function label(t) { const l = document.createElement('span'); l.className = 'bar-label'; l.textContent = t; return l; }
  function smallBtn(text, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-small'; b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function select(options, value, onChange) {
    const sel = document.createElement('select');
    options.forEach((op) => {
      const [v, t] = Array.isArray(op) ? op : [op, op];
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (v === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }
  function field(sel, labelText) {
    const wrap = div('field');
    wrap.appendChild(sel);
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = labelText;
    wrap.appendChild(lab);
    return wrap;
  }
  function cellStatic(text, cls) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }
  function module(title, sub) {
    const el = div('module');
    const h = div('module-head');
    h.innerHTML = '<span class="module-title">' + title + '</span><span class="module-sub">' + sub + '</span>';
    const body = div('module-body module-body-col');
    el.appendChild(h);
    el.appendChild(body);
    return { el, body };
  }

  root.GuitarUI = { build };
})(window);
