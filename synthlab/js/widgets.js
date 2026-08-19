/* ============================================================
   SynthLab — widgets.js
   Hardware-style controls: rotary knobs (drag or scroll),
   segmented switches, labelled selects.
   ============================================================ */
(function (root) {
  'use strict';

  /**
   * Rotary knob. opts:
   *  label, min, max, value, step, accent (css color),
   *  format(v) -> display string, onChange(v), log (bool)
   * Returns { el, set(v), get() }
   */
  function makeKnob(opts) {
    const o = Object.assign({ min: 0, max: 1, step: 0.01, value: 0.5, format: (v) => v.toFixed(2) }, opts);
    let value = clamp(o.value, o.min, o.max);

    const el = document.createElement('div');
    el.className = 'knob';
    if (o.accent) el.style.setProperty('--knob-accent', o.accent);
    el.innerHTML =
      '<div class="knob-dial" tabindex="0" role="slider" aria-label="' + escapeHtml(o.label || '') + '">' +
        '<svg viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle class="knob-track" cx="32" cy="32" r="26"/>' +
          '<path class="knob-arc" d=""/>' +
          '<g class="knob-cap"><circle cx="32" cy="32" r="19"/>' +
          '<line class="knob-pointer" x1="32" y1="32" x2="32" y2="15"/></g>' +
        '</svg>' +
      '</div>' +
      '<div class="knob-value"></div>' +
      '<div class="knob-label">' + escapeHtml(o.label || '') + '</div>';

    const dial = el.querySelector('.knob-dial');
    const arc = el.querySelector('.knob-arc');
    const cap = el.querySelector('.knob-cap');
    const valueEl = el.querySelector('.knob-value');

    const A0 = -135, A1 = 135; // degrees

    function norm(v) {
      if (o.log) {
        const lmin = Math.log(o.min), lmax = Math.log(o.max);
        return (Math.log(v) - lmin) / (lmax - lmin);
      }
      return (v - o.min) / (o.max - o.min);
    }
    function denorm(n) {
      n = clamp(n, 0, 1);
      if (o.log) {
        const lmin = Math.log(o.min), lmax = Math.log(o.max);
        return Math.exp(lmin + n * (lmax - lmin));
      }
      return o.min + n * (o.max - o.min);
    }
    function snap(v) {
      const s = o.step || 0.001;
      return clamp(Math.round(v / s) * s, o.min, o.max);
    }

    function draw() {
      const n = norm(value);
      const ang = A0 + n * (A1 - A0);
      cap.setAttribute('transform', 'rotate(' + ang + ' 32 32)');
      arc.setAttribute('d', describeArc(32, 32, 26, A0, ang));
      valueEl.textContent = o.format(value);
      dial.setAttribute('aria-valuemin', o.min);
      dial.setAttribute('aria-valuemax', o.max);
      dial.setAttribute('aria-valuenow', value);
      dial.setAttribute('aria-valuetext', o.format(value));
    }

    function setValue(v, fire) {
      value = snap(v);
      draw();
      if (fire !== false && o.onChange) o.onChange(value);
    }

    // vertical drag
    let dragging = false, startY = 0, startN = 0;
    dial.addEventListener('pointerdown', (e) => {
      dragging = true; startY = e.clientY; startN = norm(value);
      dial.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      e.preventDefault();
    });
    dial.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = startY - e.clientY;
      const fine = e.shiftKey ? 0.25 : 1;
      setValue(denorm(startN + (dy / 160) * fine));
    });
    const endDrag = () => { dragging = false; el.classList.remove('is-dragging'); };
    dial.addEventListener('pointerup', endDrag);
    dial.addEventListener('pointercancel', endDrag);
    dial.addEventListener('dblclick', () => setValue(o.value));
    dial.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      setValue(denorm(norm(value) + dir * (e.shiftKey ? 0.01 : 0.04)));
    }, { passive: false });
    dial.addEventListener('keydown', (e) => {
      const big = (o.max - o.min) / 20;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setValue(denorm(norm(value) + 0.04)); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setValue(denorm(norm(value) - 0.04)); e.preventDefault(); }
      if (e.key === 'Home') { setValue(o.min); e.preventDefault(); }
      if (e.key === 'End') { setValue(o.max); e.preventDefault(); }
      void big;
    });

    draw();
    return { el, set: (v) => setValue(v, false), get: () => value };
  }

  /**
   * Segmented switch. opts: label, options:[{value,text}], value, onChange, accent
   */
  function makeSwitch(opts) {
    const el = document.createElement('div');
    el.className = 'seg';
    if (opts.accent) el.style.setProperty('--seg-accent', opts.accent);
    const row = document.createElement('div');
    row.className = 'seg-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', opts.label || '');
    let value = opts.value;
    const buttons = opts.options.map((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.textContent = op.text;
      b.addEventListener('click', () => {
        value = op.value;
        update();
        if (opts.onChange) opts.onChange(value);
      });
      row.appendChild(b);
      return { b, op };
    });
    function update() {
      buttons.forEach(({ b, op }) => {
        b.classList.toggle('is-on', op.value === value);
        b.setAttribute('aria-pressed', op.value === value ? 'true' : 'false');
      });
    }
    update();
    el.appendChild(row);
    if (opts.label) {
      const lab = document.createElement('div');
      lab.className = 'seg-label';
      lab.textContent = opts.label;
      el.appendChild(lab);
    }
    return { el, set: (v) => { value = v; update(); }, get: () => value };
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function polar(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function describeArc(cx, cy, r, a0, a1) {
    if (a1 <= a0 + 0.01) a1 = a0 + 0.01;
    const s = polar(cx, cy, r, a0);
    const e = polar(cx, cy, r, a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return 'M ' + s.x.toFixed(2) + ' ' + s.y.toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + e.x.toFixed(2) + ' ' + e.y.toFixed(2);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  root.Widgets = { makeKnob, makeSwitch };
})(window);
