# SynthLab — a desktop studio in your browser

A complete music-making instrument that runs entirely in the browser. No build
step, no plugins, no samples — every sound is synthesized live with the Web
Audio API. Open `index.html` and play.

## Quick start

1. Unzip and open `index.html` in Chrome, Edge, Firefox or Safari
   (double-clicking the file works; a local server like `npx serve` also works).
2. Click anywhere once to unlock audio (a browser requirement), then play.

## The four modules

### SYNTH
A two-oscillator subtractive polysynth.
- Two oscillators (sine / triangle / saw / square) with octave, detune and mix
- Resonant filter (LP / HP / BP), full ADSR envelope, LFO to filter or pitch
- Drive, tempo-free delay, generated-impulse reverb
- Five presets: Warm Keys, Acid Bass, Dream Pad, Laser Lead, Glass Bells
- Play on screen or with your computer keyboard:
  `A W S E D F T G Y H U J K O L P` map to notes, `Z` / `X` shift the octave

### DRUMS
A 16-step, 8-voice drum machine. Kick, snare, clap, closed and open hats,
tom, rim and cowbell are all synthesized (no samples). Cells cycle
off → on → accent. Four groove presets, per-voice mixer, swing on the transport.

### COMPOSER
Compose a whole track:
- Four scenes (A–D); each scene holds one drum pattern and one melody pattern
- A 15-row melody grid locked to a key and scale (change the key and the whole
  melody transposes)
- Chain scenes into a song (`A A B B C C D B …`) and press play
- Hit **★ Load demo track** for a full pre-composed arrangement
- **● REC** records the master output and downloads the take as an audio file

### GUITAR
Writes chords and tabs for songs:
- Chord library with SVG fingering diagrams for every root and seven chord
  types (open shapes plus auto-derived barre chords), strummed with
  Karplus-Strong plucked-string synthesis
- Song writer: pick a key and mode, get classic progressions
  (I–V–vi–IV, ii–V–I, Andalusian, …), transpose with one click, play the
  progression with a folk strum pattern, copy a chord sheet
- Tab composer: click the fretboard, commit columns, and real ASCII tablature
  writes itself — play it back or copy it

## Transport

The header is shared by all modules: play/stop (or Space bar), tempo, swing,
record, and a live amber oscilloscope showing the master output.

## Tech

- Vanilla HTML/CSS/JS — zero dependencies at runtime, works from `file://`
- Web Audio API: subtractive synthesis, synthesized percussion,
  Karplus-Strong strings, convolution reverb with a generated impulse,
  a lookahead scheduler for sample-accurate sequencing, MediaRecorder export
- Music theory (`js/theory.js`) is a pure module shared by the browser and
  the Node test suite

## Project layout

```
index.html          app shell
css/style.css       all styling
js/theory.js        notes, scales, chords, guitar voicings, tab rendering (pure)
js/audio.js         audio engine + transport
js/widgets.js       knobs and switches
js/synth-ui.js      synth panel + keyboard
js/drums-ui.js      drum sequencer
js/composer-ui.js   score model, melody grid, song chain, demo track
js/guitar-ui.js     chord library, song writer, tab composer
tests/              Node test suites
```

## Tests

```
npm install          # dev-only: jsdom for the DOM smoke test
npm test             # theory unit tests + full-app headless smoke test
```

250 theory assertions (frequencies, chord math, voicings, tab layout) and a
41-assertion smoke test that boots the whole UI in jsdom with a stubbed
AudioContext and clicks through every module.
