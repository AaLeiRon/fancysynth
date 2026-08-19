/* ============================================================
   SynthLab — theory.js
   Pure music theory: notes, frequencies, scales, chords,
   guitar voicings. No DOM, no audio — fully testable in Node.
   ============================================================ */
(function (root) {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

  /** Normalize a note name ("Bb" -> "A#", "c" -> "C"). */
  function normalizeNote(name) {
    if (!name) return null;
    let n = name.trim();
    n = n.charAt(0).toUpperCase() + n.slice(1);
    if (FLAT_TO_SHARP[n]) n = FLAT_TO_SHARP[n];
    return NOTE_NAMES.includes(n) ? n : null;
  }

  /** MIDI note number -> frequency in Hz (A4 = 440, midi 69). */
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** "C4" style name -> midi number. Returns null when invalid. */
  function nameToMidi(full) {
    const m = /^([A-Ga-g][#b]?)(-?\d)$/.exec(String(full).trim());
    if (!m) return null;
    const note = normalizeNote(m[1]);
    if (note == null) return null;
    const octave = parseInt(m[2], 10);
    return (octave + 1) * 12 + NOTE_NAMES.indexOf(note);
  }

  /** midi number -> "C4" style name. */
  function midiToName(midi) {
    const note = NOTE_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return note + octave;
  }

  const SCALES = {
    major:          [0, 2, 4, 5, 7, 9, 11],
    minor:          [0, 2, 3, 5, 7, 8, 10],
    dorian:         [0, 2, 3, 5, 7, 9, 10],
    mixolydian:     [0, 2, 4, 5, 7, 9, 10],
    pentatonicMaj:  [0, 2, 4, 7, 9],
    pentatonicMin:  [0, 3, 5, 7, 10],
    blues:          [0, 3, 5, 6, 7, 10],
    chromatic:      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  /** Build `count` midi notes of a scale, ascending from rootMidi. */
  function scaleNotes(rootMidi, scaleName, count) {
    const steps = SCALES[scaleName] || SCALES.major;
    const out = [];
    let octave = 0, i = 0;
    while (out.length < count) {
      out.push(rootMidi + steps[i] + 12 * octave);
      i++;
      if (i >= steps.length) { i = 0; octave++; }
    }
    return out;
  }

  /* ---------------- Chords (abstract) ---------------- */

  const CHORD_FORMULAS = {
    '':      [0, 4, 7],          // major
    'm':     [0, 3, 7],
    '7':     [0, 4, 7, 10],
    'maj7':  [0, 4, 7, 11],
    'm7':    [0, 3, 7, 10],
    'sus2':  [0, 2, 7],
    'sus4':  [0, 5, 7],
    'dim':   [0, 3, 6],
    'aug':   [0, 4, 8],
    '6':     [0, 4, 7, 9],
    'm6':    [0, 3, 7, 9],
    'add9':  [0, 4, 7, 14],
    '9':     [0, 4, 7, 10, 14],
  };

  /** Parse "F#m7" -> { root:"F#", quality:"m7" } or null. */
  function parseChord(symbol) {
    const m = /^([A-Ga-g][#b]?)(.*)$/.exec(String(symbol).trim());
    if (!m) return null;
    const root = normalizeNote(m[1]);
    const quality = m[2].trim();
    if (root == null || !(quality in CHORD_FORMULAS)) return null;
    return { root, quality };
  }

  /** Chord symbol -> array of midi notes rooted near octave 4. */
  function chordToMidi(symbol, octave) {
    const parsed = parseChord(symbol);
    if (!parsed) return null;
    const base = ((octave == null ? 4 : octave) + 1) * 12 + NOTE_NAMES.indexOf(parsed.root);
    return CHORD_FORMULAS[parsed.quality].map((iv) => base + iv);
  }

  /** Transpose a chord symbol by n semitones. */
  function transposeChord(symbol, semitones) {
    const parsed = parseChord(symbol);
    if (!parsed) return symbol;
    const idx = (NOTE_NAMES.indexOf(parsed.root) + semitones % 12 + 12) % 12;
    return NOTE_NAMES[idx] + parsed.quality;
  }

  /* ------------- Diatonic progressions ------------- */

  const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

  /** Diatonic chord symbols for a key. mode: 'major' | 'minor'. */
  function diatonicChords(rootName, mode) {
    const root = normalizeNote(rootName);
    if (root == null) return [];
    const steps = mode === 'minor' ? SCALES.minor : SCALES.major;
    const qualities = mode === 'minor'
      ? ['m', 'dim', '', 'm', 'm', '', '']
      : ['', 'm', 'm', '', '', 'm', 'dim'];
    const rootIdx = NOTE_NAMES.indexOf(root);
    return steps.map((st, i) => {
      const name = NOTE_NAMES[(rootIdx + st) % 12];
      return name + qualities[i];
    });
  }

  const PROGRESSIONS = {
    major: [
      { name: 'Pop anthem',    degrees: [0, 4, 5, 3], roman: 'I – V – vi – IV' },
      { name: 'Doo-wop',       degrees: [0, 5, 3, 4], roman: 'I – vi – IV – V' },
      { name: 'Folk turn',     degrees: [0, 3, 0, 4], roman: 'I – IV – I – V' },
      { name: 'Jazz cadence',  degrees: [1, 4, 0, 0], roman: 'ii – V – I – I' },
      { name: 'Canon walk',    degrees: [0, 4, 5, 2, 3, 0, 3, 4], roman: 'I – V – vi – iii – IV – I – IV – V' },
    ],
    minor: [
      { name: 'Dark pop',      degrees: [0, 5, 2, 6], roman: 'i – VI – III – VII' },
      { name: 'Andalusian',    degrees: [0, 6, 5, 4], roman: 'i – VII – VI – v' },
      { name: 'Minor lament',  degrees: [0, 3, 5, 4], roman: 'i – iv – VI – v' },
      { name: 'Epic rise',     degrees: [0, 5, 6, 0], roman: 'i – VI – VII – i' },
    ],
  };

  /** Named progressions for a key -> [{name, roman, chords:[..]}]. */
  function progressionsForKey(rootName, mode) {
    const dia = diatonicChords(rootName, mode);
    if (!dia.length) return [];
    const list = PROGRESSIONS[mode === 'minor' ? 'minor' : 'major'];
    return list.map((p) => ({
      name: p.name,
      roman: p.roman,
      chords: p.degrees.map((d) => dia[d]),
    }));
  }

  /* ---------------- Guitar ---------------- */

  // Standard tuning, string 6 (low E) -> string 1 (high E), midi numbers.
  const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
  const GUITAR_STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

  // Open-position shapes: frets low-E -> high-e, -1 = muted.
  const OPEN_SHAPES = {
    'C':    [-1, 3, 2, 0, 1, 0],
    'Cmaj7':[-1, 3, 2, 0, 0, 0],
    'C7':   [-1, 3, 2, 3, 1, 0],
    'D':    [-1, -1, 0, 2, 3, 2],
    'Dm':   [-1, -1, 0, 2, 3, 1],
    'D7':   [-1, -1, 0, 2, 1, 2],
    'Dm7':  [-1, -1, 0, 2, 1, 1],
    'Dsus4':[-1, -1, 0, 2, 3, 3],
    'E':    [0, 2, 2, 1, 0, 0],
    'Em':   [0, 2, 2, 0, 0, 0],
    'E7':   [0, 2, 0, 1, 0, 0],
    'Em7':  [0, 2, 0, 0, 0, 0],
    'F':    [1, 3, 3, 2, 1, 1],
    'Fmaj7':[-1, -1, 3, 2, 1, 0],
    'G':    [3, 2, 0, 0, 0, 3],
    'G7':   [3, 2, 0, 0, 0, 1],
    'A':    [-1, 0, 2, 2, 2, 0],
    'Am':   [-1, 0, 2, 2, 1, 0],
    'A7':   [-1, 0, 2, 0, 2, 0],
    'Am7':  [-1, 0, 2, 0, 1, 0],
    'Asus2':[-1, 0, 2, 2, 0, 0],
    'Asus4':[-1, 0, 2, 2, 3, 0],
    'B7':   [-1, 2, 1, 2, 0, 2],
    'Bm':   [-1, 2, 4, 4, 3, 2],
  };

  // Movable barre templates relative to barre fret (E and A shapes).
  const BARRE_TEMPLATES = {
    E:  { baseRoot: 4 /* E */, string: 6, shape: [0, 2, 2, 1, 0, 0] },
    Em: { baseRoot: 4,         string: 6, shape: [0, 2, 2, 0, 0, 0] },
    E7: { baseRoot: 4,         string: 6, shape: [0, 2, 0, 1, 0, 0] },
    Em7:{ baseRoot: 4,         string: 6, shape: [0, 2, 0, 0, 0, 0] },
    A:  { baseRoot: 9 /* A */, string: 5, shape: [-1, 0, 2, 2, 2, 0] },
    Am: { baseRoot: 9,         string: 5, shape: [-1, 0, 2, 2, 1, 0] },
    A7: { baseRoot: 9,         string: 5, shape: [-1, 0, 2, 0, 2, 0] },
    Am7:{ baseRoot: 9,         string: 5, shape: [-1, 0, 2, 0, 1, 0] },
    Amaj7:  { baseRoot: 9,     string: 5, shape: [-1, 0, 2, 1, 2, 0] },
    Asus2:  { baseRoot: 9,     string: 5, shape: [-1, 0, 2, 2, 0, 0] },
    Asus4:  { baseRoot: 9,     string: 5, shape: [-1, 0, 2, 2, 3, 0] },
  };

  /**
   * Voicing for a chord symbol.
   * Returns { frets:[6], baseFret, barre:bool } or null.
   */
  function guitarVoicing(symbol) {
    const parsed = parseChord(symbol);
    if (!parsed) return null;
    const canonical = parsed.root + parsed.quality;
    if (OPEN_SHAPES[canonical]) {
      return { frets: OPEN_SHAPES[canonical].slice(), baseFret: 1, barre: canonical === 'F' || canonical === 'Bm' };
    }
    // Derive barre chord. Prefer whichever template lands lowest on the neck.
    const rootIdx = NOTE_NAMES.indexOf(parsed.root);
    const q = parsed.quality;
    const templateKeys = {
      '': ['E', 'A'], m: ['Em', 'Am'], 7: ['E7', 'A7'], m7: ['Em7', 'Am7'],
      maj7: ['Amaj7'], sus2: ['Asus2'], sus4: ['Asus4'],
    }[q];
    if (!templateKeys) return null;
    let best = null;
    for (const key of templateKeys) {
      const t = BARRE_TEMPLATES[key];
      const offset = ((rootIdx - t.baseRoot) % 12 + 12) % 12;
      const barreFret = offset === 0 ? 12 : offset;
      if (best == null || barreFret < best.barreFret) best = { t, barreFret };
    }
    const frets = best.t.shape.map((f) => (f < 0 ? -1 : f + best.barreFret));
    return { frets, baseFret: best.barreFret, barre: true };
  }

  /** Voicing -> midi notes (skips muted strings), low to high. */
  function voicingToMidi(voicing) {
    if (!voicing) return [];
    const out = [];
    voicing.frets.forEach((fret, i) => {
      if (fret >= 0) out.push(GUITAR_TUNING[i] + fret);
    });
    return out;
  }

  /* ------------- ASCII tab rendering ------------- */

  /**
   * columns: array of column objects:
   *   { type:'notes', notes:[{string:1..6, fret:int}] }
   *   { type:'bar' }
   * Returns 6-line ASCII tab (high e on top).
   */
  function renderTab(columns) {
    const lines = [[], [], [], [], [], []]; // index 0 = high e
    const labels = ['e', 'B', 'G', 'D', 'A', 'E'];
    for (const col of columns) {
      if (col.type === 'bar') {
        for (let s = 0; s < 6; s++) lines[s].push('|');
        continue;
      }
      const byString = {};
      let width = 1;
      for (const n of col.notes || []) {
        const txt = String(n.fret);
        byString[n.string] = txt;
        width = Math.max(width, txt.length);
      }
      for (let s = 0; s < 6; s++) {
        // string 1 = high e = line 0
        const txt = byString[s + 1] || '';
        lines[s].push(txt.padEnd(width, '-') + '-');
      }
    }
    return lines
      .map((cells, i) => labels[i] + '|-' + cells.join('') + '-|')
      .join('\n');
  }

  const api = {
    NOTE_NAMES, SCALES, CHORD_FORMULAS,
    GUITAR_TUNING, GUITAR_STRING_LABELS, OPEN_SHAPES,
    normalizeNote, midiToFreq, nameToMidi, midiToName,
    scaleNotes, parseChord, chordToMidi, transposeChord,
    diatonicChords, progressionsForKey,
    guitarVoicing, voicingToMidi, renderTab,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Theory = api;
})(typeof window !== 'undefined' ? window : globalThis);
