'use strict';
// DOM overlays: HUD, dialogue, boon choices, altar, weapon rack, title, death and victory screens.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const UI = {
  flashT: 0, sayT: 0, panel: null, keys: null,
  init() {
    addEventListener('keydown', (e) => this.onKey(e));
    if (matchMedia('(pointer: coarse)').matches) this.initTouch();
  },
  // ---- small messages
  flash(msg, t = 2.2) { $('flash').textContent = msg; $('flash').hidden = false; this.flashT = t; },
  say(who, line, col = '#ffd36a', t = 4.2) {
    $('say-who').textContent = who; $('say-who').style.color = col; $('say-line').textContent = '“' + line + '”';
    $('say').hidden = false; this.sayT = t;
  },
  tick(dt) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) $('flash').hidden = true; }
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) $('say').hidden = true; }
  },
  hud(run, p) {
    $('hud').hidden = !(G.mode === 'play' || G.mode === 'hub');
    if (!run) return;
    $('hp-fill').style.width = (clamp(run.hp / run.maxHp, 0, 1) * 100) + '%';
    $('hp-text').textContent = Math.ceil(run.hp) + ' / ' + run.maxHp;
    $('flame-fill').style.width = run.flame + '%';
    $('flame-bar').classList.toggle('ready', run.flame >= PM.castCost);
    $('ichor').textContent = Save.data.ichor;
    const hint = this.hintText(false); if (hint !== this.lastHint) { $('key-hints').textContent = hint; this.lastHint = hint; }
    $('where').textContent = G.mode === 'hub' ? 'The Rock' : 'Tartarus · chamber ' + (run.depth + 1) + ' of ' + run.plan.length;
    $('boons').innerHTML = run.boons.map((id) => { const b = BOONS.find((x) => x.id === id); return `<span style="--c:${TITANS[b.titan].col}" title="${esc(b.name)}: ${esc(b.desc)}">${esc(b.name)}</span>`; }).join('');
    $('dash-pips').textContent = '◆'.repeat(p.dashCharges) + '◇'.repeat(Math.max(0, run.dashMax - p.dashCharges));
  },
  boss(e) {
    $('bossbar').hidden = !e;
    if (e) { $('boss-name').textContent = e.name; $('boss-fill').style.width = (clamp(e.hp / e.maxHp, 0, 1) * 100) + '%'; }
  },

  // ---- panels (pause the game while open)
  open(id, keys = null) {
    for (const el of document.querySelectorAll('.panel')) el.hidden = true;
    this.panel = id; this.keys = keys;
    if (id) { $(id).hidden = false; const b = $(id).querySelector('button:not([disabled])'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 0); }
  },
  close() { this.open(null); },
  onKey(e) {
    if (!this.panel) return;
    if (this.keys && this.keys[e.code]) { e.preventDefault(); this.keys[e.code](); return; }
    const btns = [...$(this.panel).querySelectorAll('button:not([disabled])')];
    let i = btns.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(e.code)) { e.preventDefault(); btns[(i + 1) % btns.length].focus(); SFX.play('ui'); }
    else if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); SFX.play('ui'); }
    else if (['KeyJ', 'KeyE', 'Space', ...KEYMAP.attack, ...KEYMAP.interact, ...KEYMAP.jump].includes(KEY_NORM[e.code] || e.code) && document.activeElement.tagName === 'BUTTON') { e.preventDefault(); document.activeElement.click(); }
  },

  // Control hints that follow the player's bindings.
  hintText(long) {
    const k = (a) => Controls.label(a);
    if (!long) return `${k('jump')} jump (again in the air) · ${k('attack')} attack · ${k('special')} special · ${k('cast')} cast fire · ${k('dash')} dash · ${k('interact')} use · ${k('pause')} pause`;
    return `${k('left')}/${k('right')} move · ${k('jump')} jump, press again in the air to double jump · jump into a wall’s edge to climb it · ${k('attack')} attack · ${k('special')} special · ${k('cast')} cast the fire · ${k('dash')} dash · ${k('interact')} use doors, rewards and people · ${k('down')} + ${k('jump')} drops through ledges.`;
  },

  // Rebind any action: two keyboard slots and one gamepad button each.
  showControls(back) {
    let wait = null, note = '';
    const nameOf = (a) => ACTIONS.find((x) => x[0] === a)[1];
    const isWait = (kind, a, s) => wait && wait.kind === kind && wait.act === a && wait.slot === s;
    const render = (focus) => {
      const key = (a, s) => `<button type="button" class="key${isWait('key', a, s) ? ' wait' : ''}" data-k="key" data-a="${a}" data-s="${s}">${isWait('key', a, s) ? 'Press a key' : esc(keyName(KEYMAP[a][s]))}</button>`;
      const pad = (a) => PADMAP[a] ? `<button type="button" class="key${isWait('pad', a, 0) ? ' wait' : ''}" data-k="pad" data-a="${a}" data-s="0">${isWait('pad', a, 0) ? 'Press a button' : esc(PADMAP[a].map(padName).join(' / ') || '—')}</button>` : '<span class="fixed">Stick / D-pad</span>';
      $('p-controls').innerHTML = `<h2>Controls</h2><p class="line ${note ? 'note' : 'dim'}" aria-live="polite">${esc(note || 'Pick a slot, then press the key or gamepad button you want. Esc cancels. Backspace clears a key slot.')}</p>
        <div class="binds"><span></span><span class="hd">Key</span><span class="hd">Other key</span><span class="hd">Gamepad</span>
        ${ACTIONS.map(([a, n]) => `<span class="act">${esc(n)}</span>${key(a, 0)}${key(a, 1)}${pad(a)}`).join('')}</div>
        <div class="row"><button type="button" id="ct-done">Done</button><button type="button" class="ghost" id="ct-reset">Reset to defaults</button></div>`;
      $('p-controls').querySelectorAll('.key').forEach((el) => el.onclick = () => {
        SFX.play('ui'); wait = { kind: el.dataset.k, act: el.dataset.a, slot: +el.dataset.s, armed: false }; note = '';
        render(el.dataset); if (wait.kind === 'pad') pollPad();
      });
      $('ct-done').onclick = done;
      $('ct-reset').onclick = () => { Controls.reset(); wait = null; note = 'Controls reset to the defaults.'; SFX.play('ui'); render('reset'); };
      const f = focus === 'reset' ? $('ct-reset') : focus && $('p-controls').querySelector(`[data-k="${focus.k}"][data-a="${focus.a}"][data-s="${focus.s}"]`);
      if (f) f.focus({ preventScroll: true });
    };
    const finish = (from, what) => {
      Controls.save(); const w = wait; wait = null; SFX.play('pickup');
      note = from ? `${what} moved here from ${nameOf(from)}.` : '';
      if (!note && !KEYMAP[w.act].some(Boolean) && !(PADMAP[w.act] || []).length) note = `${nameOf(w.act)} has no control now.`;
      render({ k: w.kind, a: w.act, s: w.slot });
    };
    const onKey = (e) => {
      if (!wait || wait.kind !== 'key') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const code = KEY_NORM[e.code] || e.code, w = wait;
      if (code === 'Escape') { wait = null; note = ''; render({ k: 'key', a: w.act, s: w.slot }); return; }
      if (code === 'Backspace' || code === 'Delete') { KEYMAP[w.act][w.slot] = null; finish(null); return; }
      finish(Controls.setKey(w.act, w.slot, code), keyName(code));
    };
    const pollPad = () => {
      if (!wait || wait.kind !== 'pad' || this.panel !== 'p-controls') return;
      let hit = null;
      for (const p of navigator.getGamepads ? navigator.getGamepads() : []) if (p && p.connected) p.buttons.forEach((b, i) => { if (b.pressed && i < 12) hit = i; });
      if (hit === null) wait.armed = true;
      else if (wait.armed) { finish(Controls.setPad(wait.act, hit), padName(hit)); return; }
      setTimeout(pollPad, 30);
    };
    const done = () => { if (wait) { wait = null; render(); return; } removeEventListener('keydown', onKey, true); SFX.play('ui'); this.lastHint = null; back(); };
    addEventListener('keydown', onKey, true);
    render();
    this.open('p-controls', { Escape: () => done() });
  },

  title() {
    G.mode = 'title';
    const S = Save.data;
    $('title-stats').innerHTML = S.runs ? `<span>Escapes attempted <b>${S.runs}</b></span><span>Ichor <b>${S.ichor}</b></span><span>Eagles slain <b>${S.eagleKills}</b></span>` : '';
    this.open('p-title');
  },
  story(done) {
    const cards = [
      ['Long ago', 'The Titan Prometheus stole fire from the gods and gave it to humanity.'],
      ['The punishment', 'Zeus chained him to a rock in the deepest pit of Tartarus. Every day an eagle tore out his heart. Every night it grew back.'],
      ['Five hundred years later', 'The chains gave way.'],
      ['The second theft', 'Before he fled, Prometheus stole the fire again, from the heart of Tartarus itself. To bring it back to humanity he must climb out of hell and defeat every god in his way, up to Zeus in the heavens.'],
    ];
    let i = 0;
    const render = () => {
      const [eyebrow, text] = cards[i], last = i === cards.length - 1;
      $('p-story').innerHTML = `<div class="eyebrow">${eyebrow}</div><p class="story">${text}</p>
        <div class="dots">${cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="row"><button type="button" id="st-next">${last ? 'Break the chains' : 'Continue'}</button>${last ? '' : '<button type="button" class="ghost" id="st-skip">Skip</button>'}</div>`;
      $('st-next').onclick = () => { SFX.play('ui'); if (last) done(); else { i++; render(); } };
      if (!last) $('st-skip').onclick = () => { SFX.play('ui'); done(); };
      this.open('p-story', { Enter: () => $('st-next').click() });
    };
    render();
  },

  // Epimetheus and other speakers: a sequence of lines, advance with a key or click.
  dialogue(who, col, lines, done) {
    let i = 0; G.mode = 'dialog';
    const render = () => {
      $('p-dialog').innerHTML = `<div class="who" style="color:${col}">${esc(who)}</div><p class="line">${esc(lines[i])}</p><div class="row"><button type="button" id="dl-next">${i === lines.length - 1 ? 'Close' : 'Next'}</button></div>`;
      $('dl-next').onclick = () => { SFX.play('ui'); if (i < lines.length - 1) { i++; render(); } else { this.close(); done && done(); } };
      this.open('p-dialog', { Enter: () => $('dl-next').click(), Escape: () => { this.close(); done && done(); } });
    };
    render();
  },

  showBoons(titan) {
    const T = TITANS[titan], choices = G.run.boonChoices(titan);
    const prev = G.mode; G.mode = 'choice';
    $('p-boon').innerHTML = `<div class="who" style="color:${T.col}">${esc(T.name)} <small>${esc(T.title)}</small></div><p class="line">“${esc(T.line)}”</p>
      <div class="cards">${choices.map((b, i) => `<button type="button" class="card" data-i="${i}" style="--c:${TITANS[b.titan].col}"><span class="slot">${esc(b.slot)}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></button>`).join('')}</div>`;
    $('p-boon').querySelectorAll('.card').forEach((el) => el.onclick = () => {
      const b = choices[+el.dataset.i]; G.run.addBoon(b.id); SFX.play('boon');
      this.close(); G.mode = prev === 'choice' ? 'play' : prev; this.flash(b.name + ' acquired');
    });
    this.open('p-boon');
  },

  showWeapons() {
    const prev = G.mode; G.mode = 'choice';
    const render = () => {
      $('p-weapon').innerHTML = `<div class="who">The fire takes a shape</div><p class="line">Choose the form your stolen fire takes for the next escape.</p>
        <div class="cards">${Object.entries(WEAPONS).map(([id, w]) => `<button type="button" class="card${Save.data.weapon === id ? ' on' : ''}" data-id="${id}" style="--c:#ff9a3a"><span class="slot">${Save.data.weapon === id ? 'Equipped' : 'Fire form'}</span><b>${esc(w.name)}</b><span>${esc(w.desc)}</span><span class="dim">Special · ${esc(w.special)}</span></button>`).join('')}</div>
        <div class="row"><button type="button" class="ghost" id="wp-close">Done</button></div>`;
      $('p-weapon').querySelectorAll('.card').forEach((el) => el.onclick = () => { Save.data.weapon = el.dataset.id; G.run.weapon = el.dataset.id; Save.write(); SFX.play('pickup'); render(); });
      $('wp-close').onclick = () => { this.close(); G.mode = prev; };
      this.open('p-weapon', { Escape: () => $('wp-close').click() });
    };
    render();
  },

  showAltar() {
    const prev = G.mode; G.mode = 'choice';
    const render = () => {
      const S = Save.data;
      $('p-altar').innerHTML = `<div class="who" style="color:#8fe8ff">Altar of the Titans</div><p class="line">Offer ichor, the blood of the gods, to grow stronger for every escape to come. You have <b class="ichor">${S.ichor} ichor</b>.</p>
        <div class="list">${UPGRADES.map((u) => { const r = S.upgrades[u.id] || 0, max = r >= u.costs.length, cost = u.costs[r]; return `<button type="button" class="up" data-id="${u.id}" ${max || S.ichor < cost ? 'disabled' : ''}><b>${esc(u.name)} <small>${r}/${u.costs.length}</small></b><span>${esc(u.desc)}</span><em>${max ? 'Mastered' : cost + ' ichor'}</em></button>`; }).join('')}</div>
        <div class="row"><button type="button" class="ghost" id="al-close">Done</button></div>`;
      $('p-altar').querySelectorAll('.up').forEach((el) => el.onclick = () => {
        const u = UPGRADES.find((x) => x.id === el.dataset.id), r = Save.data.upgrades[u.id] || 0, cost = u.costs[r];
        if (Save.data.ichor < cost) { SFX.play('deny'); return; }
        Save.data.ichor -= cost; Save.data.upgrades[u.id] = r + 1; Save.write(); SFX.play('boon');
        G.newHubRun(); render();
      });
      $('al-close').onclick = () => { this.close(); G.mode = prev; };
      this.open('p-altar', { Escape: () => $('al-close').click() });
    };
    render();
  },

  death(stats, killerLine) {
    $('p-death').innerHTML = `<div class="eyebrow">The fire goes out</div><h2>Back to the Rock</h2>
      <p class="line">${esc(killerLine)}</p>
      <div class="stats"><div><b>${stats.depth}</b><span>Chambers reached</span></div><div><b>${stats.kills}</b><span>Foes slain</span></div><div><b>${stats.ichor}</b><span>Ichor kept</span></div><div><b>${fmtTime(stats.time)}</b><span>Time</span></div></div>
      <div class="row"><button type="button" id="dt-go">Wake on the Rock</button></div>`;
    $('dt-go').onclick = () => { SFX.play('ui'); this.close(); G.enterHub(true); };
    this.open('p-death', { Enter: () => $('dt-go').click() });
  },
  victory(stats) {
    $('p-death').innerHTML = `<div class="eyebrow">Chapter I complete</div><h2>The Eagle falls</h2>
      <p class="line">For five hundred years it fed on your heart. Now its feathers smoulder at your feet. Far above, on Olympus, Zeus stops laughing.</p>
      <p class="line dim">The way out of Tartarus lies open. Cerberus, Hades and the gods of Olympus wait beyond it, in chapters still to come.</p>
      <div class="stats"><div><b>${stats.kills}</b><span>Foes slain</span></div><div><b>${stats.ichor}</b><span>Ichor gained</span></div><div><b>${fmtTime(stats.time)}</b><span>Time</span></div><div><b>${stats.boons}</b><span>Boons carried</span></div></div>
      <div class="row"><button type="button" id="dt-go">Return to the Rock</button></div>`;
    $('dt-go').onclick = () => { SFX.play('ui'); this.close(); G.enterHub(false); };
    this.open('p-death', { Enter: () => $('dt-go').click() });
  },

  initTouch() {
    $('touch').hidden = false;
    for (const b of $('touch').querySelectorAll('button')) {
      const a = b.dataset.a;
      const on = (e) => { e.preventDefault(); SFX.init(); Input.touch[a] = true; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); Input.touch[a] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    }
  },
};

function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
