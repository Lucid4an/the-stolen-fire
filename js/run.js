'use strict';
// One escape attempt: the chamber sequence, rewards, boons and run-long stats.
const COMBAT_ROOMS = ['pit', 'lavabridge', 'shaft', 'cavern', 'altar'];

class Run {
  constructor() {
    const S = Save.data;
    this.weapon = S.weapon || 'blade';
    this.maxHp = 100 + 20 * this.rank('hp');
    this.hp = this.maxHp;
    this.flame = this.upgrade('flame') ? 100 : 35;
    this.dmgMult = 1 + 0.08 * this.rank('dmg');
    this.dashMax = this.upgrade('dash') ? 2 : 1;
    this.boons = [];
    this.depth = 0; this.kills = 0; this.ichor = 0; this.time = 0;
    this.heartUsed = false; this.aegisUsed = false;
    const c = shuffle(COMBAT_ROOMS);
    this.plan = [c[0], c[1], c[2], 'rest', c[3], c[4], pick(COMBAT_ROOMS), 'roost'];
    this.pending = null; // reward promised by the door we took
  }
  rank(id) { return Save.data.upgrades[id] || 0; }
  upgrade(id) { return this.rank(id) > 0; }
  has(id) { return this.boons.includes(id); }
  get hpScale() { return 1 + this.depth * 0.09; }
  get dmgScale() { return 1 + this.depth * 0.06; }
  get roomKey() { return this.plan[this.depth]; }
  get isLast() { return this.depth >= this.plan.length - 1; }

  addBoon(id) {
    this.boons.push(id);
    if (id === 'a_endure') { this.maxHp += 30; this.hp += 30; }
  }

  // What each exit offers. Boons carry the Titan who offers them.
  rollRewards(n) {
    const kinds = [];
    for (let i = 0; i < n; i++) {
      let k = pick(['boon', 'boon', 'boon', 'ichor', 'ambrosia', 'ember', 'anvil']);
      if (this.hp > this.maxHp * 0.8 && k === 'ambrosia') k = 'ichor';
      const r = { kind: k };
      if (k === 'boon') {
        const titans = Object.keys(TITANS).filter((t) => BOONS.some((b) => b.titan === t && !this.has(b.id)));
        if (!titans.length) { r.kind = 'ichor'; } else r.titan = pick(titans);
      }
      kinds.push(r);
    }
    return kinds;
  }

  boonChoices(titan) {
    let pool = BOONS.filter((b) => b.titan === titan && !this.has(b.id));
    if (pool.length < 3) pool = pool.concat(shuffle(BOONS.filter((b) => b.titan !== titan && !this.has(b.id))).slice(0, 3 - pool.length));
    return shuffle(pool).slice(0, 3);
  }

  gainIchor(v) {
    v = Math.round(v * (this.has('t_foresight') ? 1.25 : 1));
    this.ichor += v; Save.data.ichor += v; Save.write();
    return v;
  }

  // Kronos: a rift that slows everything inside it.
  addRift(x, y) { G.effects.push({ kind: 'rift', x, y, r: 36, t: 2.5 }); }
  // Atlas: a ground shockwave.
  shockwave(x, y, dmg) {
    shockRing(x, y); SFX.play('heavy'); Cam.shake(3, 0.15);
    for (const e of G.enemies) if (e.alive && dist(e.cx, e.cy, x, y) < 48) G.player.dealDamage(e, dmg, { kb: 160, heavy: true });
  }
}

// ---------------------------------------------------------------- pickups and doors
class Pickup {
  constructor(x, y, reward) { this.x = x; this.y = y; this.reward = reward; this.t = 0; this.taken = false; this.vy = -120; this.baseY = y; }
  get col() { return this.reward.kind === 'boon' ? TITANS[this.reward.titan].col : REWARDS[this.reward.kind].col; }
  get label() { return this.reward.kind === 'boon' ? 'Boon of ' + TITANS[this.reward.titan].name : REWARDS[this.reward.kind].name; }
  update(dt, room, p) {
    this.t += dt;
    if (this.vy) { this.vy += 400 * dt; this.y += this.vy * dt; if (this.y >= this.baseY) { this.y = this.baseY; this.vy = 0; } }
    Light.add(this.x, this.y - 8, 60, this.col, 0.9);
    if (Math.random() < 0.2) Parts.add({ x: this.x + rand(-6, 6), y: this.y - 8, vy: -30, life: 0.8, max: 0.8, col: this.col, size: 1, grav: -10, glow: 6 });
    this.near = p.alive && Math.abs(p.cx - this.x) < 18 && Math.abs(p.y + p.h - this.y) < 30;
    if (this.near && (Input.pressed.interact || Input.pressed.up)) this.take(p);
  }
  take(p) {
    if (this.taken) return; this.taken = true;
    const r = this.reward, R = p.run;
    if (r.kind === 'boon') { SFX.play('boon'); UI.showBoons(r.titan); }
    else if (r.kind === 'ichor') { const v = R.gainIchor(irand(35, 60)); SFX.play('pickup'); UI.flash('+' + v + ' ichor'); }
    else if (r.kind === 'ambrosia') { p.heal(Math.round(R.maxHp * 0.4)); SFX.play('pickup'); UI.flash('Ambrosia. The food of the gods.'); }
    else if (r.kind === 'ember') { R.maxHp += 15; p.heal(15); SFX.play('pickup'); UI.flash('Titan’s Ember: +15 max health'); }
    else if (r.kind === 'anvil') { R.dmgMult *= 1.15; SFX.play('heavy'); UI.flash('Hephaestus’ anvil: your weapon burns 15% hotter'); }
    Parts.burst(this.x, this.y - 8, 24, [this.col, '#ffffff'], 140, 0.6, { glow: 12 });
    G.onRewardTaken();
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y - 10 + Math.sin(t * 3) * 2), k = this.reward.kind;
    drawRewardIcon(ctx, x, y, this.reward, t);
    if (this.near) drawText(ctx, Controls.prompt() + this.label, x, y - 16, '#ffffff', 1, 'center');
  }
}

function drawRewardIcon(ctx, x, y, reward, t) {
  const k = reward.kind;
  if (k === 'boon') {
    const c = TITANS[reward.titan].col;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.fillStyle = c; ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.fillStyle = c; ctx.fillRect(x - 1, y - 8 + Math.round(Math.sin(t * 5)), 2, 2);
    drawText(ctx, TITANS[reward.titan].name[0], x, y, '#1a0a06', 1, 'center');
  } else if (k === 'ichor') { ctx.fillStyle = '#2a6a8a'; ctx.fillRect(x - 3, y - 2, 6, 7); ctx.fillStyle = '#8fe8ff'; ctx.fillRect(x - 2, y - 5, 4, 9); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 3, 1, 3); }
  else if (k === 'ambrosia') { ctx.fillStyle = '#8a2a3a'; ctx.fillRect(x - 5, y - 3, 10, 7); ctx.fillStyle = '#ff7a8a'; ctx.fillRect(x - 4, y - 4, 8, 6); ctx.fillStyle = '#ffd0d8'; ctx.fillRect(x - 2, y - 3, 3, 2); }
  else if (k === 'ember') { drawFireOrb(ctx, x, y + 5, t, 1.1); }
  else if (k === 'anvil') { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 6, y, 12, 4); ctx.fillStyle = '#e0b060'; ctx.fillRect(x - 5, y - 4, 10, 4); ctx.fillRect(x - 2, y + 4, 4, 2); ctx.fillStyle = '#fff0b0'; ctx.fillRect(x - 4, y - 4, 4, 1); }
}

class Door {
  constructor(x, y, reward) { this.x = x; this.y = y; this.w = 20; this.h = 32; this.reward = reward; this.open = false; this.t = 0; }
  update(dt, p) {
    this.t += dt;
    this.near = this.open && p.alive && overlap({ x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }, p);
    if (this.open) Light.add(this.x, this.y - 18, 60, this.reward ? (this.reward.kind === 'boon' ? TITANS[this.reward.titan].col : REWARDS[this.reward.kind].col) : '#ff9a3a', 0.7);
    if (this.near && (Input.pressed.interact || Input.pressed.up)) G.takeDoor(this);
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#0a0504'; ctx.fillRect(x - 10, y - 32, 20, 32);
    ctx.fillStyle = this.open ? '#2a0e06' : '#150a08'; ctx.fillRect(x - 8, y - 30, 16, 30);
    ctx.fillStyle = '#4a2a1c'; ctx.fillRect(x - 12, y - 34, 24, 3); ctx.fillRect(x - 12, y - 34, 3, 34); ctx.fillRect(x + 9, y - 34, 3, 34);
    if (!this.open) { ctx.fillStyle = '#3a3440'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 7 + k * 4, y - 30, 2, 30); }
    else { const g = Math.sin(t * 4) * 0.2 + 0.6; ctx.globalAlpha = g; ctx.fillStyle = '#ff5a1a'; ctx.fillRect(x - 8, y - 6, 16, 6); ctx.globalAlpha = 1; }
    // reward icon and prompt are drawn in the glow layer (main.js) so they read in the dark
  }
}
