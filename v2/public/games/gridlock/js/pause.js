// [MODULE] Pause — the freeze/thaw machinery plus the player-facing overlay (HUD button only).
// [MODULE] pauseGame()/resumeGame() stop every clock the game runs on with full elapsed-time
// [MODULE] accounting: virtual time, the phase timer, asteroids, the black-hole teleport and the
// [MODULE] combo flash. Ads pause through here too (js/sdk.js), so this file is load-bearing well
// [MODULE] beyond the overlay. `gamePaused` and `_pausedByPlayer` are declared in state.js.
// [2.0-notester] The freeze pair used to live in js/tester.js as fabPauseGame/fabResumeGame, named
// after the tester's floating action button. That file is gone; the behaviour was never
// tester-specific, so it moved here and lost the "fab" prefix.
// [2.0-noesc] Escape is deliberately NOT wired to this — see _openPauseOverlay below.
// ── PAUSE ──

function pauseGame() {
  if (!alive || gamePaused) return;
  gamePaused = true;
  _pauseStart = Date.now(); // freeze time-based asteroids/teleport
  if (blackHoleAnimating) { _bhRemaining = Math.max(0, _bhFiresAt - Date.now()); clearTimeout(_bhTimer); _bhTimer = null; }
  _freezeVirtTime(); // snapshot virtual time so the pause duration is excluded
  clearTimeout(phaseTimer);
  _phaseRemainingMs = Math.max(0, _phaseFiresAt - Date.now());
  const cf = document.getElementById('combo-flash'); // pause the combo flash timers
  if (cf) {
    clearTimeout(cf._t1); clearTimeout(cf._t2);
    cf._t1Remaining = (cf._t1FiresAt > 0) ? Math.max(0, cf._t1FiresAt - Date.now()) : 0;
    cf._t2Remaining = (cf._t2FiresAt > 0) ? Math.max(0, cf._t2FiresAt - Date.now()) : 0;
  }
  startAnim(); // keep the loop alive so the overlay still paints
}

function resumeGame() {
  if (!gamePaused) return;
  gamePaused = false;
  const _pd = Date.now() - _pauseStart; // pause duration
  for (const a of asteroids) { a.born += _pd; a.warnUntil += _pd; } // shift so they don't jump
  if (blackHoleAnimating && blackHole) { // resume the frozen teleport
    blackHole.born += _pd;
    _bhFiresAt = Date.now() + _bhRemaining;
    _bhTimer = setTimeout(_bhFinish, _bhRemaining);
  }
  _virtBase = Date.now(); // exclude the pause from virtual time
  if (blackHoleReadyAt > 0) blackHoleReadyAt += _pd; // and from the BH cooldown countdown
  if (alive && _phaseFn) {
    phaseTimer = setTimeout(_phaseFn, _phaseRemainingMs);
  }
  const cf = document.getElementById('combo-flash'); // resume the combo flash timers
  if (cf) {
    if (cf._t1Remaining > 0) cf._t1 = setTimeout(() => { cf.style.opacity = '0'; cf._t1FiresAt = 0; }, cf._t1Remaining);
    if (cf._t2Remaining > 0) cf._t2 = setTimeout(() => { cf.style.display = 'none'; cf._t2FiresAt = 0; }, cf._t2Remaining);
    cf._t1Remaining = 0; cf._t2Remaining = 0;
  }
}

// ── PLAYER-FACING OVERLAY ──

const _pauseOverlayEl = document.getElementById('pause-overlay');
const _hudPauseBtn    = document.getElementById('hud-pause-btn');

function _openPauseOverlay() { // [2.0-pause][2.0-noesc] entry point for the HUD pause button only
  if (!alive || _pausedByPlayer) return;
  if (tutorialActive) return;                 // tutorial drives scripted beats
  if (gamePaused) return;                     // an ad already owns the freeze
  if (appEl.style.visibility !== 'visible') return; // not on the game screen ('' before first showScreen)
  _pausedByPlayer = true;
  pauseGame();
  cgGameplayStop(); // [2.0-sdk] paused is not active gameplay
  if (_pauseOverlayEl) _pauseOverlayEl.classList.add('show');
  render();
  playUISound('click');
}

function _closePauseOverlay(toMenu) {
  if (!_pausedByPlayer) return;
  _pausedByPlayer = false;
  if (_pauseOverlayEl) _pauseOverlayEl.classList.remove('show');
  if (toMenu) {
    showMenu(); // does its own cleanup: alive=false, timers cleared, gamePaused=false, gameplayStop
  } else {
    resumeGame();
    cgGameplayStart(); // [2.0-sdk] back to actual play
    playUISound('click');
  }
}

document.getElementById('pause-resume-btn').addEventListener('click', () => _closePauseOverlay(false));
document.getElementById('pause-menu-btn').addEventListener('click',   () => _closePauseOverlay(true));
if (_hudPauseBtn) _hudPauseBtn.addEventListener('click', _openPauseOverlay);
