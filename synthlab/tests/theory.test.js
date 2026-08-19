/* Node test suite for js/theory.js — run with: node tests/theory.test.js */
'use strict';

const T = require('../js/theory.js');

let passed = 0, failed = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + '\n  expected ' + e + '\n  got      ' + a); }
}
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL: ' + msg); }
}
function close(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) <= tol) passed++;
  else { failed++; console.error('FAIL: ' + msg + ' expected ~' + expected + ', got ' + actual); }
}

/* ---- notes & frequencies ---- */
close(T.midiToFreq(69), 440, 1e-9, 'A4 = 440 Hz');
close(T.midiToFreq(60), 261.6256, 0.001, 'C4 ≈ 261.63 Hz');
close(T.midiToFreq(57), 220, 1e-9, 'A3 = 220 Hz');
eq(T.nameToMidi('C4'), 60, 'C4 -> 60');
eq(T.nameToMidi('A4'), 69, 'A4 -> 69');
eq(T.nameToMidi('Bb3'), 58, 'Bb3 -> 58 (flat normalization)');
eq(T.nameToMidi('X9'), null, 'invalid note rejected');
eq(T.midiToName(60), 'C4', '60 -> C4');
eq(T.midiToName(61), 'C#4', '61 -> C#4');
eq(T.normalizeNote('Eb'), 'D#', 'Eb -> D#');
eq(T.normalizeNote('h'), null, 'H rejected');

/* ---- scales ---- */
eq(T.scaleNotes(60, 'major', 8), [60, 62, 64, 65, 67, 69, 71, 72], 'C major octave');
eq(T.scaleNotes(57, 'minor', 5), [57, 59, 60, 62, 64], 'A minor start');
eq(T.scaleNotes(60, 'pentatonicMin', 6), [60, 63, 65, 67, 70, 72], 'C minor pentatonic wraps');

/* ---- chords ---- */
eq(T.parseChord('F#m7'), { root: 'F#', quality: 'm7' }, 'parse F#m7');
eq(T.parseChord('Bb'), { root: 'A#', quality: '' }, 'parse Bb as A# major');
eq(T.parseChord('Qx'), null, 'parse garbage -> null');
eq(T.chordToMidi('C', 4), [60, 64, 67], 'C major triad');
eq(T.chordToMidi('Am', 4), [69, 72, 76], 'A minor triad');
eq(T.chordToMidi('G7', 3), [55, 59, 62, 65], 'G7 in octave 3');
eq(T.transposeChord('C', 2), 'D', 'C +2 = D');
eq(T.transposeChord('Am', 3), 'Cm', 'Am +3 = Cm');
eq(T.transposeChord('G7', -1), 'F#7', 'G7 -1 = F#7');
eq(T.transposeChord('B', 1), 'C', 'B +1 wraps to C');

/* ---- diatonic & progressions ---- */
eq(T.diatonicChords('C', 'major'), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'], 'C major diatonic');
eq(T.diatonicChords('A', 'minor'), ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'], 'A minor diatonic');
const progs = T.progressionsForKey('C', 'major');
ok(progs.length >= 4, 'major key has progressions');
eq(progs[0].chords, ['C', 'G', 'Am', 'F'], 'I–V–vi–IV in C');
const minProgs = T.progressionsForKey('A', 'minor');
eq(minProgs[0].chords, ['Am', 'F', 'C', 'G'], 'i–VI–III–VII in Am');

/* ---- guitar voicings ---- */
const c = T.guitarVoicing('C');
eq(c.frets, [-1, 3, 2, 0, 1, 0], 'open C shape');
eq(T.voicingToMidi(c), [48, 52, 55, 60, 64], 'C voicing midi notes');
// Every open-shape voicing must contain only chord tones
Object.keys(T.OPEN_SHAPES).forEach((sym) => {
  const parsed = T.parseChord(sym);
  ok(parsed, 'open shape symbol parses: ' + sym);
  const formula = T.CHORD_FORMULAS[parsed.quality];
  const rootPc = T.NOTE_NAMES.indexOf(parsed.root);
  const allowed = new Set(formula.map((iv) => (rootPc + iv) % 12));
  const midis = T.voicingToMidi({ frets: T.OPEN_SHAPES[sym] });
  midis.forEach((m) => {
    ok(allowed.has(m % 12), sym + ': note ' + T.midiToName(m) + ' is a chord tone');
  });
});
// Barre-derived chords: root and quality correct
['C#m', 'F#', 'G#m7', 'D#7', 'Fm'].forEach((sym) => {
  const v = T.guitarVoicing(sym);
  ok(v && v.barre, sym + ' resolves to a barre voicing');
  const parsed = T.parseChord(sym);
  const formula = T.CHORD_FORMULAS[parsed.quality];
  const rootPc = T.NOTE_NAMES.indexOf(parsed.root);
  const allowed = new Set(formula.map((iv) => (rootPc + iv) % 12));
  const midis = T.voicingToMidi(v);
  ok(midis.length >= 3, sym + ' has at least 3 notes');
  midis.forEach((m) => ok(allowed.has(m % 12), sym + ': ' + T.midiToName(m) + ' is a chord tone'));
  // lowest sounding note should be the root for E/A barre shapes
  ok(midis[0] % 12 === rootPc, sym + ': bass note is the root');
});
['Csus2', 'Bsus4', 'Fmaj7', 'C#maj7'].forEach((sym) => {
  const v = T.guitarVoicing(sym);
  ok(v && v.frets.length === 6, sym + ' has a voicing');
  const parsed = T.parseChord(sym);
  const rootPc = T.NOTE_NAMES.indexOf(parsed.root);
  const allowed = new Set(T.CHORD_FORMULAS[parsed.quality].map((iv) => (rootPc + iv) % 12));
  T.voicingToMidi(v).forEach((m) => ok(allowed.has(m % 12), sym + ': ' + T.midiToName(m) + ' is a chord tone'));
});
eq(T.guitarVoicing('Cdim'), null, 'dim has no movable template -> null');

/* ---- ASCII tab ---- */
const tab = T.renderTab([
  { type: 'notes', notes: [{ string: 5, fret: 3 }] },
  { type: 'notes', notes: [{ string: 4, fret: 2 }] },
  { type: 'notes', notes: [{ string: 2, fret: 10 }, { string: 3, fret: 12 }] },
  { type: 'bar' },
  { type: 'notes', notes: [{ string: 1, fret: 0 }] },
]);
const lines = tab.split('\n');
eq(lines.length, 6, 'tab has 6 lines');
ok(lines[0].startsWith('e|'), 'high e first line');
ok(lines[5].startsWith('E|'), 'low E last line');
ok(lines[4].includes('3'), 'A string shows fret 3');
ok(lines[1].includes('10'), 'B string shows fret 10 (two digits)');
ok(lines[0].includes('|') && lines[0].split('|').length >= 3, 'bar line rendered');
const widths = new Set(lines.map((l) => l.length));
eq(widths.size, 1, 'all tab lines equal width');

/* ---- summary ---- */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
