// [MODULE] The scripted first-run tutorial, played on the real engine.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// [2.0-s4h] TUTORIAL — guided live run on the real engine (learn-by-doing)
// ══════════════════════════════════════════════════

function _tutCoach(text) { // [2.0-s4h] one-line coachmark bubble
  if (_tutCoachEl) { _tutCoachEl.textContent = text; _tutCoachEl.style.display = 'block'; }
}
function _tutHideUI() { // [2.0-s4h] hide coachmark + skip
  if (_tutCoachEl) _tutCoachEl.style.display = 'none';
  if (_tutSkipEl)  _tutSkipEl.style.display  = 'none';
}

function _tutorialStart() { // [2.0-s4h] entry from startGame when tutorialActive — drives the scripted beats
  clearTimeout(phaseTimer);
  lasers = []; blocks = [];
  tutBeat = 0;
  _tutLaserRow = -1; _tutBlock = null; _tutAwaiting = null; // [2.0-s4h-r1]
  if (_tutSkipEl) _tutSkipEl.style.display = 'block';
  _tutBeat1();
}

function _tutBeat1() { // [2.0-s4h] BEAT 1 — dash within range (render() already glows the range)
  tutBeat = 0;
  lasers = []; blocks = [];
  _tutCoach('Tap a glowing cell to move');
  render();
}

function _tutOnDash() { // [2.0-s4h-r1] advance scripted beat on every player dash
  if (tutBeat === 0) {
    tutBeat = 1; _tutCoach('Nice!');
    phaseTimer = _schedulePhase(_tutBeat2, 600);
  } else if (tutBeat === 1 && _tutAwaiting === 'escape') {
    if (cube.y !== _tutLaserRow) { _tutAwaiting = null; _tutFireLaser(); }
    else _tutCoach('Away from the red line!');
  } else if (tutBeat === 2 && _tutAwaiting === 'dodge') {
    if (cube.x !== _tutBlock.x || cube.y !== _tutBlock.y) { _tutAwaiting = null; _tutLandBlock(); }
    else _tutCoach('Not there — tap somewhere else!');
  }
}

function _tutBeat2() { // [2.0-s4h-r1] BEAT 2 — spawn charging laser; fire only after player dashes off the row
  if (!alive || !tutorialActive) return;
  tutBeat = 1;
  _tutLaserRow = cube.y;
  lasers = [{ type:'row', idx:_tutLaserRow, state:'charge' }];
  blocks = [];
  _tutAwaiting = 'escape';
  _tutCoach('Dash off the red line!');
  if (currentWorld === 2) { _flareChargeStart = Date.now(); _flareChargeDur = CHARGE_START*2; playSolarFlareCharge(); }
  else playSound('laser_charge');
  render();
  // No _schedulePhase — fire is triggered by _tutOnDash when cube.y !== _tutLaserRow
}

function _tutFireLaser() { // [2.0-s4h-r1] player escaped the row — fire the laser then advance
  if (!alive || !tutorialActive) return;
  for (const L of lasers) L.state = 'fire';
  if (currentWorld === 2) { _flareFireStart = Date.now(); _flareFireDur = FIRE_MS; playSolarFlareRelease(); }
  else playSound('laser_fire');
  render();
  phaseTimer = _schedulePhase(() => {
    if (!alive || !tutorialActive) return;
    lasers = []; render();
    tutBeat = 2;
    phaseTimer = _schedulePhase(_tutBeat3, 500);
  }, FIRE_MS);
}

function _tutBeat3() { // [2.0-s4h-r1] BEAT 3 — spawn block on adjacent cell; land only after player dashes away
  if (!alive || !tutorialActive) return;
  tutBeat = 2; lasers = [];
  const bx = cube.x + 1 <= N - 1 ? cube.x + 1 : cube.x - 1;
  _tutBlock = { x: bx, y: cube.y };
  blocks = [{ x: _tutBlock.x, y: _tutBlock.y, state: 'charge' }];
  _tutAwaiting = 'dodge';
  _tutCoach("Tap away — don't land on purple!");
  render();
  // No _schedulePhase — land is triggered by _tutOnDash when cube !== _tutBlock
}

function _tutLandBlock() { // [2.0-s4h-r1] player cleared the block cell — land it then finish
  if (!alive || !tutorialActive) return;
  for (const b of blocks) { b.state = 'land'; spawnBlockImpact(b.x, b.y); }
  render();
  phaseTimer = _schedulePhase(() => {
    if (!alive || !tutorialActive) return;
    blocks = []; render();
    _tutFinish();
  }, 600);
}

function _tutFinish() { // [2.0-s4h] reward (preserved from old tutFinish) + cleanup → menu
  clearTimeout(phaseTimer);
  lasers = []; blocks = [];
  _tutLaserRow = -1; _tutBlock = null; _tutAwaiting = null; // [2.0-s4h-r1]
  tutorialActive = false;
  _tutCoach("You're ready!");
  localStorage.setItem('cm_tutorial_done','1');
  if (localStorage.getItem('cm_tutorial_rewarded') !== '1') { // [1.9.1] one-time reward
    coins += 100; save();
    statCoinsTotal += 100; localStorage.setItem('cm_stat_coins_total', statCoinsTotal); // [1.9.2]
    localStorage.setItem('cm_tutorial_rewarded','1');
    playSound('coin');
    setTimeout(() => { _tutHideUI(); showMenu(); }, 1800);
  } else {
    _tutHideUI(); showMenu();
  }
}

function _tutSkip() { // [2.0-s4h] corner skip → finish immediately, no reward
  clearTimeout(phaseTimer);
  lasers = []; blocks = [];
  _tutLaserRow = -1; _tutBlock = null; _tutAwaiting = null; // [2.0-s4h-r1]
  tutorialActive = false;
  localStorage.setItem('cm_tutorial_done','1');
  _tutHideUI();
  showMenu();
}

function startTutorial() { // [2.0-s4h] guided live run on the real engine
  gameMode = null;
  startGame(false, true); // tutorial=true → _tutorialStart() drives the scripted beats
  playUISound('tab');
}
