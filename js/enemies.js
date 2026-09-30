'use strict';
// Mobs of Tartarus and the Eagle. Every attack has a readable wind-up (outline flash) before it lands.
const MOBS = {
  shade: { name: 'Chained Shade', hp: 42, dmg: 12, w: 12, h: 26, speed: 52, fly: false },
  eaglet: { name: 'Eaglet', hp: 26, dmg: 9, w: 14, h: 10, speed: 90, fly: true },
  fist: { name: 'Hundred-Handed Fist', hp: 60, dmg: 18, w: 18, h: 34, speed: 0, fly: false },
  warden: { name: 'Bronze Warden', hp: 110, dmg: 20, w: 16, h: 40, speed: 34, fly: false },
  lampad: { name: 'Lampad', hp: 30, dmg: 10, w: 10, h: 26, speed: 70, fly: true },
};

class Mob {
  constructor(type, x, y) {
    const d = MOBS[type];
    this.type = type; this.art = type; this.name = d.name;
    this.w = d.w; this.h = d.h; this.x = x - d.w / 2; this.y = y - d.h;
    this.maxHp = Math.round(d.hp * G.run.hpScale); this.hp = this.maxHp;
    this.dmg = d.dmg; this.speed = d.speed; this.fly = d.fly;
    this.vx = 0; this.vy = 0; this.face = -1; this.state = 'idle'; this.stateT = rand(0, 0.6); this.anim = 0;
    this.flash = 0; this.slow = 0; this.frozen = 0; this.hex = 0; this.burn = 0; this.burnT = 0; this.stun = 0;
    this.seed = Math.random() * 10; this.spawnT = 0.5; this.alertT = 0; this.cool = rand(0.5, 1.5);
    this.dying = false; this.onGround = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get alive() { return !this.dying && this.hp > 0; }
  hurtbox() { return this; }
  set(state, t = 0) { this.state = state; this.stateT = 0; this.stateDur = t; }
  get speedMul() { return this.frozen > 0 ? 0 : this.slow > 0 ? 0.5 : 1; }

  hurt(dmg, o) {
    if (!this.alive) return false;
    if (this.type === 'warden' && !o.heavy && !o.crit && o.dir === -this.face && this.state !== 'stun') {
      // shield blocks frontal hits
      dmg *= 0.2; SFX.play('block'); Parts.burst(this.cx + this.face * 10, this.cy, 6, ['#ffe070', '#fff'], 90, 0.2);
      Nums.add(this.cx, this.y - 6, 'BLOCK', '#e0c070'); this.flash = 0.05;
    } else {
      this.flash = 0.08;
      if (this.type !== 'fist') {
        const kb = this.type === 'warden' ? o.kb * 0.35 : o.kb;
        this.vx = o.dir * kb; if (o.launch && !this.fly) this.vy = -o.launch; if (this.fly) this.vy = -o.kb * 0.3;
        if (this.state === 'wind' && this.type !== 'warden') this.set('rec', 0.35);
        if (o.stun) { this.stun = o.stun; this.set('stun'); }
      }
    }
    this.hp -= dmg;
    Nums.add(this.cx, this.y - 4, Math.max(1, Math.round(dmg)), o.crit ? '#ffd36a' : '#ffffff', o.crit);
    SFX.play(o.crit ? 'crit' : 'hit');
    Parts.burst(this.cx, this.cy, o.crit ? 14 : 7, ['#ffd36a', '#ff7a1f', '#ffffff'], 130, 0.3, { glow: 8 });
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.dying = true; this.hp = 0; SFX.play('kill'); Cam.shake(2.5, 0.15);
    const cols = this.type === 'shade' ? ['#8a98ac', '#56647a', '#bfe8ff'] : this.type === 'warden' ? ['#a8763a', '#e0b060', '#6af0ff'] :
      this.type === 'eaglet' ? ['#4a3020', '#e8dcc8', '#e0a030'] : this.type === 'fist' ? ['#5a4a44', '#7a6a60', '#ff5a1a'] : ['#e8dcd8', '#ff7a2a'];
    Parts.burst(this.cx, this.cy, 26, cols, 170, 0.8, { grav: 380 });
    G.onKill(this);
  }

  update(dt, room, p) {
    this.flash = Math.max(0, this.flash - dt); this.spawnT = Math.max(0, this.spawnT - dt);
    this.slow = Math.max(0, this.slow - dt); this.frozen = Math.max(0, this.frozen - dt); this.hex = Math.max(0, this.hex - dt); this.alertT = Math.max(0, this.alertT - dt);
    if (this.burn > 0) { this.burn -= dt; this.burnT -= dt; if (this.burnT <= 0) { this.burnT = 0.5; this.hp -= 3; Nums.add(this.cx, this.y - 2, 3, '#ff9a3a'); if (this.hp <= 0) this.die(); } if (Math.random() < 0.3) Parts.embers(this.cx, this.y + 4); }
    if (!this.alive) return;
    const sdt = dt * this.speedMul;
    this.stateT += sdt; this.anim += sdt * 6;
    if (this.state === 'stun') { this.stun -= dt; this.vx *= 0.9; if (this.stun <= 0) this.set('chase'); }
    else if (this.spawnT <= 0) AI[this.type](this, sdt, room, p);
    if (!this.fly) { this.vy = Math.min(this.vy + PM.grav * dt, PM.maxFall); room.move(this, dt); if (this.onGround && this.state !== 'patrol' && this.state !== 'chase') this.vx *= Math.pow(0.001, dt); }
    else { this.x += this.vx * dt; this.y += this.vy * dt; this.x = clamp(this.x, TS, room.pw - TS - this.w); this.y = clamp(this.y, TS, room.ph - TS * 3 - this.h); }
    if (this.frozen > 0) { this.vx = 0; if (!this.fly) this.vy = Math.max(this.vy, 0); else this.vy = 0; }
  }

  // Frontal hitbox used by melee attacks.
  strike(p, reach, h, yOff = 0) {
    const box = { x: this.face > 0 ? this.cx : this.cx - reach, y: this.y + yOff, w: reach, h };
    if (overlap(box, p)) p.takeHit(this.dmg * G.run.dmgScale, this.cx, this.type);
  }
}

// Returns the y of the ground below (x, y) in pixels.
function groundY(room, x, y) { for (let yy = Math.max(0, y); yy < room.ph; yy += 4) if (room.solidAt(x, yy) || room.at(Math.floor(x / TS), Math.floor(yy / TS)) === T_LEDGE) return Math.floor(yy / TS) * TS; return room.ph - TS * 2; }

const AI = {
  shade(e, dt, room, p) {
    const dx = p.cx - e.cx, dy = Math.abs(p.cy - e.cy), sees = p.alive && Math.abs(dx) < 190 && dy < 60;
    switch (e.state) {
      case 'idle': case 'patrol':
        e.state = 'patrol'; if (e.stateT > 2.5 || e.hitWall || !floorAhead(room, e)) { e.face = -e.face; e.stateT = 0; }
        e.vx = e.face * e.speed * 0.5 * e.speedMul; if (sees) { e.set('chase'); e.alertT = 0.5; }
        break;
      case 'chase':
        e.face = sign(dx) || e.face;
        e.vx = floorAhead(room, e) ? e.face * e.speed * e.speedMul : 0;
        if (Math.abs(dx) < 34 && dy < 30) e.set('wind');
        else if (!sees && e.stateT > 2) e.set('patrol');
        break;
      case 'wind': e.vx = 0; if (e.stateT > 0.55) e.set('atk'); break;
      case 'atk': if (e.stateT < 0.12) e.strike(p, 38, 18, 6); if (e.stateT > 0.28) e.set('rec'); break;
      case 'rec': e.vx = 0; if (e.stateT > 0.6) e.set('chase'); break;
    }
  },
  eaglet(e, dt, room, p) {
    const dx = p.cx - e.cx, dy = p.cy - e.cy;
    e.face = sign(dx) || e.face;
    switch (e.state) {
      case 'idle': case 'hover': {
        e.state = 'hover';
        const tx = p.cx + Math.sin(e.seed + e.stateT) * 70 - e.w / 2, ty = p.y - 60 + Math.cos(e.stateT * 2 + e.seed) * 14;
        e.vx = approach(e.vx, clamp((tx - e.x) * 2, -e.speed, e.speed), 300 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 2, -e.speed, e.speed), 300 * dt);
        e.cool -= dt;
        if (e.cool <= 0 && p.alive) { e.move = Math.random() < 0.55 ? 'dive' : 'dart'; e.set('wind'); e.vx = 0; e.vy = 0; }
        break;
      }
      case 'wind':
        e.vx *= 0.8; e.vy *= 0.8;
        if (e.stateT > (e.move === 'dive' ? 0.45 : 0.35)) {
          if (e.move === 'dive') { const d = Math.hypot(dx, dy) || 1; e.vx = dx / d * 270; e.vy = dy / d * 270; e.set('atk'); }
          else { G.enemyShots.push(new Dart(e.cx, e.cy, dx, dy, 200, e.dmg * 0.8, 'eaglet')); SFX.play('swing'); e.set('rec'); }
        }
        break;
      case 'atk':
        if (overlap(e, p)) p.takeHit(e.dmg * G.run.dmgScale, e.cx, 'eaglet');
        if (e.stateT > 0.55) { e.set('rec'); }
        break;
      case 'rec': e.vx *= 0.9; e.vy = approach(e.vy, -60, 300 * dt); if (e.stateT > 0.7) { e.cool = rand(1.6, 2.8); e.set('hover'); } break;
    }
  },
  fist(e, dt, room, p) {
    // Hidden underground; marks the ground under the hero, then erupts.
    switch (e.state) {
      case 'idle': case 'hidden':
        e.state = 'hidden'; e.rise = 0;
        if (e.stateT > (e.first ? 1.2 : 0.4) && p.alive) {
          e.first = true;
          const gx = clamp(p.cx, TS * 2, room.pw - TS * 2), gy = groundY(room, gx, p.y + p.h - 4);
          e.x = gx - e.w / 2; e.y = gy - e.h; e.set('wind');
        }
        break;
      case 'wind':
        if (Math.random() < 0.6) Parts.add({ x: e.cx + rand(-10, 10), y: e.y + e.h - 1, vx: rand(-20, 20), vy: rand(-70, -30), life: 0.4, max: 0.4, col: pick(['#ff5a1a', '#ffd36a', '#6a4a3a']), size: 2, grav: 300, glow: 8 });
        if (e.stateT > 0.8) { e.set('atk'); SFX.play('boom'); Cam.shake(4, 0.2); }
        break;
      case 'atk':
        e.rise = clamp(e.stateT / 0.12, 0, 1);
        if (e.stateT < 0.14 && overlap({ x: e.x - 2, y: e.y, w: e.w + 4, h: e.h }, p)) { p.takeHit(e.dmg * G.run.dmgScale, e.cx, 'fist'); p.vy = -300; }
        if (e.stateT > 0.14) e.set('up');
        break;
      case 'up': e.rise = 1; if (e.stateT > 1.5) e.set('sink'); break;
      case 'sink': e.rise = 1 - clamp(e.stateT / 0.3, 0, 1); if (e.stateT > 0.3) e.set('hidden'); break;
    }
  },
  warden(e, dt, room, p) {
    const dx = p.cx - e.cx, dy = Math.abs(p.cy - e.cy), sees = p.alive && Math.abs(dx) < 220 && dy < 70;
    switch (e.state) {
      case 'idle': case 'chase':
        e.state = 'chase';
        if (sees) { e.face = sign(dx) || e.face; e.vx = floorAhead(room, e) ? e.face * e.speed * e.speedMul : 0; }
        else e.vx = 0;
        if (sees && Math.abs(dx) < 46 && dy < 34) { e.set('wind'); e.vx = 0; }
        break;
      case 'wind': e.vx = 0; if (e.stateT > 0.7) { e.set('atk'); SFX.play('boom'); Cam.shake(4, 0.2); room && shockRing(e.cx + e.face * 20, e.y + e.h); } break;
      case 'atk': if (e.stateT < 0.1) { e.strike(p, 48, 40, 0); if (Math.abs(p.cx - (e.cx + e.face * 20)) < 60 && p.onGround && Math.abs(p.y + p.h - (e.y + e.h)) < 6) p.takeHit(e.dmg * 0.5 * G.run.dmgScale, e.cx, 'warden'); } if (e.stateT > 0.2) e.set('rec'); break;
      case 'rec': e.vx = 0; if (e.stateT > 0.9) e.set('chase'); break;
    }
  },
  lampad(e, dt, room, p) {
    const dx = p.cx - e.cx, dy = p.cy - e.cy, d = Math.hypot(dx, dy);
    e.face = sign(dx) || e.face;
    switch (e.state) {
      case 'idle': case 'drift': {
        e.state = 'drift';
        const want = d < 90 ? -1 : d > 150 ? 1 : 0;
        e.vx = approach(e.vx, want * sign(dx) * e.speed + Math.sin(e.stateT * 2 + e.seed) * 20, 200 * dt);
        e.vy = approach(e.vy, clamp((p.y - 50 - e.y) * 1.5, -60, 60), 200 * dt);
        e.cool -= dt;
        if (e.cool <= 0 && p.alive) { e.set('wind'); }
        if (d < 22 && p.alive) { G.run.flame = Math.max(0, G.run.flame - 25); UI.flash('A Lampad steals your flame!'); Parts.burst(p.cx, p.y + 4, 12, ['#ff9a3a', '#ffd36a'], 90, 0.4, { glow: 10 }); e.set('flee'); }
        break;
      }
      case 'wind': e.vx *= 0.85; e.vy *= 0.85; if (e.stateT > 0.45) { G.enemyShots.push(new Fireball(e.cx, e.y + 6, dx, dy, e.dmg)); SFX.play('cast'); e.cool = rand(1.8, 2.8); e.set('drift'); } break;
      case 'flee': e.vx = -sign(dx) * 120; e.vy = -40; if (e.stateT > 1.2) e.set('drift'); break;
    }
  },
};

function floorAhead(room, e) {
  const x = e.face > 0 ? e.x + e.w + 3 : e.x - 3, y = e.y + e.h + 4;
  return room.solidAt(x, y) || room.at(Math.floor(x / TS), Math.floor(y / TS)) === T_LEDGE;
}
function shockRing(x, y) { Parts.burst(x, y - 2, 18, ['#e0b060', '#8a6a4a', '#ffd36a'], 160, 0.4, { angle: -Math.PI / 2, spread: 1.4, grav: 400 }); }

// ---------------------------------------------------------------- enemy projectiles
class Dart {
  constructor(x, y, dx, dy, speed, dmg, src) { const d = Math.hypot(dx, dy) || 1; this.x = x; this.y = y; this.vx = dx / d * speed; this.vy = dy / d * speed; this.dmg = dmg; this.src = src; this.life = 3; this.dead = false; }
  update(dt, room, p) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    if (room.solidAt(this.x, this.y) || this.life <= 0) { this.dead = true; Parts.burst(this.x, this.y, 4, '#c08a3a', 50, 0.2); return; }
    if (p.alive && overlap({ x: this.x - 3, y: this.y - 3, w: 6, h: 6 }, p)) { if (p.takeHit(this.dmg * G.run.dmgScale, this.x, this.src)) this.dead = true; }
  }
  draw(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k < 2 ? '#fff0c0' : k < 4 ? '#c08a3a' : '#4a3020'; ctx.fillRect(Math.round(this.x - Math.cos(a) * k), Math.round(this.y - Math.sin(a) * k), 2, 1); }
  }
}
class Fireball {
  constructor(x, y, dx, dy, dmg) { const d = Math.hypot(dx, dy) || 1; this.x = x; this.y = y; this.vx = dx / d * 150; this.vy = dy / d * 150 - 90; this.dmg = dmg; this.dead = false; this.life = 3; }
  update(dt, room, p) {
    this.vy += 260 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    Light.add(this.x, this.y, 46, 'rgba(255,120,40,1)', 0.8); if (Math.random() < 0.5) Parts.embers(this.x, this.y);
    if (room.solidAt(this.x, this.y) || this.life <= 0) { this.dead = true; Parts.burst(this.x, this.y, 10, ['#ffd36a', '#ff7a1f'], 90, 0.3, { glow: 8 }); return; }
    if (p.alive && overlap({ x: this.x - 4, y: this.y - 4, w: 8, h: 8 }, p)) { if (p.takeHit(this.dmg * G.run.dmgScale, this.x, 'lampad')) { this.dead = true; } }
  }
  draw(ctx) { ctx.fillStyle = '#ff7a1f'; ctx.fillRect(Math.round(this.x) - 3, Math.round(this.y) - 3, 6, 6); ctx.fillStyle = '#ffd36a'; ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 2, 3, 3); }
}

// ---------------------------------------------------------------- the Eagle (Aethon), Chapter I boss
class Eagle extends Mob {
  constructor(x, y) {
    super('eaglet', x, y);
    this.type = 'eagle'; this.name = 'Aethon, the Eagle of Zeus';
    this.w = 36; this.h = 60; this.x = x - 18; this.y = y - 60;
    this.maxHp = Math.round(900 * G.run.hpScale); this.hp = this.maxHp; this.dmg = 22; this.fly = true;
    this.state = 'perch'; this.enraged = false; this.home = { x: this.x, y: this.y }; this.nextMove = 0; this.combo = 0;
  }
  hurtbox() { return { x: this.x - 6, y: this.y - 4, w: this.w + 12, h: this.h + 4 }; }
  hurt(dmg, o) {
    if (!this.alive || this.state === 'perch' || this.state === 'dying') return false;
    this.hp -= dmg; this.flash = 0.06;
    Nums.add(this.cx, this.y - 6, Math.max(1, Math.round(dmg)), o.crit ? '#ffd36a' : '#ffffff', o.crit);
    SFX.play(o.crit ? 'crit' : 'hit'); Parts.burst(this.cx, this.cy, 8, ['#e8dcc8', '#c0843a', '#4a2c18'], 120, 0.4);
    if (!this.enraged && this.hp < this.maxHp * 0.5) this.enrage();
    if (this.hp <= 0) this.dieBoss();
    return true;
  }
  enrage() {
    this.enraged = true; SFX.play('screech'); Cam.shake(6, 0.5); UI.say('The Eagle', pick(LINES.eagle.rage), '#ffb04a');
    for (let i = 0; i < 2; i++) G.enemies.push(new Mob('eaglet', this.cx + (i ? 60 : -60), this.y));
    this.set('hover');
  }
  dieBoss() {
    this.hp = 0; this.dying = true; this.set('dying'); SFX.play('screech'); Cam.shake(8, 0.8); G.hitstop = 0.25;
    UI.say('The Eagle', LINES.eagle.death[0], '#ffb04a');
    Parts.burst(this.cx, this.cy, 60, ['#e8dcc8', '#c0843a', '#4a2c18', '#ffd36a'], 220, 1.2, { grav: 200 });
    G.onBossDeath(this);
  }
  update(dt, room, p) {
    this.flash = Math.max(0, this.flash - dt); this.slow = Math.max(0, this.slow - dt); this.frozen = Math.max(0, this.frozen - dt); this.hex = Math.max(0, this.hex - dt);
    const spd = (this.enraged ? 1.3 : 1) * (this.frozen > 0 ? 0 : this.slow > 0 ? 0.6 : 1);
    this.stateT += dt * spd;
    if (this.state === 'dying') { this.vy = Math.min(this.vy + 400 * dt, 300); this.y += this.vy * dt; this.x += Math.sin(this.stateT * 8) * 40 * dt; return; }
    if (!p.alive) { this.vx *= 0.9; this.vy *= 0.9; this.x += this.vx * dt; this.y += this.vy * dt; return; }
    const dx = p.cx - this.cx;
    switch (this.state) {
      case 'perch': this.face = sign(dx) || -1; break;
      case 'hover': {
        this.face = sign(dx) || this.face;
        // hover just above jumping height, close enough to stay on screen
        const tx = clamp(p.cx - this.face * 96, 70, room.pw - 70) - this.w / 2, ty = Math.max(TS + 8, p.y - 92) + Math.sin(this.stateT * 2) * 14;
        this.vx = approach(this.vx, clamp((tx - this.x) * 2.5, -170, 170), 500 * dt);
        this.vy = approach(this.vy, clamp((ty - this.y) * 2.5, -170, 170), 500 * dt);
        if (this.stateT > (this.enraged ? 0.9 : 1.4)) {
          const r = Math.random();
          this.move = r < 0.38 ? 'swoop' : r < 0.7 ? 'volley' : 'dive';
          this.set('wind'); this.vx = 0; this.vy = 0; this.combo = this.enraged && this.move === 'volley' ? 3 : 2;
          if (this.move === 'swoop') SFX.play('screech');
        }
        break;
      }
      case 'wind':
        this.face = sign(dx) || this.face; this.vx *= 0.85; this.vy *= 0.85;
        if (this.move === 'dive') { this.vx = clamp((p.cx - this.cx) * 4, -260, 260); this.vy = approach(this.vy, (Math.max(TS + 8, p.y - 130) - this.y) * 2, 400 * dt); }
        if (this.stateT > (this.move === 'dive' ? 0.75 : 0.55)) {
          if (this.move === 'swoop') { this.swoopDir = this.face; this.vx = this.face * 330; this.vy = 240; this.set('swoop'); }
          else if (this.move === 'volley') { this.fireVolley(p); this.combo--; this.set(this.combo > 0 ? 'wind' : 'rec'); }
          else { this.vx = 0; this.vy = 520; this.set('dive'); }
        }
        break;
      case 'swoop':
        // dive down to the hero's level, then climb out on the far side
        if (this.y + this.h > p.y + p.h - 6) this.vy = approach(this.vy, -260, 1200 * dt);
        if (overlap(this.hurtbox(), p)) p.takeHit(this.dmg * G.run.dmgScale, this.cx, 'eagle');
        if (this.stateT > 1.1 || this.x < TS || this.x + this.w > room.pw - TS) this.set('rec');
        break;
      case 'dive':
        if (overlap(this.hurtbox(), p)) p.takeHit(this.dmg * 1.2 * G.run.dmgScale, this.cx, 'eagle');
        if (room.solidAt(this.cx, this.y + this.h + 2)) {
          this.vy = 0; this.y = Math.floor((this.y + this.h + 2) / TS) * TS - this.h; SFX.play('boom'); Cam.shake(7, 0.35);
          shockRing(this.cx, this.y + this.h);
          if (p.onGround && Math.abs(p.cx - this.cx) < 70) p.takeHit(this.dmg * 0.6 * G.run.dmgScale, this.cx, 'eagle');
          this.set('stuck');
        }
        break;
      case 'stuck': this.vx = 0; this.vy = 0; if (this.stateT > (this.enraged ? 0.9 : 1.4)) { this.vy = -220; this.set('rec'); } break;
      case 'rec': this.vx *= 0.92; this.vy = approach(this.vy, -120, 500 * dt); if (this.stateT > 0.5 || this.y < p.y - 110) this.set('hover'); break;
    }
    this.x += this.vx * dt * spd; this.y += this.vy * dt * spd;
    this.x = clamp(this.x, TS, room.pw - TS - this.w); this.y = clamp(this.y, TS + 8, room.ph - TS * 2 - this.h);
  }
  fireVolley(p) {
    SFX.play('swing'); const n = this.enraged ? 7 : 5, base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.16; G.enemyShots.push(new Dart(this.cx, this.cy + 6, Math.cos(a), Math.sin(a), 230, 10, 'eagle')); }
  }
}
