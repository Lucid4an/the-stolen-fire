'use strict';
// Game flow and the frame loop.
const G = {
  mode: 'title', run: null, player: null, room: null, time: 0,
  enemies: [], projectiles: [], enemyShots: [], pickups: [], doors: [], effects: [], props: [],
  boss: null, hitstop: 0, hurtFlash: 0, waves: 0, cleared: false, deathT: 0, victoryT: 0, thunder: 0, boltT: 3,

  init() {
    Save.load(); Gfx.init(); Input.init(); UI.init(); Backdrop.build();
    $('btn-start').onclick = () => { SFX.init(); SFX.play('ui'); if (Save.data.seen.story) this.enterHub(false, true); else UI.story(() => { Save.data.seen.story = true; Save.write(); this.enterHub(false, true); }); };
    $('btn-story').onclick = () => { SFX.init(); SFX.play('ui'); UI.story(() => UI.title()); };
    $('btn-sound').onclick = () => { SFX.init(); SFX.muted = !SFX.muted; $('btn-sound').textContent = 'Sound: ' + (SFX.muted ? 'off' : 'on'); };
    $('btn-resume').onclick = () => this.resume();
    $('btn-abandon').onclick = () => { this.resume(); if (this.player && this.player.alive) { this.player.run.hp = 1; this.player.takeHit(99, this.player.cx, 'abandon', true); } };
    // a quiet scene behind the title
    this.run = new Run(); this.player = new Player(this.run); this.loadRoom('rock'); this.setupHub();
    UI.title();
    let last = performance.now();
    const frame = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; this.tick(dt); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  },

  // ---------------------------------------------------------------- rooms
  loadRoom(key) {
    this.room = new Room(key);
    this.enemies = []; this.projectiles = []; this.enemyShots = []; this.pickups = []; this.doors = []; this.effects = []; this.props = [];
    this.boss = null; this.cleared = false; this.waves = 0;
    const start = this.room.marksOf('P')[0];
    this.player.place(start.x, start.y);
    for (const b of this.room.marksOf('B')) this.props.push({ kind: 'brazier', x: b.x, y: b.y });
    Cam.x = 0; Cam.y = 0; Cam.follow(this.player.cx, this.player.cy, this.room.pw, this.room.ph, 0, true);
    if (this.run) this.run.aegisUsed = false;
  },

  newHubRun() { const w = Save.data.weapon; this.run = new Run(); this.run.weapon = w; this.player.run = this.run; this.player.dashCharges = this.run.dashMax; },

  enterHub(afterDeath, fromTitle = false) {
    this.newHubRun();
    this.loadRoom('rock'); this.setupHub();
    this.mode = 'hub'; UI.close();
    const S = Save.data, E = LINES.epimetheus;
    let lines;
    if (!S.seen.hub) { lines = E.first; S.seen.hub = true; Save.write(); }
    else if (afterDeath && S.lastKiller && E.killer[S.lastKiller] && Math.random() < 0.6) lines = [E.killer[S.lastKiller]];
    else if (!afterDeath && !fromTitle && S.eagleKills === 1 && !S.seen.eagleTalk) { lines = E.afterEagle; S.seen.eagleTalk = true; Save.write(); }
    else if (afterDeath) lines = [pick(E.afterDeath)];
    if (lines) setTimeout(() => { if (this.mode === 'hub') UI.dialogue('Epimetheus', '#8ac0ff', lines, () => { this.mode = 'hub'; }); }, 500);
  },

  setupHub() {
    const R = this.room;
    const n = R.marksOf('N')[0], w = R.marksOf('W')[0], m = R.marksOf('M')[0], d = R.marksOf('D')[0], k = R.marksOf('K')[0];
    this.props.push({ kind: 'epimetheus', x: n.x, y: n.y, label: 'Talk to Epimetheus', act: () => UI.dialogue('Epimetheus', '#8ac0ff', [this.epimetheusLine()], () => { this.mode = 'hub'; }) });
    this.props.push({ kind: 'rack', x: w.x, y: w.y, label: 'Choose your fire form', act: () => UI.showWeapons() });
    this.props.push({ kind: 'altar', x: m.x, y: m.y, label: 'Altar of the Titans', act: () => UI.showAltar() });
    this.props.push({ kind: 'anchor', x: k.x, y: k.y + 2 });
    const door = new Door(d.x, d.y, null); door.open = true; door.label = 'Escape into Tartarus'; door.hub = true; this.doors.push(door);
  },
  epimetheusLine() {
    const S = Save.data;
    if (!S.runs) return 'The door leads down into the chambers of Tartarus. The way up is through them, brother.';
    if (S.ichor >= 40 && Object.keys(S.upgrades).length < 2) return 'You carry ichor. Offer it at the altar. The Titans remember who fought Zeus.';
    return pick(LINES.epimetheus.afterDeath.concat(LINES.zeusMock));
  },

  startRun() {
    Save.data.runs++; Save.write();
    this.newHubRun(); this.run.depth = 0; this.mode = 'play';
    this.enterChamber();
    UI.say('Epimetheus', 'Go, brother. And do not lose that fire.', '#8ac0ff', 3);
  },

  enterChamber() {
    const key = this.run.roomKey;
    this.loadRoom(key);
    SFX.play('door');
    if (key === 'rest') {
      const f = this.room.marksOf('R')[0];
      this.props.push({ kind: 'fountain', x: f.x, y: f.y, label: 'Drink from the spring of Lethe', act: () => { this.player.heal(Math.round(this.run.maxHp * 0.5)); SFX.play('boon'); UI.flash('The water of Lethe dulls the pain.'); const pr = this.props.find((p) => p.kind === 'fountain'); pr.used = true; pr.label = null; } });
      this.cleared = true; this.openDoors();
      UI.say('Epimetheus', 'A quiet chamber. Rest, if Titans rest.', '#8ac0ff', 3);
    } else if (key === 'roost') {
      const x = this.room.marksOf('X')[0];
      this.boss = new Eagle(x.x, x.y); this.enemies.push(this.boss);
    } else this.spawnWave();
  },

  spawnWave() {
    const d = this.run.depth, R = this.room;
    const ground = d < 2 ? ['shade'] : d < 4 ? ['shade', 'shade', 'warden'] : ['shade', 'warden', 'warden'];
    const fly = d < 1 ? ['eaglet'] : ['eaglet', 'lampad', 'eaglet'];
    const gm = shuffle(R.marksOf('e')), fm = shuffle(R.marksOf('f'));
    const nG = Math.min(gm.length, 2 + Math.floor(d / 2)), nF = Math.min(fm.length, 1 + (d > 3 ? 1 : 0));
    for (let i = 0; i < nG; i++) this.spawn(pick(ground), gm[i].x, gm[i].y);
    for (let i = 0; i < nF; i++) this.spawn(pick(fly), fm[i].x, fm[i].y - 10);
    if (d >= 2) for (let i = 0; i < (d >= 5 ? 2 : 1); i++) { const f = new Mob('fist', 0, 0); f.set('hidden'); f.stateT = -i * 1.2; this.enemies.push(f); }
    this.waves++; this.pendingWave = false;
  },
  spawn(type, x, y) {
    const e = new Mob(type, x, y); this.enemies.push(e);
    Parts.burst(x, y - e.h / 2, 16, ['#2a0a0a', '#5a1a14', '#ff5a1a'], 70, 0.6, { grav: -40, glow: 4 });
  },

  checkClear() {
    if (this.cleared || this.mode !== 'play' || this.boss) return;
    if (this.enemies.some((e) => e.alive && e.type !== 'fist')) return;
    if (this.waves < 2 && this.run.roomKey !== 'rest') { this.enemies = this.enemies.filter((e) => e.type !== 'fist'); setTimeout(() => { if (this.mode === 'play' && !this.cleared) this.spawnWave(); }, 700); this.waves = 2; this.cleared = false; this.pendingWave = true; return; }
    if (this.pendingWave && this.enemies.length === 0) return;
    this.roomCleared();
  },
  roomCleared() {
    this.cleared = true; this.pendingWave = false;
    for (const e of this.enemies) if (e.type === 'fist' && e.alive) { e.dying = true; }
    SFX.play('boon'); UI.flash('Chamber cleared');
    if (this.run.has('t_foresight')) this.player.heal(10);
    const r = this.run.pending;
    if (r) {
      const p = this.player, x = clamp(p.cx + p.face * 30, TS * 3, this.room.pw - TS * 3);
      this.pickups.push(new Pickup(x, groundY(this.room, x, p.y), r));
    } else this.openDoors();
  },
  onRewardTaken() { this.run.pending = null; if (this.cleared) setTimeout(() => this.openDoors(), 200); },
  openDoors() {
    if (this.doors.length) return;
    const marks = this.room.marksOf('D');
    const rewards = this.run.isLast ? [] : this.run.rollRewards(marks.length);
    marks.forEach((m, i) => {
      const d = new Door(m.x, m.y, rewards[i] || null); d.open = true;
      if (this.run.roomKey === 'roost') { d.label = 'Climb out of Tartarus'; d.exit = true; }
      else d.label = rewards[i] ? (rewards[i].kind === 'boon' ? 'Boon of ' + TITANS[rewards[i].titan].name : REWARDS[rewards[i].kind].name) : 'Continue';
      this.doors.push(d);
    });
    SFX.play('door');
  },
  takeDoor(door) {
    if (door.hub) { this.startRun(); return; }
    if (door.exit) { this.showVictory(); return; }
    this.run.pending = door.reward; this.run.depth++;
    this.enterChamber();
  },

  onKill(e) {
    this.run.kills++; this.player.gainFlame(18);
    if (Math.random() < 0.18) { const v = this.run.gainIchor(irand(3, 7)); Nums.add(e.cx, e.y - 10, '+' + v + ' ichor', '#8fe8ff'); }
  },
  onBossDeath() {
    Save.data.eagleKills++; Save.data.wins++; Save.write(); UI.boss(null);
    setTimeout(() => { this.enemies = this.enemies.filter((e) => e !== this.boss); for (const e of this.enemies) if (e.alive) e.die(); this.boss = null; this.cleared = true; this.openDoors(); UI.flash('The way out of Tartarus opens.', 3); }, 2200);
  },
  onPlayerDeath(killer) {
    Save.data.deaths++; Save.data.lastKiller = killer; Save.data.bestRoom = Math.max(Save.data.bestRoom, this.run.depth); Save.write();
    Cam.shake(6, 0.5); SFX.play('screech');
    Parts.burst(this.player.cx, this.player.cy, 50, ['#ffd36a', '#ff7a1f', '#e0441a'], 180, 1, { glow: 14 });
    this.deathT = 1.8;
  },
  showDeath() {
    const k = Save.data.lastKiller, names = { shade: 'a Chained Shade', eaglet: 'an Eaglet', fist: 'a Hundred-Handed Fist', warden: 'a Bronze Warden', lampad: 'a Lampad', eagle: 'the Eagle', lava: 'the lava of Tartarus', abandon: 'your own hand' };
    const line = 'Slain by ' + (names[k] || 'Tartarus') + '. ' + (k === 'eagle' ? pick(LINES.eagle.intro) : pick(LINES.zeusMock));
    this.mode = 'dead';
    UI.death({ depth: this.run.depth + 1, kills: this.run.kills, ichor: this.run.ichor, time: this.run.time }, line);
  },
  showVictory() { this.mode = 'dead'; UI.victory({ kills: this.run.kills, ichor: this.run.ichor, time: this.run.time, boons: this.run.boons.length }); },

  pause() { if (this.mode !== 'play' && this.mode !== 'hub') return; this.pausedFrom = this.mode; this.mode = 'paused'; UI.open('p-pause', { Escape: () => this.resume() }); },
  resume() { UI.close(); this.mode = this.pausedFrom || 'play'; },

  // ---------------------------------------------------------------- frame
  tick(dt) {
    Input.update(); UI.tick(dt);
    if (Input.pressed.pause && (this.mode === 'play' || this.mode === 'hub')) this.pause();
    const live = this.mode === 'play' || this.mode === 'hub';
    if (live) {
      if (this.hitstop > 0) this.hitstop -= dt;
      else this.update(dt);
    } else if (this.mode === 'title') { this.time += dt; Parts.update(dt); }
    this.render();
    UI.hud(this.run, this.player);
    UI.boss(this.boss && this.boss.state !== 'perch' && this.boss.hp > 0 ? this.boss : null);
  },

  update(dt) {
    this.time += dt; const p = this.player, R = this.room;
    if (this.mode === 'play') this.run.time += dt;
    p.update(dt, R);
    // boss intro when the hero comes close
    if (this.boss && this.boss.state === 'perch' && Math.abs(p.cx - this.boss.cx) < 150) {
      this.boss.set('hover'); SFX.play('screech'); Cam.shake(5, 0.4);
      UI.say('The Eagle', pick(LINES.eagle.intro), '#ffb04a', 4.5);
    }
    for (const e of this.enemies) e.update(dt, R, p);
    this.enemies = this.enemies.filter((e) => !e.dying || e === this.boss);
    for (const s of this.projectiles) s.update(dt, R); this.projectiles = this.projectiles.filter((s) => !s.dead);
    for (const s of this.enemyShots) s.update(dt, R, p); this.enemyShots = this.enemyShots.filter((s) => !s.dead);
    for (const k of this.pickups) k.update(dt, R, p); this.pickups = this.pickups.filter((k) => !k.taken);
    for (const d of this.doors) d.update(dt, p);
    for (const f of this.effects) { f.t -= dt; if (f.kind === 'rift') for (const e of this.enemies) if (e.alive && dist(e.cx, e.cy, f.x, f.y) < f.r) e.slow = Math.max(e.slow, 0.5); }
    this.effects = this.effects.filter((f) => f.t > 0);
    // hub / chamber props you can use
    for (const pr of this.props) {
      pr.near = !!pr.act && !pr.used && p.alive && Math.abs(p.cx - pr.x) < 22 && Math.abs(p.y + p.h - pr.y) < 30;
      if (pr.near && (Input.pressed.interact || Input.pressed.up)) { SFX.play('ui'); pr.act(); }
    }
    // thunder over the roost while the Eagle fights
    this.thunder = Math.max(0, this.thunder - dt);
    if (this.boss && this.boss.alive && this.boss.state !== 'perch' && (this.boltT -= dt) <= 0) { this.boltT = rand(5, 9); this.thunder = 0.34; SFX.play('boom'); }
    this.checkClear();
    if (this.deathT > 0) { this.deathT -= dt; if (this.deathT <= 0) this.showDeath(); }
    Parts.update(dt); Nums.update(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    Cam.follow(p.cx + p.face * 24, p.cy - 10, R.pw, R.ph, dt);
  },

  render() {
    const ctx = Gfx.ctx, R = this.room, p = this.player, t = this.time;
    ctx.fillStyle = '#050203'; ctx.fillRect(0, 0, W, H);
    Backdrop.draw(ctx, R);
    ctx.save(); ctx.translate(-Cam.sx, -Cam.sy);
    ctx.drawImage(R.canvas, 0, 0);
    drawLava(ctx, R, t);
    for (const pr of this.props) drawProp(ctx, pr, t);
    for (const d of this.doors) d.draw(ctx, t);
    for (const f of this.effects) if (f.kind === 'rift') { ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.08; ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    for (const e of this.enemies) { if (e.type === 'eagle') drawEagle(ctx, e, t); else drawMob(ctx, e, t); }
    for (const e of this.enemies) if (e.alive && e.type !== 'eagle' && e.hp < e.maxHp && (e.type !== 'fist' || e.rise > 0.4)) {
      const bw = Math.max(14, e.w + 4), bx = Math.round(e.cx - bw / 2), by = Math.round(e.y - 6);
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4); ctx.fillStyle = '#4a1010'; ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = e.hex > 0 ? '#c07af0' : '#e5483c'; ctx.fillRect(bx, by, Math.ceil(bw * e.hp / e.maxHp), 2);
    }
    const P = drawHero(ctx, p, t); p.lastPose = P;
    for (const s of this.enemyShots) s.draw(ctx);
    Parts.draw(ctx);
    ctx.restore();

    // ---- lights
    const fire = heroFirePos(p, P), flick = Math.sin(t * 13) * 4 + Math.sin(t * 7.3) * 3;
    if (p.alive) Light.add(fire.x, fire.y, 128 + flick + this.run.flame * 0.2, 'rgba(255,150,60,1)', 1);
    else Light.add(p.cx, p.cy, 60, 'rgba(255,90,30,1)', 0.7);
    for (const pr of this.props) if (pr.kind === 'brazier') Light.add(pr.x, pr.y - 16, 84 + Math.sin(t * 9 + pr.x) * 4, 'rgba(255,120,40,1)', 0.9);
    else if (pr.kind === 'fountain') Light.add(pr.x, pr.y - 10, 90, 'rgba(120,200,255,1)', 0.9);
    else if (pr.kind === 'altar') Light.add(pr.x, pr.y - 14, 70, 'rgba(120,220,255,1)', 0.8);
    else if (pr.kind === 'rack') Light.add(pr.x, pr.y - 18, 60, 'rgba(255,150,60,1)', 0.8);
    else if (pr.kind === 'epimetheus') Light.add(pr.x, pr.y - 20, 56, null, 0.6);
    for (const l of R.lavaTiles) if ((l.x + l.y) % 2 === 0) Light.add(l.x * TS + 8, l.y * TS + 4, 46, 'rgba(255,90,20,1)', 0.8);
    for (const e of this.enemies) if (e.alive && e.type === 'lampad') Light.add(e.cx, e.y + 6, 50, 'rgba(255,140,40,1)', 0.7);
    // Zeus' eagle carries a faint storm-light, so it reads against the dark
    if (this.boss && this.boss.alive) Light.add(this.boss.cx, this.boss.cy - 6, 116, 'rgba(255,215,150,1)', 0.72);
    const bolt = this.thunder > 0.22 || (this.thunder > 0 && this.thunder < 0.1);
    Light.ambient = this.mode === 'hub' || this.mode === 'title' ? 0.82 : bolt ? 0.45 : 0.9;
    Light.render(ctx);

    // ---- emissive layer: drawn over the darkness
    ctx.save(); ctx.translate(-Cam.sx, -Cam.sy);
    for (const e of this.enemies) drawMobEyes(ctx, e, t);
    for (const pr of this.props) if (pr.kind === 'brazier') drawFireOrb(ctx, pr.x, pr.y - 12, t + pr.x, 1.2);
    if (p.alive) { drawFireOrb(ctx, fire.x, fire.y, t, 1.2 + this.run.flame / 250); drawHeroWeapon(ctx, p, t); }
    for (const s of this.projectiles) s.draw(ctx);
    for (const k of this.pickups) k.draw(ctx, t);
    for (const d of this.doors) if (d.open && d.reward) drawRewardIcon(ctx, Math.round(d.x), Math.round(d.y - 44 + Math.sin(t * 2 + d.x) * 2), d.reward, t);
    for (const pr of this.props) if (pr.near && pr.label) drawText(ctx, (Input.device === 'pad' ? '[LB] ' : '[E] ') + pr.label, pr.x, pr.y - 44, '#ffffff', 1, 'center');
    for (const d of this.doors) if (d.near) drawText(ctx, (Input.device === 'pad' ? '[LB] ' : '[E] ') + d.label, d.x, d.y - 60, '#ffffff', 1, 'center');
    Nums.draw(ctx);
    ctx.restore();
    if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(160,10,10,${this.hurtFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  },
};

// The hero's fire weapon glows, so it is drawn on top of the darkness.
function drawHeroWeapon(ctx, p, t) {
  const f = p.face, ox = p.cx, oy = p.y + p.h, a = p.atk, spear = p.run.weapon === 'spear';
  const shx = ox + f * 3, shy = oy - 23;
  if (!a) {
    if (p.state === 'dash' || p.state === 'hurt' || p.state === 'wall') return;
    if (spear) { if (!p.spearOut) drawSpear(ctx, ox + f * 5, oy - 8, -1.35, f, 26); }
    else drawBlade(ctx, ox + f * 5, oy - 16, 1.15, f, 14, false);
    return;
  }
  const s = a.step, ang = a.ang;
  if (s.throwSpear) return;
  if (spear) {
    const reach = a.phase === 'act' ? easeOut(clamp(a.t / s.a, 0, 1)) : a.phase === 'wind' ? -0.4 * (a.t / s.w) : 1 - a.t / s.r;
    drawSpear(ctx, shx + f * (reach * (s.reach - 30) + 2), shy + 2, 0, f, 30);
    if (a.phase === 'act') { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffd36a'; ctx.fillRect(f > 0 ? shx + 6 : shx - s.reach, shy + 2, s.reach, 2); ctx.globalAlpha = 1; }
    return;
  }
  const hx = shx + Math.cos(ang) * 7 * f, hy = shy + Math.sin(ang) * 7;
  if (a.phase === 'act' || (a.phase === 'rec' && a.t < 0.05)) {
    const k = a.phase === 'act' ? easeOut(clamp(a.t / s.a, 0, 1)) : 1, a0 = s.arc[0], a1 = lerp(s.arc[0], s.arc[1], k);
    ctx.save(); ctx.translate(shx, shy); ctx.scale(f, 1);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    ctx.globalAlpha = a.phase === 'act' ? 0.6 : 0.25; ctx.fillStyle = '#ffd36a';
    ctx.beginPath(); ctx.arc(0, 0, s.reach, lo, hi); ctx.arc(0, 0, s.reach * 0.55, hi, lo, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a1a'; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.arc(0, 0, s.reach + 2, lo, hi); ctx.arc(0, 0, s.reach - 2, hi, lo, true); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  drawBlade(ctx, hx, hy, ang, f, 16, a.phase === 'act');
}

// Props on the Rock and in chambers.
function drawProp(ctx, pr, t) {
  const x = Math.round(pr.x), y = Math.round(pr.y);
  if (pr.kind === 'brazier') {
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(x - 1, y - 12, 3, 12); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 6, y - 14, 13, 3); ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 4, y - 2, 9, 2);
  } else if (pr.kind === 'epimetheus') {
    const D = painter(ctx, x, y, 1, null), b = Math.sin(t * 2) > 0.5 ? 1 : 0;
    D.r(-3, -12, 3, 12, '#8a5a3a'); D.r(1, -12, 3, 12, '#9a6a44'); D.r(-3, -2, 7, 2, '#3a2418');
    D.r(-5, -26 + b, 11, 15, '#2a4a7a'); D.r(-5, -26 + b, 3, 15, '#1e3658'); D.r(4, -25 + b, 2, 12, '#3a64a0');
    D.r(-3, -34 + b, 7, 8, '#c0845a'); D.r(-4, -35 + b, 8, 3, '#6a4a2a'); D.r(1, -31 + b, 1, 1, '#1a0c06'); D.r(-3, -28 + b, 7, 3, '#8a6a4a');
    D.r(4, -20 + b, 5, 7, '#e8dcc0'); D.r(5, -19 + b, 3, 1, '#8a7a60'); D.r(5, -17 + b, 3, 1, '#8a7a60');
  } else if (pr.kind === 'rack') {
    ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 10, y - 4, 20, 4); ctx.fillRect(x - 9, y - 30, 2, 26); ctx.fillRect(x + 7, y - 30, 2, 26);
    drawBlade(ctx, x - 4, y - 6, -1.57, 1, 18, Math.sin(t * 3) > 0); drawSpear(ctx, x + 4, y - 4, -1.57, 1, 24);
  } else if (pr.kind === 'altar') {
    ctx.fillStyle = '#2e2a30'; ctx.fillRect(x - 12, y - 12, 24, 12); ctx.fillStyle = '#4a4450'; ctx.fillRect(x - 14, y - 14, 28, 3);
    ctx.fillStyle = '#8fe8ff'; ctx.fillRect(x - 3, y - 20 + Math.round(Math.sin(t * 3) * 1.5), 6, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 19 + Math.round(Math.sin(t * 3) * 1.5), 2, 2);
  } else if (pr.kind === 'fountain') {
    ctx.fillStyle = '#3a3a48'; ctx.fillRect(x - 14, y - 8, 28, 8); ctx.fillStyle = '#5a5a6a'; ctx.fillRect(x - 16, y - 10, 32, 3);
    ctx.fillStyle = pr.used ? '#2a3a4a' : '#6ac8ff'; ctx.fillRect(x - 12, y - 7, 24, 3);
    if (!pr.used) for (let k = 0; k < 3; k++) { ctx.fillStyle = '#bfe8ff'; ctx.fillRect(x - 1 + k - 1, y - 16 - ((t * 20 + k * 5) % 8), 1, 2); }
  } else if (pr.kind === 'anchor') {
    // the chains that held Prometheus, now broken, and the eagle's empty perch
    ctx.fillStyle = '#6e6874'; ctx.fillRect(x - 3, y - 4, 6, 4);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = k % 2 ? '#5a5260' : '#8a8090'; ctx.fillRect(x - 6 - k * 2, y + k * 3, 2, 3); ctx.fillRect(x + 5 + k * 2, y + k * 3, 2, 3); }
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(x + 10, y - 26, 2, 22); ctx.fillRect(x + 4, y - 26, 14, 2);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x + 6 + k * 4, y - 4, 2, 1); }
  }
}

addEventListener('load', () => G.init());
