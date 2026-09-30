'use strict';
// Loads an ASCII room, renders its tiles once into a cached canvas, and resolves collisions.
const T_EMPTY = 0, T_ROCK = 1, T_LEDGE = 2, T_LAVA = 3;

function hashRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const PAL = {
  deep: '#0b0504', rock: '#1f120f', rock2: '#2a1814', edge: '#4a2418', crust: '#ff6a1f', crust2: '#b83a14',
  ledge: '#3a2418', ledgeTop: '#8a4a26', chain: '#5a5058', chainL: '#8a8090',
  sky1: '#070203', sky2: '#2a0a06', far: '#180806', mid: '#100504',
};

class Room {
  constructor(key) {
    const rows = ROOMS[key];
    this.key = key;
    this.tw = rows[0].length; this.th = rows.length;
    this.pw = this.tw * TS; this.ph = this.th * TS;
    this.tiles = new Uint8Array(this.tw * this.th);
    this.marks = [];
    for (let y = 0; y < this.th; y++) {
      for (let x = 0; x < this.tw; x++) {
        const c = rows[y][x];
        const t = c === '#' ? T_ROCK : c === '=' ? T_LEDGE : c === 'L' ? T_LAVA : T_EMPTY;
        this.tiles[y * this.tw + x] = t;
        if (t === T_EMPTY && c !== '.') this.marks.push({ c, tx: x, ty: y, x: x * TS + TS / 2, y: this.groundBelow(rows, x, y) });
      }
    }
    this.render();
    this.lavaTiles = [];
    for (let y = 0; y < this.th; y++) for (let x = 0; x < this.tw; x++) if (this.at(x, y) === T_LAVA) this.lavaTiles.push({ x, y });
  }

  groundBelow(rows, x, y) {
    for (let yy = y; yy < rows.length; yy++) { const c = rows[yy][x]; if (c === '#' || c === '=' || c === 'L') return yy * TS; }
    return (y + 1) * TS;
  }

  at(tx, ty) { return (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) ? T_ROCK : this.tiles[ty * this.tw + tx]; }
  solidAt(px, py) { const t = this.at(Math.floor(px / TS), Math.floor(py / TS)); return t === T_ROCK || t === T_LAVA; }
  marksOf(c) { return this.marks.filter((m) => m.c === c); }

  // ---- rendering (once) ----
  render() {
    const c = document.createElement('canvas'); c.width = this.pw; c.height = this.ph;
    const x = c.getContext('2d'), R = hashRng(this.tw * 131 + this.th * 7 + this.key.length * 997);
    const solid = (tx, ty) => { const t = this.at(tx, ty); return t === T_ROCK || t === T_LAVA; };
    // distance to open air, so deep rock can be drawn nearly black
    const depth = (tx, ty) => { for (let d = 1; d <= 3; d++) for (let yy = -d; yy <= d; yy++) for (let xx = -d; xx <= d; xx++) if (!solid(tx + xx, ty + yy) && this.at(tx + xx, ty + yy) !== T_LEDGE) return d; return 4; };
    for (let ty = 0; ty < this.th; ty++) for (let tx = 0; tx < this.tw; tx++) {
      const t = this.at(tx, ty), px = tx * TS, py = ty * TS;
      if (t === T_ROCK) {
        const d = depth(tx, ty);
        x.fillStyle = d >= 3 ? PAL.deep : d === 2 ? '#150b09' : PAL.rock; x.fillRect(px, py, TS, TS);
        if (d === 1) {
          for (let k = 0; k < 6; k++) { x.fillStyle = R() < 0.5 ? PAL.rock2 : '#170d0b'; x.fillRect(px + Math.floor(R() * 14), py + Math.floor(R() * 14), 2 + Math.floor(R() * 3), 1 + Math.floor(R() * 2)); }
          const up = !solid(tx, ty - 1) && this.at(tx, ty - 1) !== T_LEDGE, dn = !solid(tx, ty + 1), lf = !solid(tx - 1, ty), rt = !solid(tx + 1, ty);
          x.fillStyle = PAL.edge;
          if (lf) x.fillRect(px, py, 1, TS);
          if (rt) x.fillRect(px + TS - 1, py, 1, TS);
          if (dn) { x.fillStyle = '#0a0403'; x.fillRect(px, py + TS - 3, TS, 3); if (R() < 0.4) { x.fillStyle = PAL.rock; x.fillRect(px + 3 + Math.floor(R() * 10), py + TS, 2, 2 + Math.floor(R() * 4)); } }
          if (up) {
            x.fillStyle = PAL.crust2; x.fillRect(px, py, TS, 3);
            x.fillStyle = PAL.crust; x.fillRect(px, py, TS, 1);
            for (let k = 0; k < 2; k++) if (R() < 0.6) { x.fillStyle = PAL.crust2; x.fillRect(px + Math.floor(R() * 14), py + 3, 1, 1 + Math.floor(R() * 3)); }
          }
          // glowing cracks
          if (R() < 0.18) { x.fillStyle = '#7a2410'; let cx = px + 3 + Math.floor(R() * 10), cy = py + 4; for (let k = 0; k < 5; k++) { x.fillRect(cx, cy, 1, 1); cx += Math.floor(R() * 3) - 1; cy += 1; } }
        }
      } else if (t === T_LEDGE) {
        x.fillStyle = PAL.ledge; x.fillRect(px, py, TS, 5);
        x.fillStyle = PAL.ledgeTop; x.fillRect(px, py, TS, 1);
        x.fillStyle = '#1a0e0a'; x.fillRect(px, py + 4, TS, 1); x.fillRect(px + (tx % 2 ? 5 : 11), py + 1, 1, 3);
        if (solid(tx - 1, ty) || solid(tx + 1, ty)) { x.fillStyle = '#2a1812'; const bx = solid(tx - 1, ty) ? px : px + 12; x.fillRect(bx, py + 5, 4, 2); }
      }
    }
    // hanging chains from the ceiling
    for (const m of this.marks) if (m.c === 'C') {
      const len = 40 + Math.floor(R() * 60);
      for (let k = 0; k < len; k += 3) { x.fillStyle = k % 6 ? PAL.chain : PAL.chainL; x.fillRect(m.x - 1 + (k % 6 ? 0 : 1), m.ty * TS + k, 2, 2); }
      x.fillStyle = '#6a6070'; x.fillRect(m.x - 3, m.ty * TS + len, 6, 3);
    }
    this.canvas = c;
  }

  // ---- collision: moves an entity box (x,y,w,h,vx,vy) through tiles ----
  move(e, dt, opts = {}) {
    e.onGround = false; e.hitWall = 0;
    // horizontal
    let nx = e.x + e.vx * dt;
    if (e.vx !== 0) {
      const edge = e.vx > 0 ? nx + e.w : nx;
      for (let yy = e.y + 1; yy < e.y + e.h - 1; yy += Math.min(8, e.h - 2)) {
        if (this.solidAt(edge, yy) || this.solidAt(edge, e.y + e.h - 2)) {
          nx = e.vx > 0 ? Math.floor(edge / TS) * TS - e.w - 0.01 : Math.floor(edge / TS) * TS + TS + 0.01;
          e.hitWall = sign(e.vx); e.vx = 0; break;
        }
      }
    }
    e.x = nx;
    // vertical
    let ny = e.y + e.vy * dt;
    if (e.vy > 0) {
      const foot = ny + e.h, prevFoot = e.y + e.h;
      for (const px of [e.x + 1, e.x + e.w / 2, e.x + e.w - 1]) {
        const tx = Math.floor(px / TS), ty = Math.floor(foot / TS), t = this.at(tx, ty);
        const ledgeHit = t === T_LEDGE && !opts.dropThrough && prevFoot <= ty * TS + 0.5;
        if (t === T_ROCK || t === T_LAVA || ledgeHit) {
          ny = ty * TS - e.h; e.vy = 0; e.onGround = true; e.groundType = t; break;
        }
      }
    } else if (e.vy < 0) {
      for (const px of [e.x + 1, e.x + e.w - 1]) {
        if (this.solidAt(px, ny)) { ny = Math.floor(ny / TS) * TS + TS; e.vy = 0; break; }
      }
    }
    e.y = ny;
  }

  // Standing-still check used for "am I on ground right now" without moving.
  groundUnder(e) {
    const foot = e.y + e.h + 1;
    for (const px of [e.x + 1, e.x + e.w - 1]) { const t = this.at(Math.floor(px / TS), Math.floor(foot / TS)); if (t !== T_EMPTY) return t; }
    return T_EMPTY;
  }
}

// ---------------------------------------------------------------- backdrop (parallax, drawn once)
const Backdrop = {
  far: null, mid: null,
  build() {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // far: glowing abyss with stalactite silhouettes
    const f = mk(W * 2, H), fx = f.getContext('2d'), R = hashRng(7);
    const g = fx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.sky1); g.addColorStop(0.7, '#1a0604'); g.addColorStop(1, PAL.sky2);
    fx.fillStyle = g; fx.fillRect(0, 0, f.width, H);
    fx.fillStyle = PAL.far;
    for (let x = 0; x < f.width; x += 6) { const h = 20 + R() * 60 + Math.sin(x * 0.02) * 20; fx.fillRect(x, 0, 6, h); }
    for (let x = 0; x < f.width; x += 8) { const h = 30 + R() * 50 + Math.cos(x * 0.013) * 25; fx.fillRect(x, H - h, 8, h); }
    this.far = f;
    // mid: rock pillars and distant chains
    const m = mk(W * 2, H), mx = m.getContext('2d'), R2 = hashRng(99);
    for (let i = 0; i < 9; i++) {
      const px = i * 110 + R2() * 40, pw = 18 + R2() * 26;
      mx.fillStyle = PAL.mid; mx.fillRect(px, 0, pw, H);
      mx.fillStyle = '#1c0907'; mx.fillRect(px, 0, 2, H);
      for (let y = 30 + R2() * 40; y < H; y += 40 + R2() * 60) { mx.fillStyle = '#3a0e06'; mx.fillRect(px + 3, y, pw - 6, 1); }
    }
    for (let i = 0; i < 6; i++) { const cx = 60 + i * 150 + R2() * 50; for (let y = 0; y < 90 + R2() * 90; y += 4) { mx.fillStyle = '#2a1414'; mx.fillRect(cx, y, 2, 3); } }
    this.mid = m;
  },
  draw(ctx, room) {
    const cx = Cam.sx, cy = Cam.sy;
    const fo = -((cx * 0.12) % W), mo = -((cx * 0.3) % W);
    ctx.drawImage(this.far, Math.round(fo), Math.round(-cy * 0.05));
    ctx.drawImage(this.far, Math.round(fo + W * 2 - 1), Math.round(-cy * 0.05));
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.mid, Math.round(mo), Math.round(-cy * 0.15));
    ctx.drawImage(this.mid, Math.round(mo + W * 2 - 1), Math.round(-cy * 0.15));
    ctx.globalAlpha = 1;
  },
};

// Animated lava is drawn every frame on top of the cached tiles.
function drawLava(ctx, room, t) {
  for (const l of room.lavaTiles) {
    const px = l.x * TS, py = l.y * TS;
    ctx.fillStyle = '#c23a0e'; ctx.fillRect(px, py + 2, TS, TS - 2);
    for (let i = 0; i < TS; i += 2) {
      const h = 2 + Math.round(Math.sin(t * 3 + (px + i) * 0.35) * 1.5);
      ctx.fillStyle = '#ff7a1f'; ctx.fillRect(px + i, py + 4 - h, 2, h);
    }
    ctx.fillStyle = '#ffd36a'; if (Math.sin(t * 2 + px) > 0.6) ctx.fillRect(px + ((t * 20 + px) % 14), py + 5, 2, 1);
    if (Math.random() < 0.02) Parts.embers(px + 8, py + 2);
  }
}
