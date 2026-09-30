'use strict';
// Procedural pixel art for Prometheus, the mobs of Tartarus and the Eagle.
// Local space: origin at the feet centre, +x = facing direction, y negative = up.

const SKIN = { base: '#b8743c', dark: '#8a5028', light: '#dc9a5c', shadow: '#6a3a1c' };
const HAIR = { base: '#24140e', light: '#43261a' };

function drawFireOrb(ctx, x, y, t, size = 1) {
  x = Math.round(x); y = Math.round(y);
  const f = Math.sin(t * 18) + Math.sin(t * 31) * 0.5, h = Math.round((6 + f) * size), w = Math.round(4 * size);
  ctx.fillStyle = '#e0441a'; ctx.fillRect(x - (w >> 1) - 1, y - h + 3, w + 2, h - 2);
  ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x - (w >> 1), y - h + 1, w, h - 1); ctx.fillRect(x - 1 + (f > 0 ? 1 : 0), y - h - 1, 2, 2);
  ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - 1, y - h + 3, 2, Math.max(1, h - 4));
  ctx.fillStyle = '#fff6d0'; ctx.fillRect(x, y - 3, 1, 2);
}

// ---------------------------------------------------------------- Prometheus
function heroPose(p, t) {
  const P = { legA: 0, legB: 0, liftA: 0, liftB: 0, bob: 0, lean: 0, arm: 'ready', armAng: 0, crouch: 0, tuck: false };
  const s = p.state;
  if (s === 'dead') return P;
  if (s === 'dash') { P.lean = 3; P.legA = 4; P.legB = -3; P.liftA = 2; P.arm = 'back'; return P; }
  if (s === 'wall') { P.legA = 2; P.legB = -1; P.liftA = 4; P.liftB = 1; P.lean = -1; P.arm = 'wall'; return P; }
  if (s === 'hurt') { P.lean = -2; P.legA = -2; P.legB = 2; P.arm = 'hurt'; return P; }
  if (!p.onGround) {
    if (p.vy < -40) { P.legA = 3; P.legB = -2; P.liftA = 5; P.liftB = 2; P.tuck = true; }
    else { P.legA = 2; P.legB = -3; P.liftA = 2; P.liftB = 0; }
  } else if (Math.abs(p.vx) > 15) {
    const ph = p.anim;
    P.legA = Math.round(Math.sin(ph) * 4); P.legB = -P.legA;
    P.liftA = Math.round(Math.max(0, Math.cos(ph)) * 3); P.liftB = Math.round(Math.max(0, -Math.cos(ph)) * 3);
    P.bob = Math.abs(Math.sin(ph)) > 0.75 ? -1 : 0; P.lean = 1;
  } else P.bob = Math.sin(t * 2.2) > 0.6 ? 1 : 0;
  if (p.atk) { P.arm = 'atk'; P.armAng = p.atk.ang; P.lean = p.atk.phase === 'act' ? 2 : 0; if (p.atk.phase === 'act' && p.onGround) { P.legA = 3; P.legB = -3; } }
  if (p.castT > 0) P.arm = 'cast';
  return P;
}

function drawHero(ctx, p, t) {
  const ox = Math.round(p.x + p.w / 2), oy = Math.round(p.y + p.h), f = p.face;
  if (p.state === 'dead') return drawHeroDead(ctx, ox, oy, f, p, t);
  const P = heroPose(p, t);
  const blink = p.invuln > 0 && p.state !== 'dash' && Math.floor(t * 22) % 2 === 0;
  if (p.ghosts) for (const g of p.ghosts) { ctx.globalAlpha = g.a * 0.45; drawHeroBody(ctx, g.x, g.y, g.f, g.P, t, '#ff8a3a'); }
  ctx.globalAlpha = 1;
  if (!blink) drawHeroBody(ctx, ox, oy, f, P, t, p.flash > 0 ? '#ffffff' : null);
  return P;
}

function drawHeroBody(ctx, ox, oy, f, P, t, ov) {
  const D = painter(ctx, ox, oy, f, ov), l = P.lean, b = P.bob;
  const leg = (off, lift, near) => {
    const c = near ? SKIN.base : SKIN.dark;
    D.r(-2 + Math.round(off * 0.5), -12 + b, 4, 6, c);            // thigh
    D.r(-2 + off, -7 - lift, 3, 5, c);                            // shin
    D.r(-2 + off, -2 - lift, 5, 2, '#4a2a16');                    // sandal
    D.r(-2 + off, -5 - lift, 3, 1, '#6a3e20');                    // strap
  };
  leg(P.legB - 1, P.liftB, false);
  // chiton skirt (red ochre) and sash
  D.r(-5 + l, -15 + b, 10, 5, '#8e2e1e'); D.r(-5 + l, -11 + b, 10, 2, '#6e2016'); D.r(-4 + l, -10 + b, 2, 2, '#8e2e1e'); D.r(2 + l, -10 + b, 2, 2, '#8e2e1e');
  leg(P.legA + 1, P.liftA, true);
  // torso: bare, broad, bronze
  D.r(-5 + l, -25 + b, 10, 11, SKIN.base); D.r(-5 + l, -25 + b, 2, 11, SKIN.dark); D.r(2 + l, -24 + b, 2, 9, SKIN.light);
  D.r(-1 + l, -21 + b, 1, 5, SKIN.dark); D.r(1 + l, -21 + b, 1, 5, SKIN.dark);           // abdomen
  D.r(-5 + l, -25 + b, 10, 1, SKIN.light);
  // sash across the chest and the scar where the eagle fed
  for (let k = 0; k < 8; k++) D.r(-4 + k + l, -24 + k + b, 2, 1, '#b8401e');
  D.r(-2 + l, -20 + b, 2, 1, '#e0602a');
  D.r(-5 + l, -16 + b, 10, 1, '#4a2a16'); D.r(0 + l, -16 + b, 2, 1, '#d8a040');          // belt
  // head: wild mane, long beard, ember eye
  const hy = -34 + b + (P.tuck ? 1 : 0), hx = l;
  D.r(-4 + hx, hy - 1, 8, 4, HAIR.base); D.r(-3 + hx, hy - 2, 2, 1, HAIR.base); D.r(0 + hx, hy - 2, 3, 1, HAIR.base); D.r(-1 + hx, hy - 1, 3, 1, HAIR.light);
  D.r(-6 + hx, hy, 3, 9, HAIR.base); D.r(-7 + hx, hy + 3, 1, 4, HAIR.base); D.r(-5 + hx, hy + 8, 2, 2, HAIR.base);
  D.r(-2 + hx, hy + 2, 6, 6, SKIN.base); D.r(-3 + hx, hy + 3, 1, 3, SKIN.dark); D.r(3 + hx, hy + 5, 1, 1, SKIN.dark);
  D.r(0 + hx, hy + 4, 3, 1, '#1a0c06'); D.r(2 + hx, hy + 4, 1, 1, '#ffd070');
  D.r(-2 + hx, hy + 7, 6, 3, '#2e1a10'); D.r(-1 + hx, hy + 10, 4, 2, '#2e1a10'); D.r(0 + hx, hy + 12, 2, 1, '#2e1a10'); D.r(1 + hx, hy + 7, 2, 1, '#4a2a18');
  // arms
  const shackle = (x, y) => { D.r(x, y, 3, 2, '#7a7280'); D.r(x, y, 3, 1, '#a8a0b0'); };
  // back arm holds the stolen fire aloft (unless dashing / hurt)
  if (P.arm === 'back' || P.arm === 'hurt') { D.r(-7 + l, -23 + b, 3, 7, SKIN.dark); shackle(-7 + l, -18 + b); }
  else if (P.arm === 'wall') { D.r(-8 + l, -30 + b, 3, 8, SKIN.dark); shackle(-8 + l, -27 + b); }
  else { D.r(-8 + l, -31 + b, 3, 8, SKIN.dark); D.r(-8 + l, -33 + b, 3, 2, SKIN.base); shackle(-8 + l, -27 + b); }
  // front arm
  if (P.arm === 'atk') {
    const a = P.armAng, ex = Math.round(Math.cos(a) * 7), ey = Math.round(Math.sin(a) * 7);
    D.r(1 + l, -24 + b, 3, 4, SKIN.base); D.r(2 + l + Math.round(ex * 0.5), -23 + b + Math.round(ey * 0.5), 3, 3, SKIN.base);
    D.r(3 + l + ex, -23 + b + ey, 3, 3, SKIN.light); shackle(2 + l + Math.round(ex * 0.6), -22 + b + Math.round(ey * 0.6));
  } else if (P.arm === 'cast') { D.r(1 + l, -24 + b, 8, 3, SKIN.base); D.r(8 + l, -25 + b, 2, 4, SKIN.light); shackle(4 + l, -24 + b); }
  else if (P.arm === 'hurt') { D.r(2 + l, -26 + b, 3, 6, SKIN.base); }
  else { D.r(2 + l, -24 + b, 3, 8, SKIN.base); D.r(2 + l, -16 + b, 3, 2, SKIN.light); shackle(2 + l, -19 + b); }
  // dangling broken chain from the front shackle
  if (P.arm === 'ready') { const sw = Math.round(Math.sin(t * 6) * 1.5); for (let k = 0; k < 3; k++) D.r(3 + l - sw * k, -16 + b + k * 2, 1, 2, k % 2 ? '#5a5260' : '#8a8090'); }
}

// Where the fire orb sits (world coords), so the lighting and the renderer agree.
function heroFirePos(p, P) {
  const ox = p.x + p.w / 2, oy = p.y + p.h, f = p.face;
  if (!P) return { x: ox, y: oy - 30 };
  if (P.arm === 'back' || P.arm === 'hurt') return { x: ox - f * 6, y: oy - 16 };
  if (P.arm === 'wall') return { x: ox - f * 7, y: oy - 31 + P.bob };
  return { x: ox - f * 7, y: oy - 34 + P.bob };
}

function drawHeroDead(ctx, ox, oy, f, p, t) {
  const D = painter(ctx, ox, oy, f, null);
  D.r(-12, -5, 22, 5, SKIN.dark); D.r(-12, -5, 22, 1, SKIN.base); D.r(-4, -6, 6, 6, '#8e2e1e');
  D.r(10, -7, 6, 6, HAIR.base); D.r(9, -3, 4, 3, '#2e1a10');
  if (Math.sin(t * 5) > -0.3) { ctx.fillStyle = '#6a6070'; ctx.fillRect(ox - 2, oy - 10 - ((t * 12) % 8), 1, 1); }
}

// ---------------------------------------------------------------- fire weapons
function drawBlade(ctx, x, y, ang, f, len, hot) {
  const dx = Math.cos(ang) * f, dy = Math.sin(ang);
  for (let k = 0; k <= len; k++) {
    const px = Math.round(x + dx * k), py = Math.round(y + dy * k), edge = k > len - 3;
    ctx.fillStyle = k < 3 ? '#6a3a1a' : edge ? '#fff6d0' : hot ? '#ffd36a' : '#ff9a3a';
    ctx.fillRect(px, py, 2, 2);
    if (k > 2 && k % 2 === 0) { ctx.fillStyle = '#ff5a1a'; ctx.fillRect(px - Math.round(dy * f), py + Math.round(dx * f), 1, 1); }
  }
}
function drawSpear(ctx, x, y, ang, f, len) {
  const dx = Math.cos(ang) * f, dy = Math.sin(ang);
  for (let k = -6; k <= len; k++) {
    const px = Math.round(x + dx * k), py = Math.round(y + dy * k);
    ctx.fillStyle = k > len - 6 ? (k > len - 2 ? '#fff6d0' : '#ffb04a') : '#7a4a22'; ctx.fillRect(px, py, 2, 2);
  }
  const tx = x + dx * len, ty = y + dy * len;
  ctx.fillStyle = '#ff7a1f'; ctx.fillRect(Math.round(tx - dy * f * 2), Math.round(ty + dx * 2), 2, 2); ctx.fillRect(Math.round(tx + dy * f * 2), Math.round(ty - dx * 2), 2, 2);
}

// ---------------------------------------------------------------- mobs
const MOB_ART = {
  shade(P, e, t) {
    const hov = Math.round(Math.sin(t * 3 + e.seed) * 1), wind = e.state === 'wind', atk = e.state === 'atk';
    const robe = '#3a4658', robeD = '#28303e', robeL = '#56647a';
    for (let k = 0; k < 4; k++) P.r(-6 + k * 3, -4 + hov + (Math.sin(t * 7 + k) > 0 ? 1 : 0), 3, 4, k % 2 ? robeD : robe);
    P.r(-6, -18 + hov, 12, 15, robe); P.r(-6, -18 + hov, 3, 15, robeD); P.r(4, -17 + hov, 2, 12, robeL);
    P.r(-5, -25 + hov, 9, 8, '#8a98ac'); P.r(-6, -24 + hov, 2, 7, robe); P.r(-5, -25 + hov, 9, 2, robe);
    P.r(0, -22 + hov, 2, 2, '#0a0c12'); P.r(3, -22 + hov, 1, 2, '#0a0c12');
    P.r(0, -18 + hov, 5, 1, '#0a0c12');
    const ay = wind ? -26 : atk ? -14 : -12;
    P.r(4, ay + hov, 3, 6, '#8a98ac'); P.r(4, ay + 5 + hov, 3, 2, '#7a7280');
    e._chainFrom = { x: 5, y: ay + 6 + hov };
  },
  eaglet(P, e, t) {
    const fl = Math.sin(t * 26 + e.seed) > 0, dive = e.state === 'atk';
    const wy = dive ? -8 : fl ? -14 : -6, wh = dive ? 3 : fl ? 7 : 4;
    P.r(-11, wy, 9, wh, '#3a2618'); P.r(2, wy, 9, wh, '#3a2618'); P.r(-11, wy, 9, 1, '#6a4a2a'); P.r(2, wy, 9, 1, '#6a4a2a');
    if (wh > 4) { P.r(-11, wy + wh - 1, 2, 2, '#c08a3a'); P.r(9, wy + wh - 1, 2, 2, '#c08a3a'); }
    P.r(-4, -9, 9, 6, '#4a3020'); P.r(-4, -9, 9, 1, '#6a4a2a'); P.r(-6, -7, 2, 3, '#2a1a10');
    P.r(3, -12, 5, 5, '#e8dcc8'); P.r(7, -10, 3, 2, '#e0a030'); P.r(9, -9, 1, 1, '#a06010'); P.r(5, -11, 1, 1, '#ff2a1a');
    P.r(-2, -3, 2, 3, '#e0a030'); P.r(2, -3, 2, 3, '#e0a030');
  },
  fist(P, e, t) {
    const rise = e.rise || 0;
    if (rise <= 0) return;
    const hgt = Math.round(34 * rise), stone = '#5a4a44', stoneD = '#3e322e', stoneL = '#7a6a60';
    P.r(-9, -hgt, 18, hgt, stone); P.r(-9, -hgt, 3, hgt, stoneD); P.r(6, -hgt + 2, 3, hgt - 2, stoneL);
    if (hgt > 14) {
      for (let k = 0; k < 4; k++) { P.r(-8 + k * 4, -hgt, 3, 5, stoneL); P.r(-8 + k * 4, -hgt + 5, 3, 1, stoneD); }
      P.r(-10, -hgt + 9, 3, 7, stone);
      P.r(-3, -hgt + 12, 6, 2, '#ff5a1a'); P.r(-2, -hgt + 16, 4, 1, '#b83a14');
    }
    for (let k = 0; k < 3; k++) P.r(-7 + k * 6, -Math.max(2, hgt - 20), 2, 1, '#2a201c');
  },
  warden(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2), bronze = '#a8763a', bronzeD = '#7a5428', bronzeL = '#e0b060', slam = e.state === 'wind' ? 3 : 0;
    P.r(-5 + la, -12, 4, 12, bronzeD); P.r(1 - la, -12, 4, 12, bronze); P.r(-6 + la, -2, 6, 2, '#3a2a18'); P.r(0 - la, -2, 6, 2, '#3a2a18');
    P.r(-8, -30 + slam, 16, 19, bronze); P.r(-8, -30 + slam, 4, 19, bronzeD); P.r(5, -29 + slam, 3, 16, bronzeL);
    for (let k = 0; k < 3; k++) P.r(-6 + k * 5, -24 + slam, 3, 1, '#5a3a18');
    P.r(-2, -22 + slam, 4, 4, '#2a1a0c'); P.r(-1, -21 + slam, 2, 2, e.state === 'wind' ? '#ffffff' : '#6af0ff');
    P.r(-6, -39 + slam, 12, 10, bronze); P.r(-6, -39 + slam, 12, 2, bronzeL); P.r(-1, -35 + slam, 7, 2, '#0a0806'); P.r(1, -35 + slam, 4, 1, '#6af0ff');
    P.r(-7, -43 + slam, 3, 4, '#b3353d'); P.r(-4, -44 + slam, 6, 5, '#b3353d');
    // round shield on the front arm
    const sx = e.state === 'atk' ? 12 : 8;
    P.r(sx, -33 + slam, 5, 20, '#8a5a24'); P.r(sx + 1, -35 + slam, 3, 24, '#c08a3a'); P.r(sx + 1, -26 + slam, 3, 6, '#f0c870'); P.r(sx + 2, -24 + slam, 1, 2, '#fff0b0');
  },
  lampad(P, e, t) {
    const hov = Math.round(Math.sin(t * 2.6 + e.seed) * 2), flee = e.state === 'flee';
    P.r(-4, -18 + hov, 8, 14, '#e8dcd8'); P.r(-4, -18 + hov, 2, 14, '#b8aaa8');
    for (let k = -4; k < 4; k += 2) P.r(k, -4 + hov + (Math.sin(t * 9 + k) > 0 ? 1 : 0), 2, 3, '#b8aaa8');
    P.r(-3, -25 + hov, 7, 7, '#f0e4dc'); P.r(1, -22 + hov, 1, 1, '#2a0a0a'); P.r(3, -22 + hov, 1, 1, '#2a0a0a');
    P.r(-5, -27 + hov, 3, 6, '#ff7a2a'); P.r(-4, -29 + hov, 5, 3, '#ffb04a'); P.r(-6, -24 + hov, 2, 4, '#e04a1a');
    P.r(flee ? -8 : 5, -18 + hov, 2, 10, '#6a3a1a');
    e._torch = { x: flee ? -7 : 6, y: -19 + hov };
  },
};

function drawMob(ctx, e, t) {
  const ox = Math.round(e.x + e.w / 2), oy = Math.round(e.y + e.h), f = e.face;
  const ov = e.flash > 0 ? '#ffffff' : null;
  const draw = (o) => MOB_ART[e.art](painter(ctx, ox, oy, f, o), e, t);
  if (e.state === 'wind' && e.art !== 'fist') {
    // telegraph: flashing outline
    const col = Math.floor(t * 18) % 2 ? '#ff5a1a' : '#ffd36a';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) MOB_ART[e.art](painter(ctx, ox + dx, oy + dy, f, col), e, t);
  }
  draw(ov);
  if (e.art === 'shade' && e._chainFrom && e.state !== 'dead') {
    // the shade's chain drags on the ground behind it, or whips forward when attacking
    const cx = f > 0 ? ox + e._chainFrom.x : ox - e._chainFrom.x - 1, cy = oy + e._chainFrom.y;
    if (e.state === 'atk') { for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? '#5a5260' : '#9a90a0'; ctx.fillRect(cx + f * k * 3, cy - 2 + Math.round(Math.sin(k) * 1), 2, 2); } }
    else { for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#5a5260' : '#8a8090'; ctx.fillRect(cx - f * k * 3, Math.min(oy - 1, cy + k * 2), 2, 2); } }
  }
  if (e.art === 'lampad' && e._torch && e.state !== 'dead') drawFireOrb(ctx, f > 0 ? ox + e._torch.x : ox - e._torch.x - 1, oy + e._torch.y, t + e.seed, 0.8);
}

// Glowing eyes are drawn after the darkness so enemies can be spotted in the dark.
function drawMobEyes(ctx, e, t) {
  if (e.state === 'dead' || e.dying) return;
  const ox = Math.round(e.x + e.w / 2), oy = Math.round(e.y + e.h), f = e.face;
  const eye = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(f > 0 ? ox + x : ox - x - 1, oy + y, 1, 1); };
  if (e.type === 'eagle') { const c = e.enraged ? '#ff2a1a' : '#ff8a1a'; eye(16, -65, c); eye(17, -65, c); eye(17, -64, '#ffd36a'); }
  else if (e.art === 'shade') { const hov = Math.round(Math.sin(t * 3 + e.seed)); eye(1, -22 + hov, '#bfe8ff'); eye(3, -22 + hov, '#bfe8ff'); }
  else if (e.art === 'eaglet') eye(5, -11, '#ff3a1a');
  else if (e.art === 'warden') { const s = e.state === 'wind' ? 3 : 0; eye(1, -35 + s, '#6af0ff'); eye(3, -35 + s, '#6af0ff'); eye(4, -35 + s, '#6af0ff'); }
  else if (e.art === 'fist' && e.rise > 0.4) { const hgt = Math.round(34 * e.rise); eye(-2, -hgt + 12, '#ffb04a'); eye(1, -hgt + 12, '#ffb04a'); }
}

// ---------------------------------------------------------------- the Eagle (Aethon)
// Drawn at native resolution, about 120 px from wingtip to wingtip, so it dwarfs the hero.
const EAGLE_COL = { dk: '#1a0e08', br: '#3a2212', md: '#5a361c', lt: '#8a5a30', bz: '#c0843a', bzl: '#f0c070', wh: '#f2e8d6', whs: '#c8b89c', gold: '#e0a030', goldd: '#8a5a10' };
function drawEagle(ctx, e, t) {
  const ox = Math.round(e.x + e.w / 2), oy = Math.round(e.y + e.h), f = e.face, C = EAGLE_COL;
  const D = painter(ctx, ox, oy, f, e.flash > 0 ? '#ffffff' : null);
  const st = e.state, grounded = st === 'perch' || st === 'stuck';
  const flap = grounded ? -0.55 : st === 'dive' ? 0.95 : st === 'wind' && e.move === 'dive' ? 0.7 : Math.sin(t * (st === 'swoop' ? 20 : 8) + e.seed);
  // wings: a row of feather columns from each shoulder out to the tip
  for (const side of [-1, 1]) {
    const N = 13;
    for (let k = 0; k < N; k++) {
      const u = (k + 0.5) / N, x = side < 0 ? -12 - k * 4 : 8 + k * 4;
      const cy = -46 - flap * 34 * Math.pow(u, 1.25) - 9 * Math.sin(Math.min(1, u * 1.5) * Math.PI) * (grounded ? 0.3 : 1), thick = Math.round(12 - 6 * u), top = Math.round(cy - thick / 2);
      const flen = Math.round(7 + 13 * u * u) - (grounded ? 4 : 0);
      D.r(x, top, 4, thick, C.md); D.r(x, top, 4, 2, C.bz); D.r(x, top + 2, 4, 1, C.lt);
      if (k % 3 === 1) D.r(x + 1, top + 4, 2, 1, C.bzl);
      D.r(x, top + thick, 3, flen, k % 2 ? C.dk : C.br); D.r(x + 3, top + thick, 1, flen - 2, C.dk);
      if (k >= N - 3) D.r(x, top + thick + flen - 2, 3, 2, C.bz);
    }
  }
  // tail fan behind the body
  D.r(-24, -32, 14, 7, C.br); D.r(-30, -30, 8, 6, C.dk); D.r(-32, -28, 4, 4, C.br); D.r(-32, -26, 12, 2, C.bz);
  // body
  D.r(-10, -54, 20, 2, C.br); D.r(-13, -52, 26, 32, C.br); D.r(-15, -48, 2, 24, C.br); D.r(13, -48, 2, 24, C.br); D.r(-10, -20, 20, 3, C.br);
  D.r(-13, -52, 26, 3, C.bz); D.r(-13, -49, 4, 26, C.dk);
  D.r(-6, -46, 16, 22, C.md);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) D.r(-5 + c * 4 + (r % 2) * 2, -44 + r * 5, 2, 1, C.lt);
  // feathered legs, a golden cuff for the master it serves, and the talons
  const tal = st === 'swoop' || st === 'dive' ? 5 : 0;
  D.r(-9, -22, 7, 9, C.md); D.r(3, -22, 7, 9, C.md); D.r(-9, -14, 7, 2, '#ffe070'); D.r(3, -14, 7, 2, '#ffe070');
  D.r(-7, -12 + tal, 3, 9, C.gold); D.r(5, -12 + tal, 3, 9, C.gold);
  D.r(-10, -4 + tal, 9, 2, C.goldd); D.r(-11, -3 + tal, 1, 3, C.dk); D.r(-1, -3 + tal, 1, 2, C.dk);
  D.r(2, -4 + tal, 9, 2, C.goldd); D.r(11, -3 + tal, 1, 3, C.dk); D.r(1, -3 + tal, 1, 2, C.dk);
  // head, turned toward the hero: white crown, heavy brow, hooked golden beak
  D.r(4, -60, 12, 10, C.wh); D.r(4, -52, 12, 2, C.whs);
  D.r(6, -70, 16, 12, C.wh); D.r(8, -72, 12, 2, C.wh); D.r(8, -72, 10, 1, '#ffffff');
  D.r(1, -67, 5, 3, C.wh); D.r(0, -64, 4, 2, C.whs); D.r(2, -61, 3, 2, C.whs);
  D.r(14, -67, 8, 2, C.whs); D.r(15, -65, 4, 3, '#140806');
  D.r(21, -66, 3, 2, '#f0c040'); D.r(22, -66, 6, 5, C.gold); D.r(27, -64, 4, 4, C.gold); D.r(29, -61, 2, 3, C.goldd); D.r(22, -62, 6, 1, C.goldd);
  if (st === 'wind' || st === 'dying') { D.r(22, -61, 6, 2, '#3a0806'); D.r(22, -59, 5, 2, C.gold); }
  // wind-up telegraph
  if (st === 'wind') { const col = Math.floor(t * 18) % 2 ? '#ff5a1a' : '#ffd36a'; ctx.fillStyle = col; ctx.fillRect(ox - 2, oy - 92, 4, 9); ctx.fillRect(ox - 2, oy - 81, 4, 3); }
}
