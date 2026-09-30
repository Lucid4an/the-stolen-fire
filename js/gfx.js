'use strict';
// Rendering helpers: screen scaling, camera and shake, particles, and the darkness/lighting pass.
const Gfx = {
  canvas: null, ctx: null, dark: null, dctx: null, scale: 2,
  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H;
    this.dctx = this.dark.getContext('2d');
    addEventListener('resize', () => this.fit()); this.fit();
  },
  fit() {
    const stage = document.getElementById('stage');
    const sw = innerWidth, sh = innerHeight;
    const s = Math.max(1, Math.min(Math.floor(sw / W), Math.floor(sh / H)) || Math.min(sw / W, sh / H));
    this.scale = s;
    stage.style.width = W * s + 'px'; stage.style.height = H * s + 'px';
    document.documentElement.style.setProperty('--px', s + 'px');
  },
};

// ---------------------------------------------------------------- camera
const Cam = {
  x: 0, y: 0, shakeT: 0, shakeMag: 0, ox: 0, oy: 0,
  follow(tx, ty, bw, bh, dt, snap = false) {
    const k = snap ? 1 : 1 - Math.pow(0.0008, dt);
    this.x = lerp(this.x, clamp(tx - W / 2, 0, Math.max(0, bw - W)), k);
    this.y = lerp(this.y, clamp(ty - H / 2, 0, Math.max(0, bh - H)), k);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * clamp(this.shakeT / 0.25, 0, 1);
      this.ox = rand(-m, m); this.oy = rand(-m, m);
    } else { this.ox = 0; this.oy = 0; }
  },
  shake(mag, t = 0.25) { if (mag >= this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; this.shakeT = t; } },
  get sx() { return Math.round(this.x + this.ox); },
  get sy() { return Math.round(this.y + this.oy); },
};

// ---------------------------------------------------------------- particles
const Parts = {
  list: [],
  add(p) { this.list.push(Object.assign({ vx: 0, vy: 0, life: 0.5, max: 0.5, size: 2, grav: 0, drag: 0, glow: 0, col: '#fff' }, p)); },
  burst(x, y, n, cols, speed = 80, life = 0.45, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.angle != null ? opt.angle + rand(-(opt.spread || 0.6), opt.spread || 0.6) : rand(0, Math.PI * 2);
      const s = rand(speed * 0.35, speed), l = rand(life * 0.6, life);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (opt.up || 0), life: l, max: l, col: Array.isArray(cols) ? pick(cols) : cols,
        size: opt.size || (Math.random() < 0.3 ? 2 : 1), grav: opt.grav != null ? opt.grav : 200, drag: opt.drag || 1.5, glow: opt.glow || 0 });
    }
  },
  embers(x, y, n = 1) {
    for (let i = 0; i < n; i++) this.add({ x: x + rand(-3, 3), y, vx: rand(-12, 12), vy: rand(-45, -20), life: rand(0.4, 0.9), max: 0.9,
      col: pick(['#ffd36a', '#ff8a2a', '#ff5a1a']), size: 1, grav: -10, drag: 0.8, glow: 14 });
  },
  update(dt) {
    for (const p of this.list) {
      p.life -= dt; p.vy += p.grav * dt; const d = Math.pow(0.5, p.drag * dt * 3);
      p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  },
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1);
      ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- floating numbers
const Nums = {
  list: [],
  add(x, y, text, col = '#fff', big = false) { this.list.push({ x, y, text: String(text), col, big, t: 0 }); },
  update(dt) { for (const n of this.list) n.t += dt; this.list = this.list.filter((n) => n.t < 0.75); },
  draw(ctx) {
    for (const n of this.list) {
      const y = Math.round(n.y - 18 * easeOut(Math.min(1, n.t / 0.5)));
      ctx.globalAlpha = n.t > 0.5 ? 1 - (n.t - 0.5) / 0.25 : 1;
      drawText(ctx, n.text, Math.round(n.x), y, n.col, n.big ? 2 : 1, 'center');
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- lighting
// Darkness covers the world; each light punches a soft hole in it. Warm lights also add a glow.
const Light = {
  lights: [],
  ambient: 0.9,
  add(x, y, r, col = null, strength = 1) { this.lights.push({ x, y, r, col, s: strength }); },
  render(ctx) {
    const d = Gfx.dctx, cx = Cam.sx, cy = Cam.sy;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(3,1,4,${this.ambient})`; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    for (const l of this.lights) {
      const x = l.x - cx, y = l.y - cy;
      if (x < -l.r || y < -l.r || x > W + l.r || y > H + l.r) continue;
      const g = d.createRadialGradient(x, y, 0, x, y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.s})`); g.addColorStop(0.55, `rgba(0,0,0,${l.s * 0.65})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(Gfx.dark, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      if (!l.col) continue;
      const x = l.x - cx, y = l.y - cy, r = l.r * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, l.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.16 * l.s; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    this.lights.length = 0;
  },
};

// ---------------------------------------------------------------- tiny pixel text (canvas font)
function drawText(ctx, text, x, y, col = '#fff', size = 1, align = 'left') {
  ctx.font = `${size === 2 ? 16 : 8}px "Pixelify Sans", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = col; ctx.fillText(text, x, y);
}

// A painter draws rectangles in a character's local space: origin at the feet, +x = facing direction.
function painter(ctx, ox, oy, face, override) {
  return {
    r(x, y, w, h, col) {
      ctx.fillStyle = override || col;
      const px = face > 0 ? ox + x : ox - x - w;
      ctx.fillRect(Math.round(px), Math.round(oy + y), w, h);
    },
  };
}
