// [MODULE] What is genuinely World-2 specific once the shared game loop and bosses are removed.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
function showWorldChoice() { // [2.0-s1] game stays live; player picks Continue or Enter the Void
  cgGameplayStop(); // [2.0-sdk] alive stays true, but the player is choosing, not playing
  showScreen('screen-world-choice');
}

// ══════════════════════════════════════════════════
// WORLD 2 — STAGE 1 FOUNDATION // [2.0-s1]
// ══════════════════════════════════════════════════
function applyWorldTheme() { // [2.0-s1] toggle cosmic skin (gameplay surfaces only)
  document.body.classList.toggle('world2', currentWorld === 2);
  applyBoardSkin();   // re-applies board bg (cosmic override lives inside it)
  updateMenuCoins();
}

let cubek2Step = 0;
function showCubek2(after) { // [2.0-s1][2.0-s4d] first-time-only cosmic intro; `after` runs when it finishes
  _cubek2After = after || (() => startGame(false));
  showScreen('screen-cubek2');
  cubek2Step = 0;
  renderCubek2();
}
function renderCubek2() { // [2.0-s1]
  const txt = document.getElementById('cubek2-text');
  const btn = document.getElementById('cubek2-next');
  if (txt) txt.textContent = CUBEK2_LINES[cubek2Step];
  if (btn) btn.textContent = cubek2Step === CUBEK2_LINES.length - 1 ? '✦ ENTER' : 'NEXT →';
}
function cubek2Next() { // [2.0-s1]
  playSound('click');
  if (++cubek2Step >= CUBEK2_LINES.length) {
    localStorage.setItem('cm_cubek2_done', 'true'); // [2.0-s4d] shown exactly once
    const after = _cubek2After || (() => startGame(false));
    _cubek2After = null;
    after(); // [2.0-s4d] proceed per entry path (start a run, or return to the W2 menu)
  } else {
    renderCubek2();
  }
}

// [2.0-s2] Entry point for the menu NORMAL/HARD buttons: show Cubek 2.0 first if entering
// the Void for the first time, otherwise start the game directly.
function beginGame(hard) {
  if (currentWorld === 2 && localStorage.getItem('cm_cubek2_done') !== 'true') {
    showCubek2(() => startGame(hard)); return; // [2.0-s4d] fallback: resumed W2 session that never saw the intro
  }
  startGame(hard);
}
// [2.0-s2] SOLAR FLARES (World 2): warning = semi-transparent 2-wide band (like the World 1
// laser warning); beam = fully-opaque bright orange/yellow 2-wide band, clamped to the board.
function _flareBandRect(L) { // exactly 2 cells wide, clamped within board boundaries
  const idxs = laserIdxs(L);
  const i0 = Math.min(idxs[0], idxs[1]); // laserIdxs already clamps idx===N-1 → [N-2,N-1]
  if (L.type === 'row') ctx.rect(0, i0*cellSize, canvas.width, 2*cellSize);
  else                  ctx.rect(i0*cellSize, 0, 2*cellSize, canvas.height);
}
function drawSolarFlares(now) { // [2.0-s5a-r8] flat flares, colored by laserColorIdW2
  const laserCol = LASER_COLORS[laserColorIdW2] || LASER_COLORS.plasma;
  const fireFlares   = lasers.filter(l => l.state === 'fire');
  const chargeFlares = lasers.filter(l => l.state === 'charge');
  const pulse = .45 + .35*Math.sin(now*.009);
  // Warning (charge) — muted tint of laserCol
  if (chargeFlares.length > 0) {
    ctx.save();
    ctx.beginPath();
    for (const L of chargeFlares) _flareBandRect(L);
    ctx.clip();
    ctx.globalAlpha = .28 + .22*pulse;
    ctx.fillStyle = laserCol.charge;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // Beam (fire) — flat bright laserCol
  if (fireFlares.length > 0) {
    ctx.save();
    ctx.beginPath();
    for (const L of fireFlares) _flareBandRect(L);
    ctx.clip();
    ctx.fillStyle = laserCol.fire;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}
