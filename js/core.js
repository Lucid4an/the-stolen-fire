'use strict';
// Core: constants, math, random, input, sound. Everything else builds on this file.
const W = 480, H = 270, TS = 16;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const easeOut = (t) => 1 - (1 - t) * (1 - t);

// ---------------------------------------------------------------- input
const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyZ'], attack: ['KeyJ', 'KeyX'], special: ['KeyK', 'KeyC'], dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  cast: ['KeyI', 'KeyV'], interact: ['KeyE', 'KeyF'], pause: ['Escape', 'KeyP'],
};
const PADMAP = { jump: 0, dash: 1, attack: 2, special: 3, cast: 5, interact: 4, pause: 9 };

const Input = {
  down: {}, pressed: {}, released: {}, keys: new Set(), touch: {}, device: 'kb',
  init() {
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.device = 'kb';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  },
  update() {
    const now = {};
    for (const [act, codes] of Object.entries(KEYMAP)) now[act] = codes.some((c) => this.keys.has(c)) || !!this.touch[act];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = (i) => p.buttons[i] && p.buttons[i].pressed;
      if (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5 || p.buttons.some((x) => x.pressed)) this.device = 'pad';
      now.left = now.left || ax < -0.4 || b(14); now.right = now.right || ax > 0.4 || b(15);
      now.up = now.up || ay < -0.5 || b(12); now.down = now.down || ay > 0.5 || b(13);
      for (const [act, i] of Object.entries(PADMAP)) now[act] = now[act] || b(i);
      now.dash = now.dash || b(7) || b(6);
    }
    for (const act of Object.keys(KEYMAP)) {
      this.pressed[act] = now[act] && !this.down[act];
      this.released[act] = !now[act] && this.down[act];
      this.down[act] = now[act];
    }
  },
  get mx() { return (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0); },
};

// ---------------------------------------------------------------- sound (synthesized, no files)
const SFX = {
  ctx: null, master: null, muted: false,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, hp = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  },
  play(name) {
    switch (name) {
      case 'swing': this.noise(0.08, 0.18, 2500); break;
      case 'heavy': this.noise(0.14, 0.25, 900); this.tone(110, 0.12, 'sawtooth', 0.12, -50); break;
      case 'hit': this.tone(180, 0.07, 'square', 0.2, -90); this.noise(0.05, 0.2, 1500); break;
      case 'crit': this.tone(520, 0.1, 'square', 0.18, 300); this.noise(0.08, 0.25, 1200); break;
      case 'hurt': this.tone(220, 0.2, 'sawtooth', 0.25, -150); break;
      case 'jump': this.tone(300, 0.08, 'triangle', 0.12, 200); break;
      case 'dash': this.noise(0.12, 0.2, 3000); this.tone(700, 0.08, 'sine', 0.08, -400); break;
      case 'cast': this.tone(160, 0.25, 'sawtooth', 0.12, 400); this.noise(0.2, 0.12, 400); break;
      case 'boom': this.noise(0.4, 0.35, 120); this.tone(70, 0.35, 'sine', 0.3, -30); break;
      case 'kill': this.tone(400, 0.08, 'square', 0.12, -200); this.tone(250, 0.12, 'triangle', 0.12, -120, 0.05); break;
      case 'pickup': this.tone(660, 0.07, 'square', 0.12); this.tone(990, 0.1, 'square', 0.12, 0, 0.07); break;
      case 'boon': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.08)); break;
      case 'door': this.tone(90, 0.3, 'sawtooth', 0.15, 40); this.noise(0.3, 0.1, 300); break;
      case 'screech': this.tone(1400, 0.35, 'sawtooth', 0.15, -900); this.tone(1100, 0.3, 'square', 0.08, -700, 0.05); break;
      case 'ui': this.tone(880, 0.04, 'square', 0.08); break;
      case 'deny': this.tone(140, 0.12, 'square', 0.12); break;
      case 'block': this.tone(900, 0.06, 'square', 0.12, -300); break;
    }
  },
};

// ---------------------------------------------------------------- save (per-browser, optional)
const Save = {
  key: 'the-stolen-fire-v1',
  data: { ichor: 0, runs: 0, deaths: 0, wins: 0, bestRoom: 0, weapon: 'blade', upgrades: {}, seen: {}, lastKiller: null, eagleKills: 0 },
  load() {
    try { const s = JSON.parse(localStorage.getItem(this.key)); if (s) Object.assign(this.data, s); } catch (e) { /* storage unavailable */ }
  },
  write() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
};
