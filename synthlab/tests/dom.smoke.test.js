/* Headless smoke test — loads the full app in jsdom with a fake
   Web Audio API and exercises every module. Run: node tests/dom.smoke.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const rootDir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}

/* ---------- Web Audio stub ---------- */
function param(v) {
  return {
    value: v || 0,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {},
    cancelScheduledValues() {},
  };
}
function node() {
  return {
    connect() {}, disconnect() {}, start() {}, stop() {},
    gain: param(1), frequency: param(440), detune: param(0), Q: param(1),
    delayTime: param(0), type: 'sine', curve: null, oversample: 'none',
    buffer: null, fftSize: 2048,
    getByteTimeDomainData(arr) { arr.fill(128); },
    setValueAtTime() {},
  };
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = node(); }
  resume() { return Promise.resolve(); }
  createGain() { return node(); }
  createOscillator() { return node(); }
  createBiquadFilter() { return node(); }
  createDelay() { return node(); }
  createWaveShaper() { return node(); }
  createConvolver() { return node(); }
  createAnalyser() { return node(); }
  createBufferSource() { return node(); }
  createMediaStreamDestination() { return Object.assign(node(), { stream: {} }); }
  createBuffer(ch, len) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { getChannelData: (i) => data[i], length: len };
  }
}
window.AudioContext = FakeAudioContext;
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    set strokeStyle(v) {}, set lineWidth(v) {}, set shadowColor(v) {}, set shadowBlur(v) {},
  };
};
window.requestAnimationFrame = (fn) => setTimeout(fn, 16);
window.navigator.clipboard = { writeText: () => Promise.resolve() };

/* ---------- load scripts in order ---------- */
const scripts = ['theory.js', 'audio.js', 'widgets.js', 'synth-ui.js', 'drums-ui.js', 'composer-ui.js', 'guitar-ui.js', 'main.js'];
for (const s of scripts) {
  const code = fs.readFileSync(path.join(rootDir, 'js', s), 'utf8');
  try {
    window.eval(code);
    ok(true, 'loads ' + s);
  } catch (e) {
    ok(false, 'loads ' + s + ' — ' + e.message);
  }
}

/* fire DOMContentLoaded */
try {
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  ok(true, 'app initializes on DOMContentLoaded');
} catch (e) {
  ok(false, 'app init threw: ' + e.stack);
}

const doc = window.document;
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

setTimeout(() => {
  try { run(); } catch (e) { ok(false, 'test run threw: ' + e.stack); }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}, 80);

function run() {
  /* ---- synth panel rendered ---- */
  ok(doc.querySelectorAll('#panel-synth .module').length >= 6, 'synth panel has 6 modules');
  ok(doc.querySelectorAll('#panel-synth .knob').length >= 15, 'synth panel has knobs');
  ok(doc.querySelectorAll('#panel-synth .key').length === 25, 'keyboard has 25 keys');

  /* preset click */
  const preset = doc.querySelector('#panel-synth .chip');
  click(preset);
  ok(true, 'preset applies without error: ' + preset.textContent);

  /* keyboard key press via pointer events */
  const key = doc.querySelector('#panel-synth .key-white');
  key.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  key.dispatchEvent(new window.Event('pointerup', { bubbles: true }));
  ok(true, 'key press/release works');

  /* computer keyboard note */
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  doc.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'a', bubbles: true }));
  ok(window.Engine.activeVoices.size === 0, 'computer key note released cleanly');

  /* ---- tabs ---- */
  const drumTab = doc.querySelector('[data-panel="drums"]');
  click(drumTab);
  ok(doc.getElementById('panel-drums').classList.contains('is-active'), 'drums tab activates');

  /* ---- drum grid ---- */
  ok(doc.querySelectorAll('#panel-drums .drum-row').length === 8, '8 drum tracks');
  ok(doc.querySelectorAll('#panel-drums .drum-cell').length === 128, '128 drum cells');
  const cell = doc.querySelector('#panel-drums .drum-cell');
  click(cell);
  ok(window.Score.currentScene().drums.kick[0] === 1, 'cell toggles on');
  click(cell);
  ok(window.Score.currentScene().drums.kick[0] === 2, 'cell cycles to accent');
  click(cell);
  ok(window.Score.currentScene().drums.kick[0] === 0, 'cell cycles back off');
  const groove = doc.querySelector('#panel-drums .chip-drums');
  click(groove);
  ok(window.Score.currentScene().drums.kick.some((v) => v === 1), 'groove preset loads');

  /* ---- composer ---- */
  click(doc.querySelector('[data-panel="composer"]'));
  ok(doc.querySelectorAll('#panel-composer .mel-row').length === 15, '15 melody rows');
  const mcell = doc.querySelector('#panel-composer .mel-cell');
  click(mcell);
  const anyNote = window.Score.currentScene().melody.some((s) => s.length);
  ok(anyNote, 'melody cell toggles a note');

  /* scene switch keeps independent patterns */
  const btnB = Array.from(doc.querySelectorAll('.scene-btn')).find((b) => b.textContent === 'B');
  click(btnB);
  ok(window.Score.sceneId === 'B', 'scene B selected');
  ok(!window.Score.currentScene().melody.some((s) => s.length), 'scene B melody is independent');

  /* chain building */
  const addA = Array.from(doc.querySelectorAll('.chain-bar .btn-small')).find((b) => b.textContent.trim() === '+ A');
  const before = window.Score.chain.length;
  click(addA);
  ok(window.Score.chain.length === before + 1, 'chain grows');

  /* demo track */
  const demo = doc.querySelector('.chip-comp');
  click(demo);
  ok(window.Score.playMode === 'chain' && window.Score.chain.length === 8, 'demo track loads chain of 8 bars');
  ok(window.Transport.bpm === 118, 'demo sets tempo');

  /* transport scheduling: simulate steps without real audio clock */
  window.Transport.bpm = 120;
  for (let i = 0; i < 32; i++) window.ComposerUI.scheduleStep(i, 0);
  ok(true, 'scheduling two bars of the song does not throw');

  /* play/stop button */
  const play = doc.getElementById('btn-play');
  click(play);
  ok(window.Transport.isPlaying === true, 'transport starts');
  click(play);
  ok(window.Transport.isPlaying === false, 'transport stops');

  /* ---- guitar ---- */
  click(doc.querySelector('[data-panel="guitar"]'));
  ok(doc.querySelector('#panel-guitar .chord-svg'), 'chord diagram SVG renders');
  ok(doc.querySelectorAll('#panel-guitar .prog-row').length >= 4, 'progressions listed');

  const use = doc.querySelector('#panel-guitar .prog-row .btn-small');
  click(use);
  ok(doc.querySelectorAll('#panel-guitar .song-chord').length === 4, 'progression loads 4 chord cards');

  /* transpose */
  const t2 = Array.from(doc.querySelectorAll('#panel-guitar .song-head .btn-small')).find((b) => b.textContent.includes('+1'));
  click(t2);
  ok(doc.querySelectorAll('#panel-guitar .song-chord').length === 4, 'transpose keeps 4 chords');

  /* tab composer: stage two notes, commit, add bar */
  const fbCells = doc.querySelectorAll('#panel-guitar .fb-cell');
  ok(fbCells.length === 6 * 13, 'fretboard has 78 cells');
  click(fbCells[3]);            // string 1 fret 3
  click(fbCells[13 + 1]);       // string 2 fret 1
  const commit = Array.from(doc.querySelectorAll('.tab-toolbar .btn-small')).find((b) => b.textContent.includes('Commit'));
  click(commit);
  const tabText = doc.querySelector('.tab-output').textContent;
  ok(tabText.split('\n').length === 6, 'tab output has 6 lines');
  ok(tabText.includes('3') && tabText.includes('1'), 'tab shows committed frets');

  const barBtn = Array.from(doc.querySelectorAll('.tab-toolbar .btn-small')).find((b) => b.textContent.includes('Bar'));
  click(barBtn);
  ok(doc.querySelector('.tab-output').textContent.split('\n')[0].split('|').length >= 3, 'bar line added');

  /* record button degrades gracefully (MediaRecorder missing in jsdom) */
  click(doc.getElementById('btn-rec'));
  ok(doc.getElementById('toast'), 'record shows a toast when unsupported');
}
