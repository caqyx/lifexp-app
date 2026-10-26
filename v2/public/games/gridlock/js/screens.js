// [MODULE] Navigation between screens - menu, modes, stats, PIN.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ── CENTRALIZED SCREEN MANAGEMENT ──
// Instead of manually showing/hiding each screen — one function
function showScreen(id) { // [1.9.3] fade-in on target screen
  SCREENS.forEach(s => {
    const el = s==='app' ? appEl : document.getElementById(s);
    if (!el) return;
    if (s === id) {
      el.style.transition = 'opacity .15s ease';
      el.style.visibility = 'visible';
      el.style.pointerEvents = 'auto';
      el.style.opacity = '0';
      requestAnimationFrame(() => { el.style.opacity = '1'; });
    } else {
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
    }
  });
}

function showModes() { // [1.10]
  showScreen('screen-modes');
  _renderModeCards();
  clearInterval(_modesCountdownInterval);
  _modesCountdownInterval = setInterval(_updateModeCountdowns, 1000);
}
function _renderModeCards() { // [1.10]
  ['timeattack','hardcore','daily'].forEach(id => {
    const card = document.getElementById('mode-card-' + id);
    const status = card.querySelector('.mode-card-status');
    const blocked = _isModeBlocked(id);
    card.classList.toggle('blocked', blocked);
    if (blocked) {
      status.textContent = `⏳ ${_fmtCountdown(_msUntilMidnight())}`;
      card.onclick = null;
    } else {
      status.textContent = '';
      card.onclick = () => startModeGame(id);
    }
  });
}
function _updateModeCountdowns() { // [1.10]
  ['hardcore','daily'].forEach(id => {
    if (!_isModeBlocked(id)) return;
    const card = document.getElementById('mode-card-' + id);
    const status = card.querySelector('.mode-card-status');
    if (status) status.textContent = `⏳ ${_fmtCountdown(_msUntilMidnight())}`;
  });
}
function startModeGame(mode) { // [1.10]
  clearInterval(_modesCountdownInterval);
  gameMode = mode;
  startGame(false);
}

function showMenu() {
  cgGameplayStop(); // [2.0-sdk] no-op unless gameplay was actually running (also fires on cold boot)
  clearInterval(_modesCountdownInterval); // [1.10]
  gameMode = null; // [1.10]
  showScreen('screen-start');
  deathOverlay.classList.remove('show');
  clearTimeout(phaseTimer);
  alive = false;
  gamePaused = false; // [1.10.2]
  tutorialActive = false; // [2.0-s4h] defensive: never linger into the menu
  asteroids = []; clearTimeout(asteroidTimer); asteroidTimer = null; _resetBlackHole(); // [2.0-s2]
  // [2.0-s1] world-switch button — hidden until VOID KING defeated
  const wsBtn = document.getElementById('btn-world-switch');
  if (wsBtn) {
    wsBtn.style.display = world2Unlocked ? '' : 'none';
    wsBtn.textContent = currentWorld === 2 ? '⚡ RETURN TO GRID' : '✦ ENTER THE VOID';
  }
  applyWorldTheme(); // [2.0-s1] reflect current world's theme on the menu
  updateMenuCoins();
  playUISound('tab');
  if (missionState) {
    const wt = missionState.weekType;
    const barM = document.getElementById('bar-missions');
    if (barM) barM.className = `menu-bar-btn${wt==='luckiest'?' luckiest':wt==='lucky'?' lucky':''}`;
  }
}

function fmtStat(n) { // [1.10.2] compact number formatter
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
let statsView = 1; // [2.0-s3] which world's stats are shown (1 or 2)
function showStats() {
  const tabs = document.getElementById('stats-tabs'); // [2.0-s3] hide W2 tab until unlocked (no spoilers)
  if (tabs) tabs.style.display = world2Unlocked ? '' : 'none';
  statsView = world2Unlocked ? currentWorld : 1; // default to current world once unlocked
  showScreen('screen-stats');
  renderStats();
}
function renderStats() { // [2.0-s3] fill the stat screen from the selected world's set
  const w2 = statsView === 2;
  const scr = document.getElementById('screen-stats');
  if (scr) scr.classList.toggle('stats-w2', w2);
  document.getElementById('stats-tab-w1').classList.toggle('active', !w2);
  document.getElementById('stats-tab-w2').classList.toggle('active',  w2);
  // wallet + dynamic labels
  document.getElementById('st-coins').textContent     = w2 ? `${crystals} ✦` : `${coins} 🪙`;
  document.getElementById('st-lasers-lbl').textContent      = w2 ? 'FLARES DODGED' : 'LASERS DODGED';
  document.getElementById('st-coins-total-lbl').textContent = w2 ? 'CRYSTALS EARNED' : 'COINS EARNED';
  // values
  document.getElementById('st-best-time').textContent  = `${w2 ? w2BestTime : bestTime}s`;
  document.getElementById('st-best-round').textContent = `${w2 ? w2BestRound : bestRound}`;
  document.getElementById('st-games').textContent      = `${w2 ? w2Games : gamesPlayed}`;
  document.getElementById('st-skins').textContent      = `${owned.length+boardsOwned.length+lasersOwned.length}/${SKINS.length+BOARD_SKIN_LIST.length+LASER_COLOR_LIST.length}`; // global cosmetics
  document.getElementById('st-lasers').textContent      = fmtStat(w2 ? w2StatLasers : statLasers);
  document.getElementById('st-time').textContent        = formatTimePlayed(w2 ? w2TimePlayed : statTimePlayed);
  document.getElementById('st-coins-total').textContent = fmtStat(w2 ? w2CrystalsTotal : statCoinsTotal);
  const _bc = w2 ? w2BestCombo : statBestCombo;
  document.getElementById('st-best-combo').textContent  = _bc > 0 ? `x${fmtStat(_bc)}` : '—';
}
function formatTimePlayed(s) { // [1.9.2]
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
