// [MODULE] Boss encounters - the World 1 attack system and the World 2 hit-plate/turret/beam fight.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// BOSS SYSTEM // [1.11]
// ══════════════════════════════════════════════════

function _bossSize() { return w2Boss ? w2Boss.size : (BOSS_CONFIG[bossTier] ? BOSS_CONFIG[bossTier].size : 0); } // [2.0-s4b] W1 or W2 boss footprint

function getBossCells() { // [1.11]
  if (!bossActive) return new Set();
  const sz = _bossSize(); // [2.0-s4b]
  const s = new Set();
  for (let dy = 0; dy < sz; dy++)
    for (let dx = 0; dx < sz; dx++)
      s.add(`${bossX + dx},${bossY + dy}`); // [2.0-s4] live position
  return s;
}

function _cleanupBoss() { // [1.11]
  clearInterval(bossTimer);      bossTimer = null;
  clearTimeout(bossThrowTimer);  bossThrowTimer = null; // [2.0-s4] throw loop is now a self-rescheduling timeout
  clearTimeout(bossPressureTimer); bossPressureTimer = null; _bossPressureCount = 0; // [2.0-s4d] stop the pressure burst loop
  bossAttackTimers.forEach(h => { clearTimeout(h); clearInterval(h); });
  bossAttackTimers = [];
  bossRound = false;
  bossActive = false;
  bossShockwaveCells = new Set();
  blocks = blocks.filter(b => !b.bossThrow && !b.bossRain && !b.bossPressure);
  // [2.0-s4b] clear all World-2 boss state
  w2Boss = null; w2SpeedMult = 1; bossHitsLeft = 0; bossShieldUntil = 0;
  hitPlate = null; turret = null; w2BhBlocks = []; _w2PowerBusyUntil = 0; _w2Pulling = false; // [2.0-s4f]
  destroyedCells = new Set(); w2SpinState = null; w2SpinCells = new Set();
  w2Beam = null; w2GravityWarn = null; w2Star = null; w2StarShock = null; _blockAttackPauseUntil = 0; // [2.0-s4e]
}

function _bossPushPlayer() { // [2.0-s2] if a boss spawns on the player, shove them clear (no damage)
  const bcells = getBossCells();
  if (!bcells.has(`${cube.x},${cube.y}`)) return;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i=dirs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [dirs[i],dirs[j]]=[dirs[j],dirs[i]]; }
  for (const [dx,dy] of dirs) { // try pushing 4 cells in a random valid direction
    const nx = cube.x + dx*4, ny = cube.y + dy*4;
    if (nx>=0&&nx<N&&ny>=0&&ny<N && !bcells.has(`${nx},${ny}`)) { cube.x=nx; cube.y=ny; _bossPushFlash(); return; }
  }
  for (let r=1;r<N;r++) { // fallback: nearest free non-boss cell
    for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++) {
      if (Math.abs(dx)+Math.abs(dy)!==r) continue;
      const nx=cube.x+dx, ny=cube.y+dy;
      if (nx>=0&&nx<N&&ny>=0&&ny<N && !bcells.has(`${nx},${ny}`)) { cube.x=nx; cube.y=ny; _bossPushFlash(); return; }
    }
  }
}
function _bossPushFlash() { // [2.0-s2]
  flash('Pushed!');
  spawnDashParticles(cube.x, cube.y);
}

function startBossRound(tier) { // [1.11]
  if (gridlockActive) _endGridlockMode(false); // [1.12] boss overrides GRIDLOCK
  _clearActiveMod(); // [2.0-s3.1] a round modifier can't bleed into a boss round
  _cleanupBoss(); // reset any prior state
  bossRound    = true;
  bossActive   = false;
  bossTier     = tier;
  bossX        = BOSS_CONFIG[tier].gridX; // [2.0-s4] spawn at the configured position; may drift later
  bossY        = BOSS_CONFIG[tier].gridY; // [2.0-s4]
  bossTimeLeft = 20;
  lasers = []; blocks = [];
  asteroids = []; clearTimeout(asteroidTimer); asteroidTimer = null; // [2.0-s2] asteroids pause during boss
  if (hudTimerEl) { hudTimerEl.style.display = ''; hudTimerVal.textContent = '20s'; hudTimerEl.classList.remove('urgent'); } // [2.0-deemoji]
  flash('BOSS INCOMING!');
  render(); startAnim();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    bossActive = true;
    _bossPushPlayer(); // [2.0-s2] shove player out of boss cells on spawn
    flash(`${BOSS_CONFIG[tier].name}`);
    render();
    // [2.0-s4] self-rescheduling throw loop with ±20% timing jitter
    _scheduleBossThrow();
    // [2.0-s4d] pressure burst: 5 blocks (1/s) on the player's cell, then a 5s pause, repeating
    _bossPressureCount = 0; bossPressureTimer = setTimeout(_bossPressureTick, 1000);
    // tier 2+ extras
    if (tier >= 2) _scheduleBossRain();
    if (tier >= 2) _scheduleBossShockwave();
    // countdown
    bossTimer = setInterval(() => {
      if (!alive || !bossRound) { clearInterval(bossTimer); return; }
      if (gamePaused) return;
      bossTimeLeft--;
      if (hudTimerEl) {
        hudTimerVal.textContent = `${bossTimeLeft}s`; // [2.0-deemoji]
        hudTimerEl.classList.toggle('urgent', bossTimeLeft <= 5);
      }
      if (bossTimeLeft <= 0) { clearInterval(bossTimer); bossVictory(); }
    }, 1000);
  }, 1500));
}

function _scheduleBossThrow() { // [2.0-s4] throw loop with ±20% timing jitter (replaces fixed 1s interval)
  clearTimeout(bossThrowTimer);
  bossThrowTimer = setTimeout(_bossTick, 1000 * (0.8 + Math.random() * 0.4));
}

let _blockAttackPauseUntil = 0; // [2.0-s4e] while now < this, ALL block attacks (pressure/throw/rain) are halted
function _blocksPaused() { return Date.now() < _blockAttackPauseUntil; } // [2.0-s4e]
let _bossPressureCount = 0; // [2.0-s4e] burst counter — 5 hits then a 6s pause
function _bossPressureTick() { // [2.0-s4e] pressure burst — one block on the player's cell, 5×(1/s) then 6s pause (W1 + W2)
  if (!alive || !bossRound) return; // loop stops (no reschedule)
  if (gamePaused) { bossPressureTimer = setTimeout(_bossPressureTick, 300); return; } // hold during pause
  blocks = blocks.filter(b => !b.bossPressure); // clear previous pressure block
  const b = { x: cube.x, y: cube.y, state: 'charge', bossPressure: true };
  blocks.push(b);
  render();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    b.state = 'land'; spawnBlockImpact(b.x, b.y);
    render(); checkDeathByBlock();
    bossAttackTimers.push(setTimeout(() => { // [2.0-s4e] clear the landed block so the pause reads as a real break
      blocks = blocks.filter(x => x !== b);
      if (alive && bossRound) render();
    }, 250));
  }, 600));
  _bossPressureCount++;
  let wait;
  if (_bossPressureCount >= 5) { // [2.0-s4e] 5 hits → 6s pause that halts ALL block attacks
    _bossPressureCount = 0; wait = 6000;
    _blockAttackPauseUntil = Date.now() + 6000;
    blocks = blocks.filter(b => !b.bossThrow && !b.bossRain); // wipe in-flight throw/rain telegraphs
  } else { wait = 1000; }
  bossPressureTimer = setTimeout(_bossPressureTick, wait);
}

function _bossTargetOrigin(sz) { // [2.0-s4] random landing origin within 5 cells (Manhattan) of the player
  let ddx, ddy;
  do { ddx = Math.floor(Math.random() * 11) - 5; ddy = Math.floor(Math.random() * 11) - 5; }
  while (Math.abs(ddx) + Math.abs(ddy) > 5);
  const tx = cube.x + ddx, ty = cube.y + ddy;
  return [ Math.max(0, Math.min(N - sz, tx - Math.floor(sz / 2))),
           Math.max(0, Math.min(N - sz, ty - Math.floor(sz / 2))) ];
}

function _fireBossAttack() { // [2.0-s4] one attack: random target, ~30% fake telegraph (charge ≠ land)
  if (!alive || !bossRound) return;
  const sz = _bossSize(); // [2.0-s4b] W1 or W2 footprint
  const [lox, loy] = _bossTargetOrigin(sz);              // where it actually lands
  let [tox, toy] = [lox, loy];                           // where it telegraphs
  if (Math.random() < 0.30) [tox, toy] = _bossTargetOrigin(sz); // fake-out: charge elsewhere
  const chargeBlocks = [];
  for (let dy = 0; dy < sz; dy++)
    for (let dx = 0; dx < sz; dx++)
      chargeBlocks.push({ x: tox + dx, y: toy + dy, state: 'charge', bossThrow: true });
  blocks.push(...chargeBlocks);
  const t = setTimeout(() => {
    if (!alive || !bossRound) return;
    blocks = blocks.filter(b => !chargeBlocks.includes(b)); // drop this attack's telegraph
    if (_blocksPaused()) { if (alive) render(); return; } // [2.0-s4e] pause started mid-charge → cancel the land
    for (let dy = 0; dy < sz; dy++)
      for (let dx = 0; dx < sz; dx++) {
        blocks.push({ x: lox + dx, y: loy + dy, state: 'land', bossThrow: true });
        spawnBlockImpact(lox + dx, loy + dy);
      }
    render(); checkDeathByBlock();
  }, 600);
  bossAttackTimers.push(t);
}

function _maybeMoveBoss() { // [2.0-s4] occasionally drift the boss 1–2 cells (positional only, size unchanged)
  if (Math.random() > 0.4) return;
  const sz = _bossSize(); // [2.0-s4b]
  const step = 1 + Math.floor(Math.random() * 2); // 1 or 2 cells
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i = dirs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
  for (const [dx, dy] of dirs) {
    const nx = Math.max(0, Math.min(N - sz, bossX + dx * step));
    const ny = Math.max(0, Math.min(N - sz, bossY + dy * step));
    if (nx === bossX && ny === bossY) continue;
    bossX = nx; bossY = ny; break;
  }
  if (getBossCells().has(`${cube.x},${cube.y}`)) _bossPushPlayer(); // don't trap the player under the boss
}

function _bossTick() { // [1.11][2.0-s4] — jittered throw loop: drift + two simultaneous attacks
  if (!alive || !bossRound) return; // loop stops (no reschedule)
  if (gamePaused) { _scheduleBossThrow(); return; } // hold cadence while paused
  if (_blocksPaused()) { _scheduleBossThrow(); return; } // [2.0-s4e] no throws during the block-attack pause
  blocks = blocks.filter(b => !b.bossThrow); // clear previous throw warnings
  _maybeMoveBoss();
  _fireBossAttack();
  _fireBossAttack(); // two attacks at once
  render();
  _scheduleBossThrow();
}

function _scheduleBossRain() { // [1.11] — once per fight, random 4–16 s
  const delay = 4000 + Math.random() * 12000;
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    flash('BLOCK RAIN!'); render();
    bossAttackTimers.push(setTimeout(_startBlockRain, 500));
  }, delay));
}

function _startBlockRain() { // [1.11]
  if (!alive || !bossRound) return;
  const end = Date.now() + 3000;
  const iv = setInterval(() => {
    if (!alive || !bossRound || Date.now() >= end) {
      clearInterval(iv);
      if (alive && bossRound) bossAttackTimers.push(setTimeout(() => {
        blocks = blocks.filter(b => !b.bossRain);
        if (alive) render();
      }, 500));
      return;
    }
    if (gamePaused) return;
    if (_blocksPaused()) return; // [2.0-s4e] no rain during the block-attack pause
    const bCells = getBossCells();
    const rainPositions = [], rainUsed = new Set();
    for (let _a = 0; _a < 40 && rainPositions.length < 4; _a++) { // [1.11] random anywhere on grid
      const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N);
      const key = `${x},${y}`;
      if (!bCells.has(key) && !rainUsed.has(key)) { rainUsed.add(key); rainPositions.push({ x, y }); }
    }
    for (const pos of rainPositions) {
      if (bCells.has(`${pos.x},${pos.y}`)) continue;
      const b = { x: pos.x, y: pos.y, state: 'charge', bossRain: true };
      blocks.push(b);
      bossAttackTimers.push(setTimeout(() => {
        if (!alive || !bossRound) return;
        b.state = 'land'; spawnBlockImpact(b.x, b.y);
        render(); checkDeathByBlock();
      }, 400));
    }
    render();
  }, 350);
  bossAttackTimers.push(iv);
}

function _scheduleBossShockwave() { // [1.11] — once per fight, random 5–16 s
  const delay = 5000 + Math.random() * 11000;
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    flash('SHOCKWAVE!'); render();
    bossAttackTimers.push(setTimeout(_triggerBossShockwave, 300));
  }, delay));
}

function _triggerBossShockwave() { // [1.11]
  if (!alive || !bossRound) return;
  const scx = Math.floor(Math.random() * N); // [1.11] random center anywhere on grid
  const scy = Math.floor(Math.random() * N);
  bossShockwaveCells = new Set();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (Math.abs(x - scx) + Math.abs(y - scy) <= 3)
        bossShockwaveCells.add(`${x},${y}`);
  if (!tutorialActive && bossShockwaveCells.has(`${cube.x},${cube.y}`)) // [2.0-s4h]
    return die('block');
  render(); startAnim();
  bossAttackTimers.push(setTimeout(() => {
    bossShockwaveCells = new Set();
    if (alive && bossRound) render();
  }, 2000));
}

function bossVictory() { // [1.11]
  if (!alive || !bossRound) return;
  const cfg = BOSS_CONFIG[bossTier];
  const wasVoidKing = bossTier === 3; // [2.0-s1] capture before cleanup resets bossTier
  _cleanupBoss();
  if (currentWorld === 2) { crystals += cfg.reward; sessionCrystalsEarned += cfg.reward; } // [2.0-s1]
  else { coins += cfg.reward; sessionCoinsEarned += cfg.reward; }
  addCurrencyTotal(cfg.reward); // [2.0-s3] W1→coins stat, W2→crystals stat
  // [2.0-bossfix] boss rounds skip startRound()'s normal-round tracking block entirely (they
  // return early into startBossRound() instead), so mission/combo progress silently vanished
  // for every boss win. No addStatLasers()/mTrackLaserDodged() here on purpose — boss combat
  // doesn't have "lasers dodged" in the dash sense, and forcing it would inflate that stat.
  mTrackRoundSurvived(false); // boss round counts toward "rounds_played" for missions
  mTrackCoins(cfg.reward);
  mTrackTime(Math.round(CHARGE_START/1000) + 2); // approximate duration of the boss round
  comboCount += comboStep;
  if (comboCount > bestComboThisSession) bestComboThisSession = comboCount;
  recordBestCombo(comboCount); // [2.0-s3] per world
  save();
  if (hudTimerEl) hudTimerEl.style.display = 'none';
  flash(`BOSS DEFEATED! +${cfg.reward} ${curIcon()}`); // [2.0-s1]
  render();
  // [2.0-s1] World-1 VOID KING tears the rift — only the first time, and only from Normal/Hard (gameMode null) [2.0-s2]
  if (wasVoidKing && currentWorld === 1 && gameMode === null && !world2Unlocked) {
    world2Unlocked = true; localStorage.setItem('cm_world2_unlocked', 'true');
    phaseTimer = _schedulePhase(showWorldChoice, 2000);
  } else {
    phaseTimer = _schedulePhase(startRound, 2000);
  }
}

// ══════════════════════════════════════════════════
// [2.0-s4b] WORLD 2 BOSSES — active combat (hit-plate → turret → beam)
// ══════════════════════════════════════════════════
function startW2Boss(idx, speedMult) { // [2.0-s4b]
  if (gridlockActive) _endGridlockMode(false);
  _clearActiveMod();
  _cleanupBoss();
  blackHoleReadyAt = 0; // [2.0-s4g] teleport ready immediately at boss start
  const cfg = W2_BOSS[idx];
  w2Boss = cfg; w2SpeedMult = speedMult;
  bossRound = true; bossActive = false;
  bossHitsLeft = cfg.hits; bossShieldUntil = 0;
  bossX = Math.floor((N - cfg.size) / 2);
  bossY = Math.floor((N - cfg.size) / 2);
  lasers = []; blocks = [];
  asteroids = []; clearTimeout(asteroidTimer); asteroidTimer = null;
  if (hudTimerEl) hudTimerEl.style.display = 'none'; // no countdown — W2 is hit-based
  flash('COSMIC BOSS APPROACHES!');
  render(); startAnim();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    bossActive = true;
    _bossPushPlayer();
    flash(`${cfg.name}`);
    render();
    _w2SpawnHitPlate();
    _w2ScheduleAttacks(cfg);
    _bossPressureCount = 0; bossPressureTimer = setTimeout(_bossPressureTick, 1000); // [2.0-s4d] pressure burst in W2 too
  }, 1500));
}

function w2BossVictory() { // [2.0-s4b]
  if (!alive || !bossRound) return;
  const cfg = w2Boss;
  _cleanupBoss();
  crystals += cfg.reward; sessionCrystalsEarned += cfg.reward;
  addCurrencyTotal(cfg.reward);
  // [2.0-bossfix] same gap as bossVictory() (W1) — see the comment there. Applies to every
  // W2 boss (PULSAR/NEUTRON/SINGULARITY), not just the W1 VOID KING the bug was reported for.
  mTrackRoundSurvived(false);
  mTrackCoins(cfg.reward);
  mTrackTime(Math.round(CHARGE_START/1000) + 2);
  comboCount += comboStep;
  if (comboCount > bestComboThisSession) bestComboThisSession = comboCount;
  recordBestCombo(comboCount);
  save();
  if (hudTimerEl) hudTimerEl.style.display = 'none';
  flash(`${cfg.name} DEFEATED! +${cfg.reward} ✦`);
  render();
  phaseTimer = _schedulePhase(startRound, 2000); // resume the W2 run
}

function _w2SpawnHitPlate() { // [2.0-s4b] golden plate on a random safe cell (none while shielded)
  if (!alive || !bossRound || !w2Boss) return;
  if (Date.now() < bossShieldUntil) return;
  const bcells = getBossCells();
  for (let t = 0; t < 200; t++) {
    const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N), key = `${x},${y}`;
    if (bcells.has(key) || destroyedCells.has(key) || flareCellHas(x, y)) continue;
    if (x === cube.x && y === cube.y) continue;
    hitPlate = { x, y }; render(); return;
  }
}

function _w2OnPlayerMoved() { // [2.0-s4b] react to the player's new cell
  if (!w2Boss || !bossActive) return;
  if (destroyedCells.has(`${cube.x},${cube.y}`) && !tutorialActive) { die('asteroid'); return; } // [2.0-s4h]
  if (hitPlate && cube.x === hitPlate.x && cube.y === hitPlate.y && Date.now() >= bossShieldUntil && !turret) {
    _w2SpawnTurret();
  }
}

function _w2SpawnTurret() { // [2.0-s4b] emitter on a free adjacent cell; fixed 800ms charge (NOT speed-scaled)
  const px = hitPlate.x, py = hitPlate.y;
  const bcells = getBossCells();
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  for (let i = dirs.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [dirs[i],dirs[j]]=[dirs[j],dirs[i]]; }
  let ex = px, ey = py;
  for (const [dx,dy] of dirs) {
    const nx = px+dx, ny = py+dy, k = `${nx},${ny}`;
    if (nx>=0&&nx<N&&ny>=0&&ny<N && !bcells.has(k) && !destroyedCells.has(k)) { ex = nx; ey = ny; break; }
  }
  turret = { px, py, ex, ey, firesAt: Date.now() + 800 };
  hitPlate = null;
  playSolarFlareCharge();
  render();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound || !turret) return;
    // risky: standing on the charging plate or emitter when it fires = death
    if (!tutorialActive && // [2.0-s4h]
        ((cube.x === turret.px && cube.y === turret.py) || (cube.x === turret.ex && cube.y === turret.ey))) {
      turret = null; die('flare'); return;
    }
    playTurretFire(); // [2.0-s4e] focused beam hitting the boss (distinct from the flare sound)
    w2Beam = { ex: turret.ex, ey: turret.ey, until: Date.now() + 220 };
    turret = null;
    bossHitsLeft--;
    _bhParticles(bossX + _bossSize()/2 - 0.5, bossY + _bossSize()/2 - 0.5, false); // cosmic hit burst
    if (bossHitsLeft <= 0) { render(); startAnim(); w2BossVictory(); return; } // [2.0-s4e] no shield on the killing blow
    bossShieldUntil = Date.now() + (5000 + Math.random() * 5000); // 5–10s shield
    playBossShield(); // [2.0-s4e] barrier-up shimmer
    render(); startAnim();
    flash(`HIT! ${bossHitsLeft} to go · shield up`);
    bossAttackTimers.push(setTimeout(_w2SpawnHitPlate, bossShieldUntil - Date.now()));
  }, 800));
}

// [2.0-s4d] powerful-attack gate — spin/gravity/star/black-hole never overlap and stay ≥3s apart
function _w2PowerReady() { return Date.now() >= _w2PowerBusyUntil; }
function _w2PowerBusy(activeMs) { _w2PowerBusyUntil = Date.now() + activeMs + 3000; } // reserve attack window + 3s gap
function _w2ScheduleRepeating(fn, n, baseDelay, spread) { // schedule fn n times with staggered delays (gate serializes collisions)
  for (let i = 0; i < n; i++) bossAttackTimers.push(setTimeout(fn, baseDelay + i*spread + Math.random()*spread));
}

function _w2ScheduleAttacks(cfg) { // [2.0-s4b][2.0-s4d] arm attacks; SINGULARITY repeats each powerful attack 2–3×
  const A = cfg.attacks;
  const isSing = cfg.id === 'singularity';
  const cnt = () => 2 + (Math.random() < 0.5 ? 1 : 0); // 2 or 3
  if (A.includes('throw'))     _w2ScheduleThrow();
  if (A.includes('rain'))      _scheduleBossRain(); // reuse W1 block rain (once; not "powerful", un-gated)
  if (A.includes('spin'))      _w2ScheduleRepeating(_w2LaserSpin,      isSing ? cnt() : 1, 2500, 5000);
  if (A.includes('gravity'))   _w2ScheduleRepeating(_w2GravityPull,    isSing ? cnt() : 2, 4000, 6000);
  if (A.includes('star'))      _w2ScheduleRepeating(_w2FallingStar,    cnt(),              8000, 6000);
  if (A.includes('blackhole')) _w2ScheduleRepeating(_w2BlackHoleBlock, cnt(),              6000, 6000);
}

function _w2ScheduleThrow() { // [2.0-s4b] two random ≤5-cell block throws, slower than W1, ±20% jitter
  if (!alive || !bossRound || !w2Boss) return;
  const base = 1600 / w2SpeedMult;
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound || !w2Boss) return;
    if (!gamePaused && !_blocksPaused()) { blocks = blocks.filter(b => !b.bossThrow); _fireBossAttack(); _fireBossAttack(); render(); } // [2.0-s4e] no throws during the block-attack pause
    _w2ScheduleThrow();
  }, base * (0.8 + Math.random()*0.4)));
}

function _w2LaserSpin() { // [2.0-s4b][2.0-s4c][2.0-s4d] gated; ~0.8s charge telegraph, then rotating edge beams
  if (!alive || !bossRound || !w2Boss) return;
  if (!_w2PowerReady()) { bossAttackTimers.push(setTimeout(_w2LaserSpin, (_w2PowerBusyUntil - Date.now()) + 200 + Math.random()*400)); return; }
  const charge = 800, dur = 4500 / w2SpeedMult; // [2.0-s4c] ~40% slower → readable/dodgeable
  _w2PowerBusy(charge + dur);
  flash('LASER SPIN CHARGING!');
  const t0 = Date.now();
  w2SpinState = { chargeUntil: t0 + charge, start: t0 + charge, dur }; // [2.0-s4d] charge phase before lethal+rotating
  startAnim();
}

function _w2GravityPull() { // [2.0-s4b][2.0-s4d] gated; warn, then yank the player 5–7 cells toward the boss (undashable)
  if (!alive || !bossRound || !w2Boss) return;
  if (!_w2PowerReady()) { bossAttackTimers.push(setTimeout(_w2GravityPull, (_w2PowerBusyUntil - Date.now()) + 200 + Math.random()*400)); return; }
  _w2PowerBusy(1000);
  const now = Date.now();
  const warn = 500 / w2SpeedMult;
  w2GravityWarn = { until: now + warn };
  flash('GRAVITY PULL!');
  render(); startAnim();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound || !w2Boss) return;
    w2GravityWarn = null;
    const sz = _bossSize();
    _w2PullPlayer(bossX + sz/2, bossY + sz/2, 5 + Math.floor(Math.random()*3)); // 5–7 cells
    render();
  }, warn));
}

function _w2PullPlayer(tx, ty, cells) { // [2.0-s4c] visibly slide the player toward (tx,ty) one cell per tick (undashable)
  _w2Pulling = true; // lock input during the pull
  let remaining = cells;
  const finish = () => {
    _w2Pulling = false;
    if (getBossCells().has(`${cube.x},${cube.y}`)) _bossPushPlayer();
    render();
    _w2OnPlayerMoved(); // crater death + plate-step at the resting cell
  };
  const step = () => {
    if (!alive || !bossRound) { _w2Pulling = false; return; }
    const dx = tx - cube.x, dy = ty - cube.y;
    if (remaining <= 0 || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) { finish(); return; }
    let nx = cube.x, ny = cube.y;
    if (Math.abs(dx) >= Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
    nx = Math.max(0, Math.min(N-1, nx)); ny = Math.max(0, Math.min(N-1, ny));
    if (getBossCells().has(`${nx},${ny}`) || (nx === cube.x && ny === cube.y)) { finish(); return; } // can't go further
    cube.x = nx; cube.y = ny; spawnDashParticles(cube.x, cube.y); remaining--;
    render();
    bossAttackTimers.push(setTimeout(step, 70));
  };
  step();
}

function _w2BlackHoleBlock() { // [2.0-s4f] gated; spawns 1–3 simultaneous black-hole blocks for 5s
  if (!alive || !bossRound || !w2Boss) return;
  if (!_w2PowerReady()) { bossAttackTimers.push(setTimeout(_w2BlackHoleBlock, (_w2PowerBusyUntil - Date.now()) + 200 + Math.random()*400)); return; }
  const now = Date.now(), bcells = getBossCells();
  const k = 1 + Math.floor(Math.random() * 3); // 1, 2 or 3
  const spawned = [], until = now + 5000;
  for (let i = 0; i < k; i++) {
    for (let t = 0; t < 200; t++) {
      const x = Math.floor(Math.random()*N), y = Math.floor(Math.random()*N), key = `${x},${y}`;
      if (bcells.has(key) || destroyedCells.has(key)) continue;
      if (Math.abs(x-cube.x)+Math.abs(y-cube.y) < 3) continue;
      if (spawned.some(h => h.x === x && h.y === y)) continue;
      spawned.push({ x, y, until }); break;
    }
  }
  if (!spawned.length) return;
  w2BhBlocks = spawned;
  _w2PowerBusy(5000);
  flash('BLACK HOLE!');
  for (const h of w2BhBlocks) _bhParticles(h.x, h.y, true);
  render(); startAnim();
  bossAttackTimers.push(setTimeout(() => { w2BhBlocks = []; if (alive && bossRound) render(); }, 5000));
}

function _w2FallingStar() { // [2.0-s4b][2.0-s4d] gated; longer streak → irregular ~4×5 crater + flash + shockwave ring
  if (!alive || !bossRound || !w2Boss) return;
  if (!_w2PowerReady()) { bossAttackTimers.push(setTimeout(_w2FallingStar, (_w2PowerBusyUntil - Date.now()) + 200 + Math.random()*400)); return; }
  _w2PowerBusy(1000);
  const bcells = getBossCells();
  let ix = 8, iy = 8;
  for (let t = 0; t < 200; t++) {
    ix = 2 + Math.floor(Math.random()*(N-4)); iy = 2 + Math.floor(Math.random()*(N-4));
    if (!bcells.has(`${ix},${iy}`)) break;
  }
  flash('FALLING STAR!');
  w2Star = { sx: ix - 9, sy: iy - 15, ex: ix, ey: iy, born: Date.now(), landAt: Date.now() + 1100 }; // [2.0-s4d] longer streak
  startAnim();
  bossAttackTimers.push(setTimeout(() => {
    if (!alive || !bossRound) return;
    w2Star = null;
    // [2.0-s4d] irregular ~4×5 crater: 5 wide × 4 tall, thinned corners + random holes + scattered outliers
    for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) >= 1 && Math.random() < 0.7) continue; // thin corners
      if (Math.random() < 0.12) continue; // random holes
      const x = ix+dx, y = iy+dy;
      if (hitPlate && x === hitPlate.x && y === hitPlate.y) continue; // [2.0-s4e] never bury the active hit plate
      if (x>=0&&x<N&&y>=0&&y<N) destroyedCells.add(`${x},${y}`);
    }
    for (let k = 0; k < 2; k++) { // scattered outliers → irregular edge
      const ox = ix + Math.floor(Math.random()*5)-2, oy = iy + Math.floor(Math.random()*5)-2;
      if (hitPlate && ox === hitPlate.x && oy === hitPlate.y) continue; // [2.0-s4e]
      if (ox>=0&&ox<N&&oy>=0&&oy<N) destroyedCells.add(`${ox},${oy}`);
    }
    spawnBlockImpact(ix, iy);
    w2StarShock = { x: ix, y: iy, born: Date.now() }; // [2.0-s4d] expanding shockwave + flash
    render(); startAnim();
    if (destroyedCells.has(`${cube.x},${cube.y}`) && !tutorialActive) die('asteroid'); // [2.0-s4h]
  }, 1100));
}

function drawW2Boss(now) { // [2.0-s4b][2.0-s4c] unique per-boss body + bold shield + attack visuals
  if (!w2Boss) return;
  const sz = _bossSize();
  const px = bossX*cellSize, py = bossY*cellSize, w = sz*cellSize, h = sz*cellSize;
  const cx = px + w/2, cy = py + h/2;
  if      (w2Boss.id === 'pulsar')  _drawPulsarBody(now, px, py, w, h, cx, cy);
  else if (w2Boss.id === 'neutron') _drawNeutronBody(now, px, py, w, h, cx, cy);
  else                              _drawSingularityBody(now, px, py, w, h, cx, cy);
  if (Date.now() < bossShieldUntil) _drawW2Shield(now, px, py, w, h); // [2.0-s4c]
  _drawW2Spin(now); _drawW2Beam(now); _drawW2BhBlock(now); _drawW2Star(now); _drawW2StarShock(now); _drawW2GravityWarn(now);
}

function _drawPulsarBody(now, px, py, w, h, cx, cy) { // [2.0-s4c] cyan/white, fast pulse, radiating energy rings
  const fast = 0.5 + 0.5*Math.sin(now*0.012);
  ctx.save();
  for (let i = 0; i < 3; i++) { // expanding concentric rings
    const t = ((now / 1100) + i/3) % 1, r = w*0.5 + t*w*0.95, a = (1 - t) * 0.5;
    ctx.strokeStyle = `rgba(120,240,255,${a})`; ctx.lineWidth = 1.5 + 2*(1-t);
    ctx.shadowColor = `rgba(120,240,255,${a})`; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }
  const g = ctx.createRadialGradient(cx, cy, w*0.05, cx, cy, w*0.6);
  g.addColorStop(0, `rgba(235,255,255,${0.85+0.15*fast})`);
  g.addColorStop(0.5, 'rgba(80,220,255,0.95)');
  g.addColorStop(1, 'rgba(20,120,180,0.95)');
  ctx.shadowColor = `rgba(150,245,255,${0.7+0.3*fast})`; ctx.shadowBlur = 20 + 14*fast;
  ctx.fillStyle = g; ctx.fillRect(px+2, py+2, w-4, h-4);
  ctx.shadowBlur = 14; ctx.fillStyle = `rgba(255,255,255,${0.8+0.2*fast})`;
  ctx.beginPath(); ctx.arc(cx, cy, w*0.12*(0.8+0.4*fast), 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function _drawNeutronBody(now, px, py, w, h, cx, cy) { // [2.0-s4c] dark purple/grey, slow heavy pulse, edge distortion
  const slow = 0.5 + 0.5*Math.sin(now*0.003);
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, w*0.08, cx, cy, w*0.6);
  g.addColorStop(0, 'rgba(70,55,90,0.98)');
  g.addColorStop(0.6, 'rgba(40,30,55,0.98)');
  g.addColorStop(1, 'rgba(16,12,24,0.98)');
  ctx.shadowColor = `rgba(120,90,160,${0.5+0.3*slow})`; ctx.shadowBlur = 16 + 8*slow;
  ctx.fillStyle = g; ctx.fillRect(px+2, py+2, w-4, h-4);
  // jittered perimeter = gravitational distortion shimmer
  ctx.strokeStyle = `rgba(150,120,190,${0.5+0.3*slow})`; ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(110,80,150,0.7)'; ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const f = i / 12; const j = Math.sin(now*0.006 + i*1.7) * cellSize*0.13; let x, y;
    if      (f < 1) { x = px + f*w;         y = py + j; }
    else if (f < 2) { x = px + w + j;       y = py + (f-1)*h; }
    else if (f < 3) { x = px + w - (f-2)*w; y = py + h + j; }
    else            { x = px + j;           y = py + h - (f-3)*h; }
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 12; ctx.fillStyle = `rgba(160,140,200,${0.5+0.3*slow})`;
  ctx.beginPath(); ctx.arc(cx, cy, w*0.16, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function _drawSingularityBody(now, px, py, w, h, cx, cy) { // [2.0-s4c][2.0-s4d] defined 5×5 body + black core + violet glow + ring
  const pulse = 0.5 + 0.5*Math.sin(now*0.005), sz = _bossSize();
  ctx.save();
  // [2.0-s4d] defined body fill + bright border so the full footprint is clearly visible
  ctx.shadowColor = `rgba(150,60,255,${0.6+0.3*pulse})`; ctx.shadowBlur = 22 + 12*pulse;
  ctx.fillStyle = 'rgba(28,8,46,0.97)'; ctx.fillRect(px+2, py+2, w-4, h-4);
  ctx.shadowBlur = 12;
  ctx.strokeStyle = `rgba(185,115,255,${0.8+0.2*pulse})`; ctx.lineWidth = 3;
  ctx.strokeRect(px+2, py+2, w-4, h-4);
  // violet inner glow over the body
  const g = ctx.createRadialGradient(cx, cy, w*0.1, cx, cy, w*0.55);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, `rgba(120,40,210,${0.30+0.2*pulse})`);
  g.addColorStop(1, 'rgba(80,20,160,0)');
  ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.fillRect(px+2, py+2, w-4, h-4);
  // black core
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath(); ctx.arc(cx, cy, w*0.26, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(160,90,255,${0.6+0.3*pulse})`; ctx.lineWidth = 2; ctx.stroke();
  // rotating accretion ring
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(now*0.0016);
  ctx.strokeStyle = `rgba(190,110,255,${0.7+0.3*pulse})`; ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(170,80,255,0.9)'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.ellipse(0, 0, w*0.42, w*0.18, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (Math.random() < 0.12) _bhParticles(bossX + sz/2 - 0.5, bossY + sz/2 - 0.5, true); // particles sucked inward
}

function _drawW2Shield(now, px, py, w, h) { // [2.0-s4c] bold pulsing multi-layer purple barrier — impossible to miss
  const sp = 0.5 + 0.5*Math.sin(now*0.009);
  const grow = Math.abs(Math.sin(now*0.006)) * cellSize*0.2; // breathing expansion
  ctx.save();
  ctx.shadowColor = `rgba(170,90,255,${0.85+0.15*sp})`; ctx.shadowBlur = 26 + 14*sp;
  ctx.strokeStyle = `rgba(195,125,255,${0.85+0.15*sp})`; ctx.lineWidth = 6;
  ctx.strokeRect(px - 4 - grow, py - 4 - grow, w + 8 + grow*2, h + 8 + grow*2);
  ctx.shadowBlur = 14;
  ctx.strokeStyle = `rgba(235,205,255,${0.7+0.3*sp})`; ctx.lineWidth = 2.5;
  ctx.strokeRect(px - 1, py - 1, w + 2, h + 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(150,80,255,${0.10 + 0.07*sp})`;
  ctx.fillRect(px - 3, py - 3, w + 6, h + 6);
  ctx.restore();
}

function _drawW2Spin(now) { // [2.0-s4b][2.0-s4d] charge telegraph → rotating beams from the boss EDGES (no center X)
  if (!w2SpinState || !w2Boss) return;
  const sz = _bossSize();
  const cx = (bossX + sz/2)*cellSize, cy = (bossY + sz/2)*cellSize;
  const R = sz*cellSize*0.62, maxLen = N*cellSize*1.5; // beams start just outside the boss → no crossing
  const charging = now < w2SpinState.chargeUntil;
  if (!charging && (now - w2SpinState.start) >= w2SpinState.dur) { w2SpinState = null; w2SpinCells = new Set(); return; }
  const baseAng = charging ? 0 : ((now - w2SpinState.start) / w2SpinState.dur) * Math.PI * 2; // fixed during charge
  const pulse = 0.4 + 0.35*Math.abs(Math.sin(now*0.02));
  w2SpinCells = new Set();
  ctx.save();
  ctx.shadowColor = 'rgba(180,80,255,0.9)'; ctx.shadowBlur = 14;
  for (let k = 0; k < 4; k++) {
    const ang = baseAng + k*Math.PI/2;
    ctx.strokeStyle = charging ? `rgba(255,210,80,${pulse*0.55})` : 'rgba(255,210,80,0.9)'; // semi-transparent while charging
    ctx.lineWidth = cellSize*(charging ? 0.4 : 0.5);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang)*R, cy + Math.sin(ang)*R);
    ctx.lineTo(cx + Math.cos(ang)*maxLen, cy + Math.sin(ang)*maxLen);
    ctx.stroke();
    if (!charging) { // lethal only after the charge phase
      for (let dd = R; dd < maxLen; dd += cellSize*0.4) {
        const gx = Math.floor((cx + Math.cos(ang)*dd)/cellSize), gy = Math.floor((cy + Math.sin(ang)*dd)/cellSize);
        if (gx < 0 || gx >= N || gy < 0 || gy >= N) break;
        w2SpinCells.add(`${gx},${gy}`);
      }
    }
  }
  ctx.restore();
  if (!charging && !tutorialActive && w2SpinCells.has(`${cube.x},${cube.y}`)) die('flare'); // [2.0-s4h]
  startAnim();
}

function _drawW2Beam(now) { // [2.0-s4b] brief turret→boss beam after a hit
  if (!w2Beam || !w2Boss) return;
  if (Date.now() > w2Beam.until) { w2Beam = null; return; }
  const sz = _bossSize();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,230,120,0.95)'; ctx.lineWidth = cellSize*0.35;
  ctx.shadowColor = 'rgba(255,180,60,0.9)'; ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo((w2Beam.ex+0.5)*cellSize, (w2Beam.ey+0.5)*cellSize);
  ctx.lineTo((bossX+sz/2)*cellSize, (bossY+sz/2)*cellSize);
  ctx.stroke();
  ctx.restore();
  startAnim();
}

function _drawW2BhBlock(now) { // [2.0-s4f] swirling black-hole blocks (1–3 simultaneous)
  if (!w2BhBlocks.length) return;
  w2BhBlocks = w2BhBlocks.filter(h => now < h.until);
  const pulse = 0.5+0.5*Math.sin(now*0.01);
  for (const h of w2BhBlocks) {
    const cx = (h.x+0.5)*cellSize, cy = (h.y+0.5)*cellSize;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, cellSize*0.55);
    g.addColorStop(0,'rgba(8,0,18,1)'); g.addColorStop(0.7,'rgba(120,40,200,0.85)'); g.addColorStop(1,'rgba(120,40,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cellSize*0.55, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = `rgba(200,140,255,${0.6+0.4*pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, cellSize*0.4, now*0.006, now*0.006 + Math.PI*1.5); ctx.stroke();
    ctx.restore();
  }
  if (w2BhBlocks.length) startAnim();
}

function _drawW2Star(now) { // [2.0-s4b] falling-star streak + impact target warning
  if (!w2Star) return;
  const span = w2Star.landAt - w2Star.born;
  const cl = Math.min(1, Math.max(0, (Date.now() - w2Star.born) / span));
  const gx = w2Star.sx + (w2Star.ex - w2Star.sx)*cl, gy = w2Star.sy + (w2Star.ey - w2Star.sy)*cl;
  const cx = (gx+0.5)*cellSize, cy = (gy+0.5)*cellSize;
  ctx.save();
  for (let k = 1; k <= 12; k++) { // [2.0-s4d] longer, brighter trail
    const tx = (gx - (w2Star.ex-w2Star.sx)*0.035*k + 0.5)*cellSize, ty = (gy - (w2Star.ey-w2Star.sy)*0.035*k + 0.5)*cellSize;
    ctx.globalAlpha = 0.30*(1 - k/13); ctx.fillStyle = 'rgba(255,210,120,1)';
    ctx.beginPath(); ctx.arc(tx, ty, cellSize*0.34*(1 - k/14), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(255,180,60,1)'; ctx.shadowBlur = 20; ctx.fillStyle = 'rgba(255,245,200,1)';
  ctx.beginPath(); ctx.arc(cx, cy, cellSize*0.36, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  const blink = 0.4 + 0.6*Math.abs(Math.sin(now*0.012));
  ctx.save(); ctx.globalAlpha = blink; ctx.strokeStyle = 'rgba(255,80,40,1)'; ctx.lineWidth = 2;
  ctx.strokeRect(w2Star.ex*cellSize+2, w2Star.ey*cellSize+2, cellSize-4, cellSize-4);
  ctx.restore();
  startAnim();
}

function _drawW2StarShock(now) { // [2.0-s4d] bright impact flash + expanding shockwave ring (~600ms)
  if (!w2StarShock) return;
  const age = Date.now() - w2StarShock.born;
  if (age > 600) { w2StarShock = null; return; }
  const t = age / 600; // 0→1
  const cx = (w2StarShock.x+0.5)*cellSize, cy = (w2StarShock.y+0.5)*cellSize;
  ctx.save();
  if (t < 0.2) { // bright white flash at the very start
    ctx.globalAlpha = (1 - t/0.2) * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.shadowColor = 'rgba(255,220,140,1)'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(cx, cy, cellSize*1.1, 0, Math.PI*2); ctx.fill();
  }
  // expanding ring
  ctx.globalAlpha = (1 - t) * 0.85;
  ctx.strokeStyle = 'rgba(255,190,90,1)'; ctx.lineWidth = cellSize*0.3*(1 - t) + 1;
  ctx.shadowColor = 'rgba(255,150,40,1)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(cx, cy, cellSize*(0.4 + t*4.5), 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  startAnim();
}

function _drawW2GravityWarn(now) { // [2.0-s4c] bold pulsing arrows + player highlight during the pull telegraph
  if (!w2GravityWarn || !w2Boss) return;
  if (Date.now() > w2GravityWarn.until) { w2GravityWarn = null; return; }
  const sz = _bossSize();
  const pcx = (cube.x+0.5)*cellSize, pcy = (cube.y+0.5)*cellSize;
  const ang = Math.atan2((bossY+sz/2)*cellSize - pcy, (bossX+sz/2)*cellSize - pcx);
  const beat = 0.45 + 0.55*Math.abs(Math.sin(now*0.014));
  ctx.save();
  // pulsing highlight ring on the player's cell — "you are caught"
  ctx.globalAlpha = beat;
  ctx.strokeStyle = 'rgba(200,130,255,1)'; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(160,80,255,1)'; ctx.shadowBlur = 14;
  ctx.strokeRect(cube.x*cellSize+2, cube.y*cellSize+2, cellSize-4, cellSize-4);
  // three chevrons marching from the player toward the boss
  ctx.lineWidth = 4; ctx.shadowBlur = 12;
  const march = ((now*0.004) % 1) * cellSize*0.6; // animate the chevrons sliding toward the boss
  for (let k = 0; k < 3; k++) {
    const d = cellSize*(0.9 + k*0.85) + march;
    const ax = pcx + Math.cos(ang)*d, ay = pcy + Math.sin(ang)*d;
    ctx.globalAlpha = beat * (1 - k*0.22);
    ctx.strokeStyle = 'rgba(210,150,255,1)';
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(ang-0.5)*cellSize*0.45, ay - Math.sin(ang-0.5)*cellSize*0.45);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax - Math.cos(ang+0.5)*cellSize*0.45, ay - Math.sin(ang+0.5)*cellSize*0.45);
    ctx.stroke();
  }
  ctx.restore();
  startAnim();
}
function drawBoss(tier, now) { // [1.11] uses global ctx directly
  const cfg = BOSS_CONFIG[tier];
  const px  = bossX * cellSize, py = bossY * cellSize; // [2.0-s4] live position
  const w   = cfg.size  * cellSize, h  = cfg.size  * cellSize;
  const cx2 = px + w / 2,          cy2 = py + h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (tier === 1) { // ── SENTINEL — red/orange, angular ──
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.013);
    ctx.shadowColor = `rgba(255,80,0,${0.8 + 0.2 * flicker})`;
    ctx.shadowBlur  = 20 + 12 * flicker;
    ctx.fillStyle   = `rgba(160,20,0,0.95)`;
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    ctx.strokeStyle = `rgba(255,${Math.floor(80 + 80 * flicker)},0,1)`;
    ctx.lineWidth   = 3;
    ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = `rgba(255,160,40,${0.6 + 0.4 * pulse})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(cx2, py + 6);     ctx.lineTo(cx2, py + h - 6);
    ctx.moveTo(px + 6, cy2);     ctx.lineTo(px + w - 6, cy2);
    ctx.stroke();
    const cs = 8;
    ctx.strokeStyle = `rgba(255,100,0,${0.8 + 0.2 * pulse})`;
    ctx.lineWidth   = 2;
    [[px+2,py+2,1,1],[px+w-2,py+2,-1,1],[px+2,py+h-2,1,-1],[px+w-2,py+h-2,-1,-1]]
      .forEach(([bx,by,sx,sy]) => {
        ctx.beginPath();
        ctx.moveTo(bx + sx*cs, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy*cs);
        ctx.stroke();
      });

  } else if (tier === 2) { // ── PHANTOM — purple/cyan, spinning ──
    const rot = (now * 0.002) % (Math.PI * 2);
    ctx.shadowColor = `rgba(200,0,255,${0.6 + 0.4 * pulse})`;
    ctx.shadowBlur  = 22 + 10 * pulse;
    ctx.fillStyle   = `rgba(60,0,100,0.95)`;
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    // spinning outer rect
    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate(rot);
    ctx.shadowColor = `rgba(200,0,255,${0.7 + 0.3 * pulse})`;
    ctx.shadowBlur  = 16 + 8 * pulse;
    ctx.strokeStyle = `rgba(200,0,255,${0.8 + 0.2 * pulse})`;
    ctx.lineWidth   = 3;
    const s1 = w / 2 - 4;
    ctx.strokeRect(-s1, -s1, s1 * 2, s1 * 2);
    // inner diamond
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = `rgba(0,200,255,${0.5 + 0.5 * pulse})`;
    ctx.strokeStyle = `rgba(0,200,255,${0.7 + 0.3 * pulse})`;
    ctx.lineWidth   = 2;
    const s2 = w / 2 - 14;
    ctx.strokeRect(-s2, -s2, s2 * 2, s2 * 2);
    ctx.restore();
    // center dot (absolute coords)
    ctx.shadowColor = 'rgba(220,100,255,0.9)';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = `rgba(220,100,255,${0.8 + 0.2 * pulse})`;
    ctx.beginPath(); ctx.arc(cx2, cy2, 6, 0, Math.PI * 2); ctx.fill();

  } else { // ── VOID KING — black core, gold rings ──
    ctx.shadowColor = 'rgba(255,215,0,0.6)';
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = 'rgba(0,0,0,0.97)';
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    const rings = [
      { inset:  3, col: '255,215,0',   alpha: 0.7 + 0.3*pulse,  lw: 3   },
      { inset: 12, col: '255,255,255', alpha: 0.4 + 0.2*pulse,  lw: 1.5 },
      { inset: 21, col: '255,215,0',   alpha: 0.6 + 0.3*pulse,  lw: 2   },
    ];
    for (const rd of rings) {
      const r = w / 2 - rd.inset;
      ctx.shadowColor = `rgba(${rd.col},${rd.alpha})`;
      ctx.shadowBlur  = 18;
      ctx.strokeStyle = `rgba(${rd.col},${rd.alpha})`;
      ctx.lineWidth   = rd.lw;
      ctx.strokeRect(cx2 - r, cy2 - r, r * 2, r * 2);
    }
    // spinning spokes
    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate((now * 0.0008) % (Math.PI * 2));
    ctx.shadowColor = 'rgba(255,215,0,0.7)';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + 0.4*pulse})`;
    ctx.lineWidth   = 1.5;
    const spokeLen  = w / 2 - 24;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * spokeLen, Math.sin(a) * spokeLen);
      ctx.stroke();
    }
    ctx.restore();
    // center glow
    const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, w * 0.14);
    cg.addColorStop(0, `rgba(255,215,0,${0.9 + 0.1*pulse})`);
    cg.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = cg;
    ctx.beginPath(); ctx.arc(cx2, cy2, w * 0.14, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
  ctx.shadowBlur = 0;
}
