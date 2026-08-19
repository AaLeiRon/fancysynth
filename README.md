<div align="center">

# 🎛️ fancysynth

### **SynthLab** — a desktop studio that lives in a browser tab

*Polysynth. Drum machine. Track composer. Guitar tab writer.*
**No build step. No plugins. No samples. Every sound synthesized live.**

<br>

[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-native-FFB100?style=for-the-badge&labelColor=191713)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Vanilla JS](https://img.shields.io/badge/vanilla-JS-F7DF1E?style=for-the-badge&labelColor=191713)](#-under-the-hood)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-2EA043?style=for-the-badge&labelColor=191713)](#-under-the-hood)
[![Tests](https://img.shields.io/badge/assertions-291-4C8DFF?style=for-the-badge&labelColor=191713)](#-tests)
[![License](https://img.shields.io/badge/license-MIT-8B5CF6?style=for-the-badge&labelColor=191713)](#-license)

```
        ╭───────────────────────────────────────────────╮
        │  ▲ PLAY   ● REC        112 BPM · READY        │
        │  ∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿⌇∿∿∿  │
        ╰───────────────────────────────────────────────╯
         ● SYNTH   ○ DRUMS   ○ COMPOSER   ○ GUITAR
```

</div>

---

## ⚡ Quick start

```bash
git clone https://github.com/AaLeiRon/fancysynth.git
cd fancysynth/synthlab
npx serve .        # …or literally just double-click index.html
```

Click anywhere once to unlock audio — browsers require a user gesture before
they'll make a sound — then hit **Space** and start playing.

> **Zero install path:** open `synthlab/index.html` straight from `file://`.
> It works. That's the whole point.

---

## 🎹 The four modules

<table>
<tr>
<td width="50%" valign="top">

### 🎛️ SYNTH
A two-oscillator subtractive polysynth.

- Two oscillators — sine / triangle / saw / square — with octave, detune and mix
- Resonant filter (LP / HP / BP), full ADSR, LFO routable to filter or pitch
- Drive, delay and a generated-impulse convolution reverb
- Five presets: *Warm Keys · Acid Bass · Dream Pad · Laser Lead · Glass Bells*

</td>
<td width="50%" valign="top">

### 🥁 DRUMS
A 16-step, 8-voice drum machine.

- Kick, snare, clap, closed & open hats, tom, rim, cowbell — all synthesized
- Cells cycle **off → on → accent**
- Four groove presets and a per-voice mixer
- Swing lives on the shared transport

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎼 COMPOSER
Turn patterns into an actual track.

- Four scenes (A–D), each holding one drum + one melody pattern
- 15-row melody grid locked to key and scale — change the key, the melody transposes
- Chain scenes into a song: `A A B B C C D B …`
- **★ Load demo track** for a full pre-composed arrangement
- **● REC** captures the master bus and downloads the take

</td>
<td width="50%" valign="top">

### 🎸 GUITAR
Chords and tab, written for you.

- Chord library with SVG fingering diagrams — seven chord types per root,
  open shapes plus auto-derived barre voicings
- Karplus-Strong plucked-string synthesis with a folk strum pattern
- Progressions by key and mode: I–V–vi–IV, ii–V–I, Andalusian, …
- Tab composer: click the fretboard, commit columns, real ASCII tablature
  writes itself — then play it back or copy it

</td>
</tr>
</table>

---

## ⌨️ Keyboard

The computer keyboard is a real two-row musical keyboard:

```
   W   E       T   Y   U        ← black keys
 A   S   D   F   G   H   J   K   O   L   P
 C   D   E   F   G   A   B   C   D   E   F
```

| Key | Action |
|:---|:---|
| `A W S E D F T G Y H U J K O L P` | Play notes |
| `Z` / `X` | Octave down / up |
| `Space` | Play / stop transport |

---

## 🔬 Under the hood

Everything you hear is generated at runtime by the Web Audio API — there is not
a single audio file in this repository.

- **Subtractive synthesis** — oscillators → resonant filter → ADSR → FX chain
- **Synthesized percussion** — noise bursts, pitch envelopes, tuned bodies
- **Karplus-Strong** — physically-modelled plucked strings for the guitar module
- **Convolution reverb** — impulse response generated in code, not loaded
- **Lookahead scheduler** — sample-accurate sequencing that survives a busy main thread
- **MediaRecorder** — one-click export of the master output
- **`js/theory.js`** — a pure, side-effect-free music-theory module shared by the
  browser *and* the Node test suite

Runtime dependencies: **none**. Vanilla HTML, CSS and JavaScript.

---

## 🗂️ Project layout

```
synthlab/
├── index.html          app shell
├── css/style.css       all styling
├── js/
│   ├── theory.js       notes, scales, chords, voicings, tab rendering (pure)
│   ├── audio.js        audio engine + transport
│   ├── widgets.js      knobs and switches
│   ├── synth-ui.js     synth panel + keyboard
│   ├── drums-ui.js     drum sequencer
│   ├── composer-ui.js  score model, melody grid, song chain, demo track
│   ├── guitar-ui.js    chord library, song writer, tab composer
│   └── main.js         wiring
└── tests/              Node test suites
```

---

## 🧪 Tests

```bash
cd synthlab
npm install    # dev-only: jsdom for the DOM smoke test
npm test
```

- **250 theory assertions** — frequencies, chord math, voicings, tab layout
- **41 smoke assertions** — boots the entire UI in jsdom with a stubbed
  `AudioContext` and clicks through every module

---

## 🌐 Browser support

Chrome · Edge · Firefox · Safari — anything with the Web Audio API and
`MediaRecorder`. Best on desktop; the layout is a hardware-style device panel.

---

## 🗺️ Ideas on the roadmap

- [ ] MIDI input via the Web MIDI API
- [ ] Save / load patches and songs to `localStorage`
- [ ] Pattern import / export as JSON
- [ ] More drum kits and synth presets
- [ ] Per-track effect sends in the composer

---

## 📄 License

MIT — see [`LICENSE`](LICENSE). Do fun things with it.

<div align="center">
<br>

**Built by [@AaLeiRon](https://github.com/AaLeiRon)** · *fancy wancy lil synth for music fun*

</div>
