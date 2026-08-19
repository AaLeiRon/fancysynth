/* ============================================================
   SynthLab — audio.js
   Web Audio engine: polyphonic subtractive synth, synthesized
   808-style drum kit, master FX, Karplus-Strong guitar plucks,
   lookahead transport and a master recorder.
   ============================================================ */
(function (root) {
  'use strict';

  const Engine = {
    ctx: null,
    master: null,
    analyser: null,
    recorderDest: null,
    mediaRecorder: null,
    recordedChunks: [],

    // synth params (mutated by UI)
    synth: {
      osc1: { wave: 'sawtooth', octave: 0, level: 0.8 },
      osc2: { wave: 'square', octave: -1, detune: 7, level: 0.5 },
      filter: { type: 'lowpass', cutoff: 2200, q: 6 },
      env: { attack: 0.01, decay: 0.18, sustain: 0.6, release: 0.35 },
      lfo: { rate: 5, depth: 0, target: 'filter' }, // target: filter | pitch
      fx: { drive: 0, delayTime: 0.28, delayFeedback: 0.35, delayMix: 0.18, reverbMix: 0.22 },
      glide: 0,
      volume: 0.7,
    },

    drums: {
      volume: 0.85,
      levels: { kick: 1, snare: 0.9, clap: 0.8, hatC: 0.6, hatO: 0.55, tom: 0.8, rim: 0.7, cow: 0.6 },
    },

    guitarVolume: 0.8,

    activeVoices: new Map(), // midi -> voice
    lfoOsc: null,
    lfoGainFilter: null,
    lfoGainPitchHz: 0, // handled per-voice

    /* ---------------- bootstrap ---------------- */

    init() {
      if (this.ctx) return this.ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      this.ctx = new AC();
      const c = this.ctx;

      this.master = c.createGain();
      this.master.gain.value = 0.9;

      // Synth bus -> filter -> drive -> (dry + delay + reverb) -> synthOut
      this.synthBus = c.createGain();
      this.filterNode = c.createBiquadFilter();
      this.filterNode.type = this.synth.filter.type;
      this.filterNode.frequency.value = this.synth.filter.cutoff;
      this.filterNode.Q.value = this.synth.filter.q;

      this.driveNode = c.createWaveShaper();
      this.setDrive(this.synth.fx.drive);

      this.synthDry = c.createGain();
      this.synthDry.gain.value = 1;

      this.delayNode = c.createDelay(2);
      this.delayNode.delayTime.value = this.synth.fx.delayTime;
      this.delayFb = c.createGain();
      this.delayFb.gain.value = this.synth.fx.delayFeedback;
      this.delayMix = c.createGain();
      this.delayMix.gain.value = this.synth.fx.delayMix;
      this.delayNode.connect(this.delayFb);
      this.delayFb.connect(this.delayNode);

      this.reverbNode = c.createConvolver();
      this.reverbNode.buffer = this.makeImpulse(2.4, 2.6);
      this.reverbMix = c.createGain();
      this.reverbMix.gain.value = this.synth.fx.reverbMix;

      this.synthOut = c.createGain();
      this.synthOut.gain.value = this.synth.volume;

      this.synthBus.connect(this.filterNode);
      this.filterNode.connect(this.driveNode);
      this.driveNode.connect(this.synthDry);
      this.driveNode.connect(this.delayNode);
      this.driveNode.connect(this.reverbNode);
      this.synthDry.connect(this.synthOut);
      this.delayNode.connect(this.delayMix);
      this.delayMix.connect(this.synthOut);
      this.reverbNode.connect(this.reverbMix);
      this.reverbMix.connect(this.synthOut);
      this.synthOut.connect(this.master);

      // Drum bus with a touch of the same reverb
      this.drumBus = c.createGain();
      this.drumBus.gain.value = this.drums.volume;
      this.drumBus.connect(this.master);
      this.drumVerbSend = c.createGain();
      this.drumVerbSend.gain.value = 0.12;
      this.drumBus.connect(this.drumVerbSend);
      this.drumVerbSend.connect(this.reverbNode);

      // Guitar bus
      this.guitarBus = c.createGain();
      this.guitarBus.gain.value = this.guitarVolume;
      this.guitarBus.connect(this.master);
      this.guitarVerbSend = c.createGain();
      this.guitarVerbSend.gain.value = 0.18;
      this.guitarBus.connect(this.guitarVerbSend);
      this.guitarVerbSend.connect(this.reverbNode);

      // LFO -> filter cutoff
      this.lfoOsc = c.createOscillator();
      this.lfoOsc.frequency.value = this.synth.lfo.rate;
      this.lfoGainFilter = c.createGain();
      this.lfoGainFilter.gain.value = 0;
      this.lfoOsc.connect(this.lfoGainFilter);
      this.lfoGainFilter.connect(this.filterNode.frequency);
      this.lfoOsc.start();

      // Analyser + output + recorder tap
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.analyser);
      this.analyser.connect(c.destination);
      if (c.createMediaStreamDestination) {
        this.recorderDest = c.createMediaStreamDestination();
        this.analyser.connect(this.recorderDest);
      }
      return c;
    },

    resume() {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    now() { return this.ctx ? this.ctx.currentTime : 0; },

    makeImpulse(seconds, decay) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    },

    setDrive(amount) {
      // amount 0..1 -> waveshaper curve
      this.synth.fx.drive = amount;
      if (!this.driveNode) return;
      const k = amount * 60;
      const n = 512;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = k > 0 ? Math.tanh(k * x) / Math.tanh(k) : x;
      }
      this.driveNode.curve = curve;
      this.driveNode.oversample = '2x';
    },

    /* ---------------- live param updates ---------------- */

    applySynthParams() {
      if (!this.ctx) return;
      const s = this.synth, t = this.now();
      this.filterNode.type = s.filter.type;
      this.filterNode.frequency.setTargetAtTime(s.filter.cutoff, t, 0.02);
      this.filterNode.Q.setTargetAtTime(s.filter.q, t, 0.02);
      this.delayNode.delayTime.setTargetAtTime(s.fx.delayTime, t, 0.05);
      this.delayFb.gain.setTargetAtTime(s.fx.delayFeedback, t, 0.05);
      this.delayMix.gain.setTargetAtTime(s.fx.delayMix, t, 0.05);
      this.reverbMix.gain.setTargetAtTime(s.fx.reverbMix, t, 0.05);
      this.synthOut.gain.setTargetAtTime(s.volume, t, 0.02);
      this.lfoOsc.frequency.setTargetAtTime(s.lfo.rate, t, 0.02);
      const filterDepth = s.lfo.target === 'filter' ? s.lfo.depth * 3000 : 0;
      this.lfoGainFilter.gain.setTargetAtTime(filterDepth, t, 0.02);
    },

    /* ---------------- synth voices ---------------- */

    noteOn(midi, velocity, when) {
      this.resume();
      const c = this.ctx, s = this.synth;
      const t = when == null ? c.currentTime : when;
      if (this.activeVoices.has(midi)) this.noteOff(midi, t);

      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const vel = velocity == null ? 0.9 : velocity;

      const vGain = c.createGain();
      vGain.gain.value = 0;
      vGain.connect(this.synthBus);

      const oscs = [];
      const mk = (cfg, extraDetune) => {
        const o = c.createOscillator();
        o.type = cfg.wave;
        o.frequency.value = freq * Math.pow(2, cfg.octave);
        o.detune.value = extraDetune || 0;
        const g = c.createGain();
        g.gain.value = cfg.level;
        o.connect(g);
        g.connect(vGain);
        // pitch LFO per-voice
        if (s.lfo.target === 'pitch' && s.lfo.depth > 0) {
          const lg = c.createGain();
          lg.gain.value = s.lfo.depth * 40; // cents
          this.lfoOsc.connect(lg);
          lg.connect(o.detune);
        }
        o.start(t);
        oscs.push(o);
        return o;
      };
      mk(s.osc1, 0);
      mk(s.osc2, s.osc2.detune);

      const e = s.env;
      const peak = 0.32 * vel;
      vGain.gain.cancelScheduledValues(t);
      vGain.gain.setValueAtTime(0, t);
      vGain.gain.linearRampToValueAtTime(peak, t + Math.max(0.002, e.attack));
      vGain.gain.setTargetAtTime(peak * e.sustain, t + Math.max(0.002, e.attack), Math.max(0.01, e.decay / 3));

      const voice = { oscs, vGain, midi };
      this.activeVoices.set(midi, voice);
      return voice;
    },

    noteOff(midi, when) {
      if (!this.ctx) return;
      const voice = this.activeVoices.get(midi);
      if (!voice) return;
      const t = when == null ? this.ctx.currentTime : when;
      const rel = Math.max(0.02, this.synth.env.release);
      voice.vGain.gain.cancelScheduledValues(t);
      voice.vGain.gain.setTargetAtTime(0, t, rel / 4);
      voice.oscs.forEach((o) => { try { o.stop(t + rel + 0.3); } catch (e) {} });
      this.activeVoices.delete(midi);
      setTimeout(() => { try { voice.vGain.disconnect(); } catch (e) {} }, (rel + 0.5) * 1000);
    },

    /** Scheduled note with fixed duration (for the composer). */
    playNote(midi, when, duration, velocity) {
      const v = this.noteOn(midi, velocity, when);
      // schedule release manually (do not touch activeVoices map timing)
      const c = this.ctx, e = this.synth.env;
      const tOff = when + duration;
      const rel = Math.max(0.02, e.release);
      v.vGain.gain.setTargetAtTime(0, tOff, rel / 4);
      v.oscs.forEach((o) => { try { o.stop(tOff + rel + 0.3); } catch (err) {} });
      this.activeVoices.delete(midi);
    },

    allNotesOff() {
      for (const midi of Array.from(this.activeVoices.keys())) this.noteOff(midi);
    },

    /* ---------------- drums (all synthesized) ---------------- */

    noiseBuffer() {
      if (this._noise) return this._noise;
      const rate = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, rate, rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < rate; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
      return buf;
    },

    playDrum(name, when, accent) {
      this.resume();
      const t = when == null ? this.ctx.currentTime : when;
      const lvl = (this.drums.levels[name] == null ? 0.8 : this.drums.levels[name]) * (accent ? 1.25 : 1);
      const fn = {
        kick: () => this.drumKick(t, lvl),
        snare: () => this.drumSnare(t, lvl),
        clap: () => this.drumClap(t, lvl),
        hatC: () => this.drumHat(t, lvl, 0.045),
        hatO: () => this.drumHat(t, lvl, 0.32),
        tom: () => this.drumTom(t, lvl),
        rim: () => this.drumRim(t, lvl),
        cow: () => this.drumCowbell(t, lvl),
      }[name];
      if (fn) fn();
    },

    drumKick(t, lvl) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      g.gain.setValueAtTime(1.1 * lvl, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.connect(g); g.connect(this.drumBus);
      o.start(t); o.stop(t + 0.5);
      // click transient
      const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
      const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 4000;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.35 * lvl, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      n.connect(nf); nf.connect(ng); ng.connect(this.drumBus);
      n.start(t); n.stop(t + 0.03);
    },

    drumSnare(t, lvl) {
      const c = this.ctx;
      const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.8 * lvl, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      n.connect(bp); bp.connect(ng); ng.connect(this.drumBus);
      n.start(t); n.stop(t + 0.25);
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      const og = c.createGain();
      og.gain.setValueAtTime(0.5 * lvl, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(this.drumBus);
      o.start(t); o.stop(t + 0.15);
    },

    drumClap(t, lvl) {
      const c = this.ctx;
      [0, 0.012, 0.026].forEach((dt, i) => {
        const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.6;
        const g = c.createGain();
        const amp = (i === 2 ? 0.8 : 0.45) * lvl;
        g.gain.setValueAtTime(amp, t + dt);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + (i === 2 ? 0.24 : 0.03));
        n.connect(bp); bp.connect(g); g.connect(this.drumBus);
        n.start(t + dt); n.stop(t + dt + 0.3);
      });
    },

    drumHat(t, lvl, decay) {
      const c = this.ctx;
      const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      const g = c.createGain();
      g.gain.setValueAtTime(0.5 * lvl, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      n.connect(hp); hp.connect(g); g.connect(this.drumBus);
      n.start(t); n.stop(t + decay + 0.05);
    },

    drumTom(t, lvl) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(85, t + 0.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.9 * lvl, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g); g.connect(this.drumBus);
      o.start(t); o.stop(t + 0.4);
    },

    drumRim(t, lvl) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.value = 1750;
      const g = c.createGain();
      g.gain.setValueAtTime(0.35 * lvl, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1750; bp.Q.value = 4;
      o.connect(bp); bp.connect(g); g.connect(this.drumBus);
      o.start(t); o.stop(t + 0.05);
    },

    drumCowbell(t, lvl) {
      const c = this.ctx;
      [540, 810].forEach((f) => {
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 680; bp.Q.value = 2.2;
        const g = c.createGain();
        g.gain.setValueAtTime(0.3 * lvl, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        o.connect(bp); bp.connect(g); g.connect(this.drumBus);
        o.start(t); o.stop(t + 0.3);
      });
    },

    /* ------------- guitar: Karplus-Strong pluck ------------- */

    pluckBuffer(freq, seconds, brightness) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(1, len, rate);
      const out = buf.getChannelData(0);
      const period = Math.max(2, Math.round(rate / freq));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
      const damp = brightness == null ? 0.996 : brightness;
      let idx = 0;
      for (let i = 0; i < len; i++) {
        const cur = ring[idx];
        const next = ring[(idx + 1) % period];
        const avg = damp * 0.5 * (cur + next);
        out[i] = cur;
        ring[idx] = avg;
        idx = (idx + 1) % period;
      }
      return buf;
    },

    pluck(midi, when, velocity) {
      this.resume();
      const t = when == null ? this.ctx.currentTime : when;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const src = this.ctx.createBufferSource();
      src.buffer = this.pluckBuffer(freq, 2.2, 0.9955);
      const g = this.ctx.createGain();
      g.gain.value = 0.5 * (velocity == null ? 1 : velocity);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5200;
      src.connect(lp); lp.connect(g); g.connect(this.guitarBus);
      src.start(t);
    },

    /** Strum an array of midi notes (low to high). dir: 1 down, -1 up. */
    strum(midis, when, dir, spread) {
      this.resume();
      const t = when == null ? this.ctx.currentTime : when;
      const gap = spread == null ? 0.028 : spread;
      const list = dir === -1 ? midis.slice().reverse() : midis;
      list.forEach((m, i) => this.pluck(m, t + i * gap, 0.95 - i * 0.04));
    },

    /* ---------------- recorder ---------------- */

    canRecord() {
      return !!(this.recorderDest && root.MediaRecorder);
    },

    startRecording() {
      if (!this.canRecord()) return false;
      this.recordedChunks = [];
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = types.find((tp) => MediaRecorder.isTypeSupported(tp)) || '';
      this.mediaRecorder = new MediaRecorder(this.recorderDest.stream, mime ? { mimeType: mime } : undefined);
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size) this.recordedChunks.push(e.data); };
      this.mediaRecorder.start();
      return true;
    },

    stopRecording() {
      return new Promise((resolve) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') { resolve(null); return; }
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
          resolve(blob);
        };
        this.mediaRecorder.stop();
      });
    },
  };

  /* ---------------- Transport (lookahead scheduler) ---------------- */

  const Transport = {
    bpm: 112,
    swing: 0,           // 0..0.6 of a 16th
    isPlaying: false,
    current16th: 0,
    nextNoteTime: 0,
    lookahead: 25,       // ms timer
    scheduleAhead: 0.12, // s
    timer: null,
    listeners: [],       // fn(stepIndex, when)

    onStep(fn) { this.listeners.push(fn); },

    sixteenthLength() { return 60 / this.bpm / 4; },

    start() {
      Engine.resume();
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.current16th = 0;
      this.nextNoteTime = Engine.now() + 0.06;
      this.timer = setInterval(() => this.schedule(), this.lookahead);
    },

    stop() {
      this.isPlaying = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      Engine.allNotesOff();
    },

    schedule() {
      while (this.nextNoteTime < Engine.now() + this.scheduleAhead) {
        let when = this.nextNoteTime;
        if (this.swing > 0 && this.current16th % 2 === 1) {
          when += this.swing * this.sixteenthLength();
        }
        for (const fn of this.listeners) fn(this.current16th, when);
        this.nextNoteTime += this.sixteenthLength();
        this.current16th++;
      }
    },
  };

  root.Engine = Engine;
  root.Transport = Transport;
})(typeof window !== 'undefined' ? window : globalThis);
