// [MODULE] Entry point - loaded LAST. Bootstrap, all event wiring, startGame,
// [MODULE] background particles and the menu coin counter.
// ═══════════════════════════════════════════════
// GRIDLOCK — Game Logic // [2.0-s5a]
// ═══════════════════════════════════════════════





















// ══════════════════════════════════════════════════
// START / RESTART
// ══════════════════════════════════════════════════


// ══════════════════════════════════════════════════
// BACKGROUND — ANIMATED PARTICLES
// ══════════════════════════════════════════════════
(function initBgParticles(){
  const cv = document.getElementById('bg-canvas');
  if (!cv) return;
  const ctx2 = cv.getContext('2d');
  let W, H, pts = [];
  function resize(){ W=cv.width=innerWidth; H=cv.height=innerHeight; }
  resize(); window.addEventListener('resize', resize);

  // Generate particles
  const N2 = Math.min(40, Math.floor(innerWidth*innerHeight/18000));
  for (let i=0;i<N2;i++) pts.push({
    x: Math.random()*innerWidth, y: Math.random()*innerHeight,
    vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.18,
    r: .6+Math.random()*1.2, a: Math.random(),
    hue: Math.random()<.6 ? 190 : Math.random()<.5 ? 280 : 60
  });

  let bgFrame;
  function draw(){
    ctx2.clearRect(0,0,W,H);
    for(const p of pts){
      p.x += p.vx; p.y += p.vy;
      p.a += .008;
      if(p.x<0) p.x=W; if(p.x>W) p.x=0;
      if(p.y<0) p.y=H; if(p.y>H) p.y=0;
      const alpha = (.3+.25*Math.sin(p.a))*.7;
      ctx2.beginPath();
      ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx2.fillStyle = currentWorld === 2 ? `hsla(265,70%,85%,${alpha})` : `hsla(${p.hue},100%,70%,${alpha})`; // [2.0-s1] cosmic tint
      ctx2.fill();
    }
    bgFrame = requestAnimationFrame(draw);
  }
  draw();
})();

// ══════════════════════════════════════════════════
// MENU COINS COUNTER
// ══════════════════════════════════════════════════
let displayedCoins = -1;

function updateMenuCoins(animate=false){
  if (!menuCoinsEl) return;
  const _wal = curWallet(); // [2.0-s1]
  menuCoinsEl.textContent = `${curIcon()} ${_wal}`;
  if (animate && displayedCoins !== _wal) {
    menuCoinsEl.classList.remove('bump');
    requestAnimationFrame(()=> menuCoinsEl.classList.add('bump'));
    setTimeout(()=> menuCoinsEl.classList.remove('bump'), 350);
  }
  displayedCoins = _wal;
}

// Coin float effect
function spawnMenuCoinFloat(amount, x, y){
  const el = document.createElement('div');
  el.className = 'float-coin';
  el.textContent = `+${amount} 🪙`;
  el.style.cssText = `left:${x}px;top:${y}px;color:#ffd700;font-size:16px;font-weight:bold;font-family:monospace;`;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 950);
}


// Wire click sounds to menu buttons
document.querySelectorAll('.menu-btn,.mission-claim-btn').forEach(b=>{
  b.addEventListener('click', ()=> playUISound('click'));
});






function startGame(hard = false, tutorial = false) {
  hardMode = hard;
  tutorialActive = tutorial; // [2.0-s4h] set on every entry → real games always clear it
  showScreen('app');
  deathOverlay.classList.remove('show');
  clearTimeout(phaseTimer);
  cube={x:8,y:8};
  round = 0;
  gamePaused = false; // [1.10.2]
  _cleanupBoss(); // [1.11] reset boss state on new game
  _endGridlockMode(false); gridlockActive=false; gridlockRoundsLeft=0; // [1.12]
  _resetRoundMods(); // [2.0-s3]
  clearInterval(_glitchTimer); _glitchTimer=null;
  if (hudGridlock) hudGridlock.style.display='none';
  alive=true; lasers=[]; blocks=[]; dashesLeft=2;
  particles=[]; trails=[]; invalidateSkinCache();
  asteroids=[]; clearTimeout(asteroidTimer); asteroidTimer=null; // [2.0-s2]
  blackHoleCooldown=0; blackHoleReadyAt=0; _resetBlackHole(); // [2.0-s2][2.0-s4g]
  if (_asteroidsEnabled() && !tutorialActive) scheduleAsteroid(); // [2.0-s2][2.0-s4h] no asteroids in tutorial
  sessionCoinsEarned = 0;
  sessionCrystalsEarned = 0; // [2.0-s1]
  // [2.0-ads] per-game ad + payout bookkeeping — a fresh game gets a fresh revive and a clean slate
  reviveUsedThisGame = false; _timeBankedThisGame = 0; _recBonusPaidThisGame = 0; _lastRecBonus = 0;
  // [1.10] Mode-specific init
  if (gameMode === 'daily') {
    localStorage.setItem('cm_daily_date', _todayStr());
    _dailyRng = _seededRng(_dateSeed());
  } else {
    _dailyRng = null;
  }
  if (gameMode === 'timeattack') {
    timeAttackEndTime = Date.now() + 60000;
    if (hudTimerEl) { hudTimerEl.style.display = ''; hudTimerVal.textContent = '60s'; } // [2.0-deemoji]
  } else {
    if (hudTimerEl) hudTimerEl.style.display = 'none';
  }
  const titleEl = document.getElementById('death-title');
  if (titleEl) titleEl.textContent = 'GAME OVER';
  comboCount = 0; bestComboThisSession = 0; // [1.9.2]
  startTime=Date.now(); _virtAccum=0; _virtBase=startTime; // [1.10.2-fix]
  buildBoard(); render();
  if (tutorialActive) _tutorialStart(); else startRound(); // [2.0-s4h] tutorial vs normal
  if (!tutorialActive) mTrackGameStart(); // [2.0-s4h] tutorial isn't a tracked game
  if (!tutorialActive) cgGameplayStart(); // [2.0-sdk] tutorial is onboarding, not gameplay
  if (_hudPauseBtn) _hudPauseBtn.style.display = tutorialActive ? 'none' : ''; // [2.0-pause] no dead button mid-tutorial
}






// [2.0-s4] Dash fires to the cell first pressed, ignoring cursor movement before release.
window.addEventListener('pointerup', () => {
  if (_dashPressX < 0) return;
  const px = _dashPressX, py = _dashPressY;
  _dashPressX = _dashPressY = -1;
  tryDash(px, py);
});
window.addEventListener('pointercancel', () => { _dashPressX = _dashPressY = -1; });

// ── MENU EVENT WIRING ──
document.getElementById('bar-missions').addEventListener('click',  showMissions);
document.getElementById('bar-shop').addEventListener('click',      ()=>{ if (currentWorld === 2) { openVoidShop(); } else { showScreen('screen-start'); openShop(true); } }); // [2.0-s5c] W2 → Void Shop
document.getElementById('bar-stats').addEventListener('click',     showStats);
document.getElementById('bar-reset').addEventListener('click', ()=>{
  resetDialog.style.visibility='visible'; resetDialog.style.pointerEvents='auto';
});
document.getElementById('missions-close').addEventListener('click', hideMissions);
document.getElementById('missions-bonus-btn').addEventListener('click', mClaimBonus);
document.getElementById('btn-tutorial').addEventListener('click', startTutorial);
document.getElementById('btn-modes').addEventListener('click', showModes); // [1.10]
document.getElementById('btn-modes-back').addEventListener('click', () => { clearInterval(_modesCountdownInterval); showMenu(); }); // [1.10]
document.getElementById('btn-start').addEventListener('click',    ()=>beginGame(false)); // [2.0-s2]
document.getElementById('btn-hard').addEventListener('click',     ()=>beginGame(true));  // [2.0-s2]
// [2.0-s1] World system wiring
document.getElementById('btn-world-switch').addEventListener('click', () => {
  currentWorld = currentWorld === 2 ? 1 : 2;
  localStorage.setItem('cm_current_world', String(currentWorld));
  applyWorldTheme();
  // [2.0-s4d] first time entering the Void → play Cubek 2.0 right away, then return to the (now W2) menu
  if (currentWorld === 2 && localStorage.getItem('cm_cubek2_done') !== 'true') {
    showCubek2(() => showMenu());
    return;
  }
  showMenu(); // refresh button label + currency icon
});
document.getElementById('wc-world1').addEventListener('click', () => { // Continue in World 1
  playUISound('tab'); showScreen('app'); startRound(); // round 100 → 101, theme unchanged
  cgGameplayStart(); // [2.0-sdk] the only resume path that never goes through startGame()
});
document.getElementById('wc-world2').addEventListener('click', () => { // Enter the Void
  playUISound('tab');
  currentWorld = 2; localStorage.setItem('cm_current_world', '2');
  applyWorldTheme();
  if (localStorage.getItem('cm_cubek2_done') === 'true') startGame(false);
  else showCubek2(() => startGame(false)); // [2.0-s4d] entering the Void fresh is always Normal
});
document.getElementById('cubek2-next').addEventListener('click', cubek2Next);
document.getElementById('stats-close').addEventListener('click',    showMenu);
document.getElementById('stats-tab-w1').addEventListener('click', ()=>{ statsView=1; playUISound('tab'); renderStats(); }); // [2.0-s3]
document.getElementById('stats-tab-w2').addEventListener('click', ()=>{ statsView=2; playUISound('tab'); renderStats(); }); // [2.0-s3]
document.getElementById('btn-retry').addEventListener('click',      ()=>startGame(hardMode)); // [1.10.1]
document.getElementById('btn-to-menu').addEventListener('click',    showMenu);
// [2.0-s4h] Tutorial — single corner skip button
document.getElementById('tut-skip').addEventListener('click', ()=>{ playSound('click'); _tutSkip(); });
document.getElementById('reset-cancel').addEventListener('click', ()=>{
  resetDialog.style.visibility='hidden';
  resetDialog.style.pointerEvents='none';
});
document.getElementById('reset-confirm').addEventListener('click', ()=>{
  Object.keys(localStorage).filter((k) => k.startsWith('cm_')).forEach((k) => localStorage.removeItem(k)); location.reload();
});
shopClose.addEventListener('click', closeShop);
// [2.0-s5c] Void Shop close / reveal continue
document.getElementById('void-shop-close').addEventListener('click', closeVoidShop);
voidRevealOk.addEventListener('click', closeVoidReveal);
// [1.9] Shop tab switching
document.getElementById('shop-tab-cube').addEventListener('click', ()=>{ shopActiveTab='cube'; renderShop(); });
document.getElementById('shop-tab-bl').addEventListener('click',   ()=>{ shopActiveTab='bl';   renderShop(); });
window.addEventListener('resize', ()=>{ if(alive&&appEl.style.visibility!=='hidden'){ invalidateSkinCache(); buildBoard(); render(); } });
// bootstrap
applyWorldTheme(); // [2.0-s1] reflect remembered world preference on load
// [2.0-sdk] try/finally so loadingStop can't be skipped. Verified in the browser: on a first
// launch startTutorial() can throw (pre-existing roundRect bug), which aborted the rest of this
// tail and left CrazyGames believing the game never finished loading. Whatever the branch does,
// the game is interactive by the time we get here.
try {
  if (!localStorage.getItem('cm_tutorial_done')) {
    startTutorial(); // [1.10.2] auto-start tutorial on first launch
  } else {
    showMenu();
  }
} finally {
  // Runs while SDK init() is still awaiting, so this only records the request; sdk.js flushes it
  // once the SDK is ready. A direct _cgSdk.game.loadingStop() here would silently never fire.
  cgLoadingStop();
}
