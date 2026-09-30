'use strict';
// Prometheus: Dead Cells-style movement, Hades-style dash, fire weapons and the stolen fire.
const PM = {
  run: 150, accG: 1500, accA: 1000, decG: 1800, decA: 700, grav: 1150, fallMult: 1.45, maxFall: 430,
  jump: 365, jumpCut: 0.5, coyote: 0.1, buffer: 0.12, wallSlide: 70, wallJumpX: 210, wallJumpY: 340, wallLock: 0.14,
  dashSpeed: 400, dashTime: 0.16, dashCd: 0.42, castCost: 35,
};

class Player {
  constructor(run) {
    this.run = run;
    this.w = 12; this.h = 32;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1;
    this.state = 'normal'; this.stateT = 0; this.anim = 0; this.onGround = false;
    this.coyoteT = 0; this.bufferT = 9; this.wallLockT = 0; this.wallDir = 0;
    this.dashCharges = run.dashMax; this.dashCdT = 0; this.airDashes = 0; this.dashDir = 1; this.dashHits = new Set();
    this.atk = null; this.queued = false; this.comboStep = 0; this.comboT = 0;
    this.specialCdT = 0; this.castT = 0;
    this.invuln = 0; this.flash = 0; this.ghosts = []; this.ghostT = 0;
    this.dropT = 0; this.spearOut = false;
    this.lastPose = null;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get alive() { return this.state !== 'dead'; }
  get weapon() { return WEAPONS[this.run.weapon]; }

  place(x, y) { this.x = x - this.w / 2; this.y = y - this.h; this.vx = 0; this.vy = 0; this.state = 'normal'; this.atk = null; }

  update(dt, room) {
    const I = Input;
    this.stateT += dt; this.invuln = Math.max(0, this.invuln - dt); this.flash = Math.max(0, this.flash - dt);
    this.specialCdT = Math.max(0, this.specialCdT - dt); this.castT = Math.max(0, this.castT - dt);
    this.comboT = Math.max(0, this.comboT - dt); this.dropT = Math.max(0, this.dropT - dt);
    this.bufferT += dt;
    if (I.pressed.jump) this.bufferT = 0;
    // dash charges recover over time
    if (this.dashCharges < this.run.dashMax) { this.dashCdT -= dt; if (this.dashCdT <= 0) { this.dashCharges++; this.dashCdT = PM.dashCd; } }
    this.updateGhosts(dt);

    if (this.state === 'dead') { this.vx *= 0.9; this.vy = Math.min(this.vy + PM.grav * dt, PM.maxFall); room.move(this, dt); return; }
    if (this.state === 'hurt') { this.vy = Math.min(this.vy + PM.grav * dt, PM.maxFall); room.move(this, dt); if (this.stateT > 0.25) this.state = 'normal'; return; }
    if (this.state === 'dash') return this.updateDash(dt, room);

    const mx = I.mx, g = this.onGround;
    if (g) { this.coyoteT = 0; this.airDashes = 0; } else this.coyoteT += dt;

    // --- horizontal
    const attacking = this.atk && this.atk.phase !== 'rec';
    this.wallLockT -= dt;
    if (this.wallLockT <= 0) {
      const top = attacking ? (g ? 0 : PM.run * 0.6) : PM.run;
      const target = mx * top;
      const acc = Math.abs(target) > 1 ? (g ? PM.accG : PM.accA) : (g ? PM.decG : PM.decA);
      this.vx = approach(this.vx, target, acc * dt);
      if (mx && !this.atk) this.face = mx;
    }

    // --- jumping
    const onLedge = g && room.groundUnder(this) === T_LEDGE;
    if (g && onLedge && I.down.down && this.bufferT < PM.buffer) { this.bufferT = 9; this.dropT = 0.25; this.vy = 40; }
    else if (this.bufferT < PM.buffer && this.coyoteT < PM.coyote && !attacking) {
      this.bufferT = 9; this.coyoteT = 9; this.vy = -PM.jump; SFX.play('jump');
      Parts.burst(this.cx, this.y + this.h, 5, ['#6a4a3a', '#8a6a5a'], 50, 0.3, { angle: -Math.PI / 2, spread: 1.2, grav: 100 });
      if (!I.down.jump) this.vy *= PM.jumpCut;
    } else if (!g && this.wallDir && this.bufferT < PM.buffer) {
      this.bufferT = 9; this.vx = -this.wallDir * PM.wallJumpX; this.vy = -PM.wallJumpY; this.face = -this.wallDir; this.wallLockT = PM.wallLock; SFX.play('jump');
      Parts.burst(this.cx + this.wallDir * 6, this.cy, 6, ['#6a4a3a', '#8a6a5a'], 60, 0.3);
    }
    if (I.released.jump && this.vy < 0) this.vy *= PM.jumpCut;

    // --- gravity, wall slide
    const grav = this.vy > 0 ? PM.grav * PM.fallMult : PM.grav;
    this.vy = Math.min(this.vy + grav * dt, PM.maxFall);
    this.wallDir = 0;
    if (!g && this.vy > 0 && mx !== 0 && !this.atk) {
      const probe = mx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (room.solidAt(probe, this.y + 6) && room.solidAt(probe, this.y + this.h - 6)) { this.wallDir = mx; this.vy = Math.min(this.vy, PM.wallSlide); this.face = mx; }
    }

    room.move(this, dt, { dropThrough: this.dropT > 0 });
    if (this.onGround && room.groundUnder(this) === T_LAVA) {
      this.vy = -360; this.onGround = false; Parts.burst(this.cx, this.y + this.h, 14, ['#ffd36a', '#ff7a1f'], 120, 0.5, { glow: 12 });
      this.takeHit(14, this.cx, 'lava', true);
    }

    // --- actions
    if (I.pressed.dash && this.dashCharges > 0 && (g || this.airDashes < this.run.dashMax)) return this.startDash(mx);
    if (I.pressed.cast) this.tryCast();
    if (I.pressed.special && this.specialCdT <= 0 && !this.atk) this.startAttack(this.weapon.specialStep, true);
    if (I.pressed.attack) { if (!this.atk) this.startAttack(this.nextComboStep(), false); else this.queued = true; }
    this.updateAttack(dt);

    this.state = this.wallDir ? 'wall' : 'normal';
    if (g && Math.abs(this.vx) > 15) this.anim += dt * Math.abs(this.vx) / 11;
  }

  // ---------------------------------------------------------------- dash
  startDash(mx) {
    this.state = 'dash'; this.stateT = 0; this.dashDir = mx || this.face; this.face = this.dashDir;
    this.dashCharges--; if (this.dashCdT <= 0) this.dashCdT = PM.dashCd;
    if (!this.onGround) this.airDashes++;
    this.atk = null; this.vy = 0; this.dashHits.clear();
    SFX.play('dash');
    if (this.run.has('k_instant')) this.run.addRift(this.cx, this.cy);
  }
  updateDash(dt, room) {
    this.vx = this.dashDir * PM.dashSpeed; this.vy = 0;
    room.move(this, dt);
    this.ghostT -= dt; if (this.ghostT <= 0) { this.ghostT = 0.03; this.ghosts.push({ x: Math.round(this.cx), y: Math.round(this.y + this.h), f: this.face, P: heroPose(this, 0), a: 1 }); }
    if (this.run.has('h_step')) for (const e of G.enemies) if (e.alive && !this.dashHits.has(e) && overlap(this, e.hurtbox())) { this.dashHits.add(e); this.dealDamage(e, 10, { kb: 0, hexOnly: true }); e.hex = 3; }
    if (this.stateT >= PM.dashTime) {
      this.state = 'normal'; this.vx = this.dashDir * PM.run * 0.8;
      if (this.run.has('a_earth')) this.run.shockwave(this.cx, this.y + this.h - 4, 18);
    }
  }
  updateGhosts(dt) { for (const g of this.ghosts) g.a -= dt * 5; this.ghosts = this.ghosts.filter((g) => g.a > 0); }

  // ---------------------------------------------------------------- attacks
  nextComboStep() {
    const c = this.weapon.combo;
    this.comboStep = this.comboT > 0 ? (this.comboStep + 1) % c.length : 0;
    return c[this.comboStep];
  }
  startAttack(step, special) {
    if (special && step.throwSpear && this.spearOut) { SFX.play('deny'); return; }
    this.atk = { step, special, phase: 'wind', t: 0, hit: new Set(), ang: step.arc ? step.arc[0] : 0, final: !special && this.comboStep === this.weapon.combo.length - 1 };
    this.queued = false;
    if (Input.mx) this.face = Input.mx;
    if (special) this.specialCdT = this.weapon.specialCd;
  }
  updateAttack(dt) {
    const a = this.atk; if (!a) return;
    a.t += dt; const s = a.step;
    if (a.phase === 'wind') {
      a.ang = s.arc ? s.arc[0] : 0;
      if (a.t >= s.w) {
        a.phase = 'act'; a.t = 0; SFX.play(s.sfx || 'swing');
        if (s.lunge && this.onGround) this.vx = this.face * s.lunge;
        if (s.rise) { this.vy = -s.rise; this.onGround = false; }
        if (s.throwSpear) { this.spearOut = true; G.projectiles.push(new SpearProj(this, this.dmgFor(s.dmg, true))); }
      }
    } else if (a.phase === 'act') {
      const k = clamp(a.t / s.a, 0, 1);
      a.ang = s.arc ? lerp(s.arc[0], s.arc[1], easeOut(k)) : 0;
      if (!s.throwSpear) this.hitboxHits(a);
      if (a.t >= s.a) { a.phase = 'rec'; a.t = 0; }
    } else if (a.t >= s.r || (this.queued && a.t >= s.r * 0.35 && !a.special)) {
      const q = this.queued && !a.special; this.atk = null; this.comboT = 0.4;
      if (q) this.startAttack(this.nextComboStep(), false);
    }
  }
  attackBox(s) {
    const ox = this.cx, top = this.y, f = this.face;
    if (s.thrust) return { x: f > 0 ? ox : ox - s.reach, y: top + 8, w: s.reach, h: 12 };
    return { x: f > 0 ? ox - 4 : ox - s.reach + 4, y: top - (s.launch ? 12 : 4), w: s.reach, h: this.h + (s.launch ? 12 : 4) };
  }
  hitboxHits(a) {
    const box = this.attackBox(a.step);
    for (const e of G.enemies) {
      if (!e.alive || a.hit.has(e) || !overlap(box, e.hurtbox())) continue;
      a.hit.add(e);
      const s = a.step;
      let kb = s.kb * (this.run.has('a_shoulders') ? 1.6 : 1);
      const stun = this.run.has('a_shoulders') && (a.final || a.special) ? 0.6 : 0;
      const dealt = this.dealDamage(e, this.dmgFor(s.dmg, a.special), { kb, launch: s.launch || 0, stun, heavy: a.final || a.special });
      if (a.special && this.run.has('t_law') && dealt) this.heal(4);
      if (s.shake) Cam.shake(s.shake, 0.18);
    }
  }
  dmgFor(base, special) {
    let d = base * this.run.dmgMult;
    if (special && this.run.has('a_sky')) d *= 1.6;
    return d;
  }
  // Applies boons, crits and statuses. Returns true if it hit.
  dealDamage(e, dmg, o = {}) {
    const R = this.run;
    if (R.has('k_patience') && (e.slow > 0 || e.frozen > 0)) dmg *= 1.3;
    if (e.hex > 0) dmg *= 1.3;
    let crit = false;
    if (R.has('t_scales') && Math.random() < 0.2) { crit = true; dmg *= 3; }
    const res = e.hurt(dmg, { dir: sign(e.cx - this.cx) || this.face, kb: o.kb || 0, launch: o.launch || 0, stun: o.stun || 0, crit, heavy: o.heavy });
    if (!res) return false;
    if (!o.hexOnly) {
      if (R.has('k_hours')) e.slow = 2;
      if (R.has('h_curse')) e.hex = 3;
    }
    if (R.has('h_faces') && !o.echo && Math.random() < 0.2) setTimeout(() => { if (e.alive) this.dealDamage(e, dmg * 0.6, { echo: true }); }, 90);
    this.gainFlame(3);
    G.hitstop = Math.max(G.hitstop, crit ? 0.08 : o.heavy ? 0.06 : 0.035);
    return true;
  }

  // ---------------------------------------------------------------- the stolen fire
  gainFlame(v) { this.run.flame = Math.min(100, this.run.flame + v * (this.run.upgrade('flame') ? 1.25 : 1)); }
  tryCast() {
    if (this.run.flame < PM.castCost) { SFX.play('deny'); UI.flash('Not enough flame. Kill foes to feed the fire.'); return; }
    this.run.flame -= PM.castCost; this.castT = 0.25;
    G.projectiles.push(new FireBolt(this.cx + this.face * 8, this.y + 10, this.face, this.dmgFor(28), this.run));
    SFX.play('cast'); Cam.shake(1.5, 0.1);
  }

  heal(v) {
    const before = this.run.hp; this.run.hp = Math.min(this.run.maxHp, this.run.hp + v);
    if (this.run.hp > before) Nums.add(this.cx, this.y - 4, '+' + Math.round(this.run.hp - before), '#7aff9a');
  }

  takeHit(dmg, fromX, killer, ignoreInvuln = false) {
    if (!this.alive || G.mode !== 'play') return false;
    if (!ignoreInvuln && (this.invuln > 0 || this.state === 'dash')) return false;
    if (this.run.has('t_aegis') && !this.run.aegisUsed) {
      this.run.aegisUsed = true; this.invuln = 0.6; SFX.play('block');
      Parts.burst(this.cx, this.cy, 16, ['#fff0b0', '#ffe070'], 120, 0.4, { glow: 10 }); Nums.add(this.cx, this.y - 4, 'BLOCKED', '#fff0b0');
      return false;
    }
    dmg = Math.round(dmg); this.run.hp -= dmg; this.flash = 0.08;
    Nums.add(this.cx, this.y - 4, dmg, '#ff5a5a', true);
    SFX.play('hurt'); Cam.shake(4, 0.22); G.hitstop = Math.max(G.hitstop, 0.07); G.hurtFlash = 0.3;
    Parts.burst(this.cx, this.cy, 12, ['#ff5a3a', '#8a1a0a', '#ffd36a'], 110, 0.4);
    if (this.run.hp <= 0) {
      if (this.run.upgrade('heart') && !this.run.heartUsed) {
        this.run.heartUsed = true; this.run.hp = Math.round(this.run.maxHp / 2); this.invuln = 1.5;
        UI.flash('Your heart regrows.'); SFX.play('boon'); Parts.burst(this.cx, this.cy, 30, ['#ff5a7a', '#ffd0d8'], 140, 0.8, { glow: 16 });
        return true;
      }
      this.run.hp = 0; this.state = 'dead'; this.stateT = 0; this.vy = -200; this.atk = null;
      G.onPlayerDeath(killer); return true;
    }
    this.state = 'hurt'; this.stateT = 0; this.atk = null; this.invuln = 0.9;
    this.vx = (sign(this.cx - fromX) || -this.face) * 170; this.vy = -180;
    return true;
  }
}

// ---------------------------------------------------------------- player projectiles
class FireBolt {
  constructor(x, y, f, dmg, run) { this.x = x; this.y = y; this.vx = f * 320; this.f = f; this.dmg = dmg; this.run = run; this.life = 1.2; this.dead = false; }
  update(dt, room) {
    this.x += this.vx * dt; this.life -= dt;
    Parts.embers(this.x, this.y, 1);
    Light.add(this.x, this.y, 70, 'rgba(255,140,40,1)', 0.9);
    if (room.solidAt(this.x, this.y) || this.life <= 0) return this.burst();
    for (const e of G.enemies) if (e.alive && overlap({ x: this.x - 4, y: this.y - 4, w: 8, h: 8 }, e.hurtbox())) {
      G.player.dealDamage(e, this.dmg, { kb: 150, heavy: true });
      e.burn = 3;
      if (this.run.has('k_devour')) e.frozen = 1.5;
      return this.burst(e);
    }
  }
  burst(target) {
    if (this.dead) return; this.dead = true;
    SFX.play('boom'); Cam.shake(3, 0.2);
    Parts.burst(this.x, this.y, 24, ['#ffd36a', '#ff7a1f', '#e0441a'], 150, 0.5, { glow: 14 });
    if (this.run.has('h_moon')) {
      for (const e of G.enemies) if (e.alive && e !== target && dist(e.cx, e.cy, this.x, this.y) < 60) { G.player.dealDamage(e, this.dmg * 0.5, { kb: 80 }); e.hex = 3; e.burn = 3; }
      Parts.burst(this.x, this.y, 20, ['#c07af0', '#e8c0ff'], 170, 0.5, { glow: 12 });
    }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#e0441a'; ctx.fillRect(x - 5 * this.f, y - 2, 6, 4);
    ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#fff6d0'; ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

class SpearProj {
  constructor(p, dmg) { this.p = p; this.x = p.cx; this.y = p.y + 14; this.f = p.face; this.vx = this.f * 380; this.t = 0; this.back = false; this.dmg = dmg; this.hit = new Set(); this.dead = false; }
  update(dt, room) {
    this.t += dt;
    if (!this.back) { this.x += this.vx * dt; if (this.t > 0.45 || room.solidAt(this.x + this.f * 6, this.y)) { this.back = true; this.hit.clear(); } }
    else {
      const dx = this.p.cx - this.x, dy = this.p.y + 14 - this.y, d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * 460 * dt; this.y += dy / d * 460 * dt;
      if (d < 12) { this.dead = true; this.p.spearOut = false; SFX.play('pickup'); }
    }
    Light.add(this.x, this.y, 50, 'rgba(255,150,50,1)', 0.7);
    for (const e of G.enemies) if (e.alive && !this.hit.has(e) && overlap({ x: this.x - 8, y: this.y - 4, w: 16, h: 8 }, e.hurtbox())) {
      this.hit.add(e); G.player.dealDamage(e, this.dmg, { kb: 120, heavy: true });
      if (G.player.run.has('t_law')) G.player.heal(4);
    }
  }
  draw(ctx) { drawSpear(ctx, this.x - this.f * 20, this.y, 0, this.back ? -this.f : this.f, 30); }
}
