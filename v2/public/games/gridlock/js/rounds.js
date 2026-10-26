// [MODULE] The core game loop for BOTH worlds - startRound, die, death checks, round modifiers, GRIDLOCK.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// ROUNDS
// ══════════════════════════════════════════════════
function _schedulePhase(fn, ms) { // [1.10.2] tracks the pending phase so pause/resume can restore it
  _phaseFn = fn;
  _phaseFiresAt = Date.now() + ms;
  return setTimeout(fn, ms);
}

// ══════════════════════════════════════════════════
// [2.0-s3] ROUND RANDOMIZER — one-round modifiers
// ══════════════════════════════════════════════════

// [2.0-s3.4] Grid Glitch — jagged lightning bolt across the board at a random angle (cosmetic only).
// Two slabs share the jagged seam and offset in opposite, bolt-perpendicular directions (displaced
// halves); a bright SVG polyline traces the bolt. Shape is fixed for the modifier's whole duration.
function _setBoardTear() {
  const wrap = document.getElementById('board-wrap');
  if (!wrap) return;
  const vertical = Math.random() < 0.5;          // true: bolt runs top→bottom (splits L/R)
  const K = 6 + Math.floor(Math.random()*3);     // 6–8 jagged interior vertices
  const a0 = 25 + Math.random()*50;              // entry cross-coord (%)
  const a1 = 25 + Math.random()*50;              // exit  cross-coord (%) — random ends ⇒ never a clean 45°
  const jit = 11;                                // perpendicular jitter amplitude (%)
  const pts = [];                                // ordered edge→opposite-edge, {x,y} in 0–100
  for (let i = 0; i <= K+1; i++) {
    const t = i / (K+1);
    const main = t * 100;                                          // along the crossing axis
    let cross = a0 + (a1 - a0) * t;                                // linear base across the board
    if (i > 0 && i <= K) cross += (Math.random()*2 - 1) * jit;     // jitter interior vertices only
    cross = Math.max(4, Math.min(96, cross));
    pts.push(vertical ? { x:cross, y:main } : { x:main, y:cross });
  }
  const poly = arr => arr.map(p => `${p.x.toFixed(1)}% ${p.y.toFixed(1)}%`).join(', ');
  let aPts, bPts, ox, oy;
  if (vertical) {                                // halves = left / right; pull apart horizontally
    aPts = [{x:0,y:0},   ...pts, {x:0,y:100}];
    bPts = [{x:100,y:0}, ...pts, {x:100,y:100}];
    ox = '6.25%'; oy = '0%';                      // 1 cell width (100%/16) — clearly visible split
  } else {                                       // halves = top / bottom; pull apart vertically
    aPts = [{x:0,y:0},   ...pts, {x:100,y:0}];
    bPts = [{x:0,y:100}, ...pts, {x:100,y:100}];
    ox = '0%'; oy = '6.25%';                      // 1 cell height
  }
  wrap.style.setProperty('--tear-a', `polygon(${poly(aPts)})`);
  wrap.style.setProperty('--tear-b', `polygon(${poly(bPts)})`);
  wrap.style.setProperty('--tear-ox', ox);
  wrap.style.setProperty('--tear-oy', oy);
  const line = document.getElementById('bolt-line');             // bright seam traces the bolt
  if (line) line.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  boardTear = { vertical, points: pts };
}
let _boltStrikeTimer = null; // [2.0-s3.4]
function _boltStrike() { // [2.0-s3.4] one-shot screen shake — "lightning strikes the board"
  const wrap = document.getElementById('board-wrap');
  if (!wrap) return;
  wrap.classList.remove('bolt-strike'); void wrap.offsetWidth; // restart the animation
  wrap.classList.add('bolt-strike');
  clearTimeout(_boltStrikeTimer);
  _boltStrikeTimer = setTimeout(() => wrap.classList.remove('bolt-strike'), 480);
}
function _clearBoardTear() { // [2.0-s3.4]
  boardTear = null;
  const wrap = document.getElementById('board-wrap');
  if (wrap) {
    wrap.classList.remove('board-tear', 'bolt-strike');
    wrap.style.removeProperty('--tear-a'); wrap.style.removeProperty('--tear-b');
    wrap.style.removeProperty('--tear-ox'); wrap.style.removeProperty('--tear-oy');
  }
  const line = document.getElementById('bolt-line');
  if (line) line.setAttribute('points', '');
}

function _pickRoundMod() { // weighted random — favors BUFF/COSMETIC, CHALLENGE rare
  const total = ROUND_MODS.reduce((s,m)=>s+m.weight,0);
  let r = Math.random() * total;
  for (const m of ROUND_MODS) { if ((r -= m.weight) < 0) return m; }
  return ROUND_MODS[0];
}

function _tickRoundMod() { // [2.0-s3.1] per-round factor reset + multi-round duration handling
  roundCoinMult = 1; roundSpeedMult = 1; comboStep = 1; // reset per-round factors
  if (activeMod) {
    _modRoundsLeft--;
    if (_modRoundsLeft <= 0) { activeMod.onEnd(); activeMod = null; _roundsSinceMod = 0; } // cooldown counts from end
    else activeMod.onStart(); // re-apply effect for this round
  } else _roundsSinceMod++;
}

function _activateRoundMod(mod) { // [2.0-s3.1] shared by auto-roll and tester trigger
  activeMod = mod;
  _modRoundsLeft = 2 + Math.floor(Math.random()*2); // 2 or 3 rounds
  mod.onStart();
  showModBanner(mod, _modRoundsLeft);
}

function _clearActiveMod() { // [2.0-s3.1] force-end any active modifier (boss/GRIDLOCK onset)
  if (activeMod) { activeMod.onEnd(); activeMod = null; _roundsSinceMod = 0; }
  _modRoundsLeft = 0; roundCoinMult = 1; roundSpeedMult = 1; comboStep = 1;
}

function _resetRoundMods() { // [2.0-s3] full reset on game start / death
  if (activeMod) { activeMod.onEnd(); activeMod = null; }
  roundCoinMult = 1; roundSpeedMult = 1; comboStep = 1; _roundsSinceMod = 99; _modRoundsLeft = 0; // [2.0-s3.1]
  _clearBoardTear(); // [2.0-s3.2]
}

function _maybeStartRoundMod() { // [2.0-s3] called from startRound after the boss intercept
  if (activeMod) return; // [2.0-s3.1] one at a time
  const eligible = gameMode === null && !bossRound && !gridlockActive
    && round > 3 && _roundsSinceMod >= 4 && Math.random() < 0.15; // [2.0-s3.1] cooldown 2→4
  if (!eligible) return;
  _activateRoundMod(_pickRoundMod());
}

let _modBannerTimer = null;
function showModBanner(mod, duration) { // [2.0-s3] brief center banner naming the modifier
  const el = document.getElementById('round-mod-banner');
  if (!el) return;
  el.innerHTML = `<div class="rmb-name">${mod.name}! (${duration} round${duration>1?'s':''})</div><div class="rmb-hint">${mod.hint}</div>`; // [2.0-s3.1] show duration [2.0-deemoji]
  el.classList.remove('show'); void el.offsetWidth; // restart animation
  el.classList.add('show');
  const wrap = document.getElementById('board-wrap');
  if (wrap) { wrap.classList.add('mod-flash'); setTimeout(() => wrap.classList.remove('mod-flash'), 400); }
  clearTimeout(_modBannerTimer);
  _modBannerTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

// ══════════════════════════════════════════════════
// GRIDLOCK MODE // [1.12]
// ══════════════════════════════════════════════════

function _endGridlockMode(natural) { // [1.12]
  if (!gridlockActive) return;
  gridlockActive = false; gridlockRoundsLeft = 0;
  clearInterval(_glitchTimer); _glitchTimer = null;
  const wrap = document.getElementById('board-wrap');
  if (wrap) wrap.classList.remove('gridlock-glitch-fx');
  if (hudGridlock) hudGridlock.style.display = 'none';
  if (natural) { flash('GRIDLOCK END'); playGridlockEnd(); }
}

function showGridlockEntry() { // [1.12]
  flash('GRIDLOCK MODE!');
  const wrap = document.getElementById('board-wrap');
  if (wrap) {
    wrap.classList.add('gridlock-entry-flash');
    setTimeout(() => wrap.classList.remove('gridlock-entry-flash'), 250);
  }
}

function activateGridlockMode() { // [1.12]
  if (!alive || bossActive) return;
  _clearActiveMod(); // [2.0-s3.1] a round modifier can't bleed into GRIDLOCK
  gridlockActive = true; gridlockRoundsLeft = 5;
  showGridlockEntry();
  playGridlockStart();
  clearInterval(_glitchTimer);
  _glitchTimer = setInterval(() => {
    if (!gridlockActive) { clearInterval(_glitchTimer); _glitchTimer = null; return; }
    const wrap = document.getElementById('board-wrap');
    if (wrap) { wrap.classList.add('gridlock-glitch-fx'); setTimeout(() => wrap.classList.remove('gridlock-glitch-fx'), 130); }
  }, 500);
  if (hudGridlock) { hudGridlock.style.display = ''; hudGridlockVal.textContent = `GRIDLOCK x${gridlockRoundsLeft}`; } // [2.0-deemoji]
}
function startRound() {
  if (!alive) return;
  if (bossActive) return; // [1.11] stale timer guard — never spawn lasers during active boss
  _freezeVirtTime();
  clearTimeout(phaseTimer); round++; dashesLeft=2;
  roundLasersDodgedByDash = 0; _roundDodgedKeys.clear(); // [2.0-w1fix]
  _tickRoundMod(); // [2.0-s3.1] tick modifier duration + reset/re-apply per-round factors
  if (blackHoleCooldown > 0) blackHoleCooldown--; // [2.0-s2] BH cooldown ticks per round
  if (_asteroidsEnabled() && !asteroidTimer && !bossRound) scheduleAsteroid(); // [2.0-s2][2.0-s3.1] re-arm after boss

  // [1.12] GRIDLOCK MODE round tracking
  if (gridlockActive) {
    gridlockRoundsLeft--;
    if (gridlockRoundsLeft <= 0) _endGridlockMode(true);
    else if (hudGridlockVal) hudGridlockVal.textContent = `GRIDLOCK x${gridlockRoundsLeft}`; // [2.0-deemoji]
  } else if (comboCount >= 20 && comboCount % 20 === 0 && !bossActive) {
    activateGridlockMode();
  }

  if (gameMode === null && currentWorld === 1 && BOSS_ROUNDS.includes(round)) { // [2.0-s4][2.0-s4e] W1 bosses at 20/40/60
    const tier = round === 20 ? 1 : round === 40 ? 2 : 3;
    startBossRound(tier);
    return;
  }
  if (gameMode === null && currentWorld === 2 && round % 20 === 0) { // [2.0-s4b][2.0-s4e] W2 bosses: 20/40/60 then every 20, cycling+faster
    const n = round / 20, idx = (n - 1) % 3, cycle = Math.floor((n - 1) / 3);
    startW2Boss(idx, Math.min(1 + 0.1 * cycle, 2)); // +10% attack speed per cycle, capped at 2×
    return;
  }

  _maybeStartRoundMod(); // [2.0-s3] possibly roll a one-round modifier (after boss intercept)

  lasers=[];
  if (_lasersEnabled()) _genLasers(Math.min(round+1+(gameMode==='timeattack'?2:0),MAX_LASERS)); // [1.10][2.0-s3.2]

  if (_blocksEnabled()) generateBlocks(); else blocks = []; // [2.0-s3.1] no blocks in W2 (or per Custom Game)
  const speedMult = (hardMode ? 0.625 : gameMode==='timeattack' ? 0.8 : 1) / roundSpeedMult; // [1.10][2.0-s3] roundSpeedMult>1 = faster obstacles
  const charge = CHARGE_START * speedMult;
  const firems = FIRE_MS * speedMult;
  const gapms  = GAP_MS  * speedMult;
  if (currentWorld === 2) { _flareChargeStart = Date.now(); _flareChargeDur = charge; } // [2.0-s2] solar flare charge anim
  render();
  flash(`Round ${round}${hardMode?' (HARD)':''} — dodge!`); // [1.9]
  if (currentWorld === 2) playSolarFlareCharge(); else playSound('laser_charge'); // [2.0-s2]

  phaseTimer=_schedulePhase(()=>{ // [1.10.2]
    if (bossActive) return; // [1.11] stale timer guard — never fire lasers during boss
    for (const L of lasers) L.state='fire';
    if (currentWorld === 2) { _flareFireStart = Date.now(); _flareFireDur = firems; } // [2.0-s2] solar flare release anim
    for (const b of blocks) { b.state='land'; spawnBlockImpact(b.x,b.y); }
    render(); flash('FIRE!'); // [1.9]
    if (currentWorld === 2) playSolarFlareRelease(); else playSound('laser_fire'); // [2.0-s2]
    checkDeathByLaser(); checkDeathByBlock();
    phaseTimer=_schedulePhase(()=>{ // [1.10.2]
      if (!alive || bossActive) return; // [1.11] stale timer guard; was: if (!alive) return
      const _baseEarned = hardMode ? 3 : 1;
      const earned = Math.round(_baseEarned * (gridlockActive ? 2 : 1) * roundCoinMult); // [1.12][2.0-s3] gridlock ×2 + round modifier mult
      if (currentWorld === 2) { crystals += earned; sessionCrystalsEarned += earned; } // [2.0-s1]
      else { coins += earned; sessionCoinsEarned += earned; }
      save(); lasers=[]; blocks=[];
      mTrackRoundSurvived(false);
      mTrackCoins(earned);
      mTrackTime(Math.round(CHARGE_START/1000) + 2); // ~duration of one round in seconds
      mTrackLaserDodged();
      // [1.9.2] Extended stats — [2.0-s3] routed per world
      addStatLasers(roundLasersDodgedByDash); // [2.0-w1fix] beams actually dashed over, not every beam that spawned
      addCurrencyTotal(earned); // W1 → cm_stat_coins_total, W2 → cm_world2_stat_crystals_total
      // [1.9.2] Combo
      comboCount += comboStep; // [2.0-s3] combo_boost modifier raises step
      if (comboCount > bestComboThisSession) bestComboThisSession = comboCount;
      recordBestCombo(comboCount); // [2.0-s3] per world
      if (comboCount >= 5 && comboCount % 5 === 0) {
        const _baseBonus = Math.floor(comboCount / 5);
        const bonus = _baseBonus * (gridlockActive ? 2 : 1); // [1.12] 2x in GRIDLOCK
        if (currentWorld === 2) { crystals += bonus; sessionCrystalsEarned += bonus; } // [2.0-s1]
        else { coins += bonus; sessionCoinsEarned += bonus; }
        addCurrencyTotal(bonus); // [2.0-s3] W1→coins stat, W2→crystals stat
        save();
        const comboLevel = comboCount >= 20 ? 3 : comboCount >= 10 ? 2 : 1; // [1.9.2]
        playCombo(comboLevel); // [1.9.2]
        showComboFlash(comboCount, bonus); // [1.9.2]
      }
      playSound('coin');
      render(); flash(`✓ Survived! +${earned} ${curIcon()}${gridlockActive?' ×2':''}`); // [1.9][1.12][2.0-s1]
      phaseTimer=_schedulePhase(startRound, gapms); // [1.10.2]
    }, firems);
  }, charge);
}

// [2.0-s2] Solar Flares are 2-cell-wide lasers in World 2. Covered row/col indices:
function laserIdxs(L) {
  if (currentWorld === 2) {
    const i2 = L.idx === N - 1 ? L.idx - 1 : L.idx + 1;
    return [L.idx, i2];
  }
  return [L.idx];
}
// [2.0-s2] true if cell (x,y) lies in any current flare/laser band (used by black-hole validation)
function flareCellHas(x, y) {
  for (const L of lasers) {
    const idxs = laserIdxs(L);
    if (L.type === 'row' && idxs.includes(y)) return true;
    if (L.type === 'col' && idxs.includes(x)) return true;
  }
  return false;
}
function checkDeathByLaser() {
  if (bossActive) return; // [1.11] stale timer guard
  if (tutorialActive) return; // [2.0-s4h]
  if (blackHoleAnimating) return; // [2.0-s2] invincible mid-teleport
  for (const L of lasers) {
    if (L.state!=='fire') continue;
    const idxs = laserIdxs(L); // [2.0-s2] 2-wide in World 2
    if (L.type==='row'&&idxs.includes(cube.y)) return die('laser');
    if (L.type==='col'&&idxs.includes(cube.x)) return die('laser');
  }
}
function checkDeathByBlock() {
  if (tutorialActive) return; // [2.0-s4h]
  for (const b of blocks)
    if (b.state==='land'&&b.x===cube.x&&b.y===cube.y) return die('block'); // [1.9]
}

// [2.0-w1fix] New record ⇒ +200% of what the run earned, so the player walks away with 3× the payout.
// Folded back into sessionCoinsEarned/sessionCrystalsEarned so the death-overlay counter shows the full total.
// [2.0-ads] With the rewarded revive, one game can reach die() twice, and the second death would
// otherwise compute its bonus off a session total that already contains the first bonus — paying a
// bonus on a bonus. So the payout is expressed as a target ("total bonus this game = 2× raw
// earnings") and only the shortfall is handed over. Without a revive _recBonusPaidThisGame is 0 and
// this reduces to exactly the old bonus = base * 2.
function _awardRecordBonus() {
  const total = currentWorld === 2 ? sessionCrystalsEarned : sessionCoinsEarned;
  const raw   = total - _recBonusPaidThisGame;
  const bonus = raw * 2 - _recBonusPaidThisGame;
  if (bonus <= 0) return 0;
  if (currentWorld === 2) { crystals += bonus; sessionCrystalsEarned += bonus; }
  else                    { coins    += bonus; sessionCoinsEarned    += bonus; }
  _recBonusPaidThisGame += bonus;
  addCurrencyTotal(bonus); // keep the lifetime stat consistent with the wallet
  return bonus;
}

// [2.0-clarity] The earnings block on the game-over screen, as an itemised sum that adds up on
// screen instead of two numbers the player has to reconcile. #_dc stays the animated total, so
// animateCounter keeps working unchanged. With no record bonus it collapses to a single row.
// [2.0-ads] adBonus is the rewarded-ad doubling (js/ads-rewards.js), added as its own row so the
// column still adds up on screen. The multiplier is derived from base rather than hardcoded to 3×,
// because with both bonuses the total genuinely is 6× the base — a stale "3×" over a doubled total
// would be the one number on this screen the player could catch out.
function _earnRows(recBonus, adBonus = 0) {
  const label = currentWorld === 2 ? 'Crystals' : 'Coins';
  const total = currentWorld === 2 ? sessionCrystalsEarned : sessionCoinsEarned;
  const base  = total - recBonus - adBonus;
  if (recBonus <= 0 && adBonus <= 0) {
    return `<div class="death-earn" id="death-earn-block"><div class="de-row de-total">`
         + `<span>${label} earned</span><b>+<span id="_dc">0</span> ${curIcon()}</b></div></div>`;
  }
  const mult = base > 0 ? Math.round(total / base) : 0;
  return `<div class="death-earn" id="death-earn-block">`
       + `<div class="de-row"><span>${label} earned</span><b>+${base}</b></div>`
       + (recBonus > 0 ? `<div class="de-row de-bonus"><span>Record bonus</span><b>+${recBonus}</b></div>` : '')
       + (adBonus  > 0 ? `<div class="de-row de-bonus de-ad"><span>Ad bonus ×2</span><b>+${adBonus}</b></div>` : '')
       + `<div class="de-row de-total"><span>Total${mult > 1 ? ` <em>${mult}×</em>` : ''}</span>`
       + `<b>+<span id="_dc">0</span> ${curIcon()}</b></div>`
       + `</div>`;
}

function _timeAttackOver() { // [1.10]
  if (!alive) return;
  alive = false; lastTime = (_virtMs() / 1000).toFixed(1); // [1.10.2-fix]
  clearTimeout(phaseTimer);
  gamePaused = false; // [2.0-notester] a death always thaws the game
  if (hudTimerEl) { hudTimerVal.textContent = '0s'; hudTimerEl.classList.add('urgent'); } // [2.0-deemoji]
  const _newRecord = round > bestTimeAttack;
  if (_newRecord) { bestTimeAttack = round; localStorage.setItem('cm_best_timeattack', bestTimeAttack); }
  if (_newRecord) playRecord();
  const _recBonus = _newRecord ? _awardRecordBonus() : 0; // [2.0-w1fix]
  _lastRecBonus = _recBonusPaidThisGame; // [2.0-ads] no revive in Time Attack, so this equals _recBonus
  if (currentWorld === 2) w2Games++; else gamesPlayed++; // [2.0-s3] per world
  save();
  const titleEl = document.getElementById('death-title');
  if (titleEl) titleEl.textContent = "TIME'S UP!";
  setTimeout(() => {
    _resetDeathAdButtons(); // [2.0-ads] no ads on this path — make sure none linger from a past death
    deathStats.innerHTML =
      `Time Attack — 60 seconds<br>`+ // [2.0-deemoji]
      `${bestComboThisSession >= 5 ? 'Best combo: <b>x'+bestComboThisSession+'</b><br>' : ''}`+
      `<br>Rounds: <b><span id="_dr">0</span></b><br>`+
      _earnRows(_recBonus)+ // [2.0-clarity] same itemised sum as the main game-over screen
      `Best (Time Attack): <b>${bestTimeAttack} rounds</b>`;
    deathOverlay.classList.add('show');
    animateCounter('_dr', round, 520);
    animateCounter('_dc', sessionCoinsEarned, 520);
    document.getElementById('btn-retry').style.display = '';
  }, 400);
}

function die(reason) {
  if (tutorialActive) return; // [2.0-s4h] tutorial: player is immortal (single robust funnel)
  // [2.0-ads] One death, one die(). Already reachable twice today: startRound()'s fire phase runs
  // `checkDeathByLaser(); checkDeathByBlock();` as two statements, so a laser death is followed by a
  // block death on the same frame, double-counting gamesPlayed and paying the record bonus twice.
  // The rewarded revive makes that path routine, so the guard is load-bearing now.
  if (!alive) return;
  if (bossRound) _cleanupBoss(); // [1.11]
  if (gridlockActive) _endGridlockMode(false); // [1.12]
  _resetRoundMods(); // [2.0-s3]
  asteroids = []; clearTimeout(asteroidTimer); asteroidTimer = null; _resetBlackHole(); // [2.0-s2]
  alive=false; lastTime=(_virtMs()/1000).toFixed(1); // [1.10.2-fix]
  cgGameplayStop(); // [2.0-sdk] below the sandbox/tutorial early-returns, so only a real death
  clearTimeout(phaseTimer);
  gamePaused = false; // [2.0-notester] a death always thaws the game
  playSound('die');
  spawnDeath(cube.x, cube.y);
  cubeDrawPending = null; // hide cube from canvas
  // [1.10] Mode-specific record + lock — [2.0-w1fix] _modeRecord captured before the best is overwritten
  let _modeRecord = false;
  if (gameMode === 'hardcore') {
    localStorage.setItem('cm_hardcore_date', _todayStr());
    _modeRecord = round > bestHardcore;
    if (_modeRecord) { bestHardcore = round; localStorage.setItem('cm_best_hardcore', bestHardcore); }
  }
  if (gameMode === 'daily') {
    localStorage.setItem('cm_daily_score', round);
    _modeRecord = round > bestDaily;
    if (_modeRecord) { bestDaily = round; localStorage.setItem('cm_best_daily', bestDaily); }
  }
  if (gameMode === 'timeattack') {
    _modeRecord = round > bestTimeAttack;
    if (_modeRecord) { bestTimeAttack = round; localStorage.setItem('cm_best_timeattack', bestTimeAttack); }
  }

  const _lastT = parseFloat(lastTime);
  // [1.9.2] Combo — capture session best, then reset
  if (comboCount > bestComboThisSession) bestComboThisSession = comboCount;
  comboCount = 0;
  // [2.0-s3] records routed per world
  let _newRecord = false;
  let newUnlock = null;
  if (currentWorld === 2) { if (_lastT > w2BestTime) w2BestTime = _lastT; }
  else                    { if (_lastT > bestTime)   bestTime   = _lastT; }
  const _curBestRound = currentWorld === 2 ? w2BestRound : bestRound;
  _newRecord = round > _curBestRound; // [1.9.2] capture before update
  if (currentWorld === 2) { if (round > w2BestRound) w2BestRound = round; }
  else                    { if (round > bestRound)   bestRound   = round; }
  if (_newRecord) playRecord(); // [1.9.2]
  recordBestCombo(bestComboThisSession); // [2.0-s3] per world
  // [2.0-ads] After a revive this is the game's SECOND die(), and _lastT is time since the game
  // started, not since the revive — so bank the delta, and count the game itself only once.
  addTimePlayed(Math.max(0, Math.round(_lastT) - _timeBankedThisGame)); // [2.0-s3]
  _timeBankedThisGame = Math.round(_lastT);
  if (!reviveUsedThisGame) { if (currentWorld === 2) w2Games++; else gamesPlayed++; } // [2.0-s3][2.0-ads]
  // unlock prestige skins for round records
  for (const s of SKINS.filter(s=>s.unlock)) {
    if (round >= s.unlock && !owned.includes(s.id)) { owned.push(s.id); newUnlock = s; }
  }
  // [2.0-w1fix] same for prestige board skins (Prestige Gold) — previously unobtainable
  for (const b of BOARD_SKIN_LIST.filter(b=>b.unlock)) {
    if (round >= b.unlock && !boardsOwned.includes(b.id)) {
      boardsOwned.push(b.id);
      localStorage.setItem('cm_boards_owned', JSON.stringify(boardsOwned));
      newUnlock = b;
    }
  }
  // [2.0-w1fix] +200% payout on any record this run beat — per-world round best, or the mode's own best
  if (_newRecord || _modeRecord) _awardRecordBonus();
  // [2.0-ads] The screen itemises the whole game, not just this death: after a revive the earlier
  // bonus is still sitting in sessionCoinsEarned, so the row has to show the game total or the
  // column stops adding up. js/ads-rewards.js re-renders from the same value.
  _lastRecBonus = _recBonusPaidThisGame;
  save();

  // [2.0-ads] Everything above has already run and saved — only the MOMENT the overlay appears is
  // deferred, by an interstitial that shows roughly 30% of the time. maybeShowInterstitial() calls
  // straight through when there's no SDK, so this is a no-op off CrazyGames.
  setTimeout(()=>maybeShowInterstitial(()=>{
    _resetDeathAdButtons(); // [2.0-ads] hide last death's ad buttons before the offers re-evaluate
    deathStats.innerHTML = // [1.9.2]
      // [2.0-deemoji] glyphs stripped — a dense 14px stat block reads cleaner as plain text.
      // The Hard Mode flame stays (matches the HARD button); NEW BEST's star is a dingbat.
      `${reason==='block'?'Crushed by a block':reason==='asteroid'?'Smashed by an asteroid':currentWorld===2?'Burned by a Solar Flare':'Hit by a laser'}<br>`+
      `${hardMode?'<span style="color:#ff6600">🔥 Hard Mode</span><br>':''}`+
      `${bestComboThisSession >= 5 ? 'Best combo: <b>x'+bestComboThisSession+'</b><br>' : ''}`+ // [1.9.2]
      `<br>Time: <b>${lastTime}s</b> &nbsp;|&nbsp; Rounds: <b><span id="_dr">0</span></b><br>`+ // [1.9.3]
      // [2.0-clarity] The reward used to be two unrelated numbers: "Coins earned: +231" (already
      // including the bonus) and a separate "3× BONUS +154". Nothing said how they related, so the
      // player had to work out that 231 = 77 × 3 and 154 = 77 × 2. Now it's an itemised sum that
      // adds up on screen. The "3×" label sits on the Total, because the total genuinely is 3× the
      // base — putting it on the bonus row would have implied 154 = 77 × 3, which is wrong.
      _earnRows(_lastRecBonus)+
      `Best time: <b>${currentWorld===2?w2BestTime:bestTime}s</b> &nbsp;|&nbsp; Best rounds: <b>${currentWorld===2?w2BestRound:bestRound}</b>`+ // [2.0-s3] per world
      (_newRecord ? `<br><span class="new-best">★ NEW BEST!</span>` : '')+ // [1.9.3]
      (gameMode==='timeattack' ? `<br>Best (Time Attack): <b>${bestTimeAttack} rounds</b>` : '')+ // [1.10]
      (gameMode==='hardcore'   ? `<br>Best (Hardcore): <b>${bestHardcore} rounds</b>` : '')+      // [1.10]
      (gameMode==='daily'      ? `<br>Best (Daily): <b>${bestDaily} rounds</b>` : '')+            // [1.10]
      (newUnlock ? `<br><br><span style="color:#ffd700;font-size:15px">UNLOCKED: ${newUnlock.name}!</span>` : ''); // [2.0-deemoji]
    deathOverlay.classList.add('show');
    animateCounter('_dr', round, 520);           // [1.9.3]
    animateCounter('_dc', currentWorld===2 ? sessionCrystalsEarned : sessionCoinsEarned, 520); // [1.9.3][2.0-s1]
    // [1.10] Hide retry for locked modes (hardcore/daily die = locked)
    const retryBtn = document.getElementById('btn-retry');
    if (gameMode === 'hardcore' || gameMode === 'daily') retryBtn.style.display = 'none';
    else retryBtn.style.display = '';
    // [2.0-ads] Offered last, on a finished overlay, so the buttons never flash over a half-built
    // screen. Both self-gate on the SDK; with none present neither ever becomes visible.
    offerReviveAd();
    offerDeathAdBonus();
  }), 400);
}
