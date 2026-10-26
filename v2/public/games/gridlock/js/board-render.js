// [MODULE] Board construction, per-frame rendering, board-skin painting, skin cache, canvas animation loop.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// [2.0-w1fix] resolve the equipped board skin for the world we're in (was: W1 hardcoded to classic)
function _curBoardSkin() {
  return currentWorld === 2
    ? (BOARD_SKINS[boardSkinIdW2] || BOARD_SKINS.eventhorizon)
    : (BOARD_SKINS[boardSkinId]   || BOARD_SKINS.classic);
}

// [1.9] Apply board skin background — [2.0-w1fix] World 1 board skins are live again
function applyBoardSkin() {
  const skin = _curBoardSkin();
  boardEl.style.background = skin.bg;
  boardEl.style.setProperty('--board-bg', skin.bg);
}

// [1.9] Draw grid lines on a canvas (used in animLoop) [2.0-s4h][2.0-s5a][2.0-w1fix] both worlds
function drawBoardGridLines(ctx2, canvasSize, n) {
  if (!showBoardGrid) return; // [1.9.1] bug #8: no-grid toggle
  const skin = _curBoardSkin();
  if (skin.warped) _drawWarpedCore(ctx2, canvasSize); // seamless void — no grid lines, eventhorizon shows its core only
  // [2.0-w1fix] W1 skins carry no overlay flags, so they draw plain grid lines in their own colour
  else if (!skin.stars && !skin.nebula && !skin.belt) _drawPlainGridLines(ctx2, canvasSize, n, skin);
  if (skin.stars)       _drawStarsOverlay(ctx2, canvasSize);
  else if (skin.nebula) _drawNebulaOverlay(ctx2, canvasSize);
  else if (skin.belt)   _drawBeltOverlay(ctx2, canvasSize);
}

// [2.0-w1fix] plain n×n grid in the skin's colour — what makes Neon Grid / Lava / Ice / Galaxy read as different boards
function _drawPlainGridLines(ctx2, canvasSize, n, skin) {
  const step = canvasSize / n;
  ctx2.save();
  ctx2.strokeStyle = skin.grid;
  ctx2.lineWidth = 1;
  ctx2.globalAlpha = skin.glow ? 0.55 : 0.35;
  if (skin.glow) { ctx2.shadowColor = skin.grid; ctx2.shadowBlur = skin.prestige ? 6 : 4; }
  for (let i = 1; i < n; i++) {
    const p = Math.round(i * step) + 0.5;
    ctx2.beginPath(); ctx2.moveTo(p, 0); ctx2.lineTo(p, canvasSize); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(0, p); ctx2.lineTo(canvasSize, p); ctx2.stroke();
  }
  ctx2.restore();
}

// [2.0-s5a] central black/gold singularity — Event Horizon's board-skin effect in W2
function _drawWarpedCore(ctx2, size) {
  const cx = size / 2, cy = size / 2, r = size * 0.10;
  ctx2.save();
  ctx2.fillStyle = '#000';
  ctx2.beginPath(); ctx2.arc(cx, cy, r, 0, Math.PI * 2); ctx2.fill();
  const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(Date.now() * 0.003));
  ctx2.strokeStyle = `rgba(255,215,0,${pulse})`;
  ctx2.lineWidth = 2;
  ctx2.shadowColor = '#ffd700'; ctx2.shadowBlur = 8;
  ctx2.beginPath(); ctx2.arc(cx, cy, r, 0, Math.PI * 2); ctx2.stroke();
  ctx2.shadowBlur = 0;
  ctx2.restore();
}

// [2.0-s5a] deterministic twinkling star field overlay
function _drawStarsOverlay(ctx2, size) {
  const now = Date.now() * 0.0006;
  ctx2.save();
  for (let i = 0; i < 40; i++) {
    const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * size, sy = (Math.cos(i * 91.7) * 0.5 + 0.5) * size;
    const a = 0.25 + 0.55 * Math.abs(Math.sin(now + i));
    const rr = 0.5 + (i % 3) * 0.5;
    ctx2.globalAlpha = a;
    ctx2.fillStyle = '#ffffff';
    ctx2.beginPath(); ctx2.arc(sx, sy, rr, 0, Math.PI * 2); ctx2.fill();
  }
  ctx2.globalAlpha = 1;
  ctx2.restore();
}

// [2.0-s5a] soft drifting nebula clouds overlay
function _drawNebulaOverlay(ctx2, size) {
  const drift = Date.now() * 0.00004;
  const clouds = [
    { hue: 280, x: 0.35, y: 0.4 }, { hue: 315, x: 0.65, y: 0.55 },
    { hue: 210, x: 0.5, y: 0.3 },  { hue: 260, x: 0.45, y: 0.7 },
  ];
  ctx2.save();
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    const px = size * c.x + Math.sin(drift + i) * size * 0.04;
    const py = size * c.y + Math.cos(drift + i * 1.3) * size * 0.04;
    const g = ctx2.createRadialGradient(px, py, 0, px, py, size * 0.32);
    g.addColorStop(0, `hsla(${c.hue},85%,60%,0.22)`);
    g.addColorStop(1, `hsla(${c.hue},85%,60%,0)`);
    ctx2.fillStyle = g;
    ctx2.beginPath(); ctx2.arc(px, py, size * 0.32, 0, Math.PI * 2); ctx2.fill();
  }
  ctx2.restore();
}

// [2.0-s5a] diagonal asteroid-belt band of small rocks
function _drawBeltOverlay(ctx2, size) {
  ctx2.save();
  ctx2.fillStyle = 'rgba(120,115,130,0.5)';
  for (let i = 0; i < 26; i++) {
    const t2 = i / 25;
    const bx = t2 * size + (Math.sin(i * 71.3) * 0.5) * size * 0.12;
    const by = (1 - t2) * size + (Math.cos(i * 53.7) * 0.5) * size * 0.12;
    const rr = 0.8 + (i % 4) * 0.6;
    ctx2.beginPath(); ctx2.arc(bx, by, rr, 0, Math.PI * 2); ctx2.fill();
  }
  ctx2.restore();
}

// [1.9] Draw board skin preview (mini board + 3×3 grid) — size-aware [2.0-s5c]
function drawBoardPreview(cv, skinId2) {
  const ctx2 = cv.getContext('2d');
  const S = cv.width || 38;             // [2.0-s5c] fill the canvas at any size (38 shop, 96 reveal)
  const skin = BOARD_SKINS[skinId2] || BOARD_SKINS.classic;
  ctx2.clearRect(0, 0, S, S);
  ctx2.fillStyle = skin.bg;
  ctx2.fillRect(0, 0, S, S);
  ctx2.strokeStyle = skin.grid;
  ctx2.lineWidth = Math.max(0.8, S / 48);
  if (skin.glow) {
    ctx2.shadowColor = skin.grid;
    ctx2.shadowBlur  = (skin.prestige ? 3 : 2) * (S / 38);
  }
  for (let i = 0; i <= 3; i++) {
    const p = i * (S / 3);
    ctx2.beginPath(); ctx2.moveTo(p, 0); ctx2.lineTo(p, S); ctx2.stroke();
    ctx2.beginPath(); ctx2.moveTo(0, p); ctx2.lineTo(S, p); ctx2.stroke();
  }
  ctx2.shadowBlur = 0;
  // [2.0-s5c] Void flavor overlays so dark boards read as their theme (stars/belt/nebula/core)
  if (skin.warped)      _drawWarpedCore(ctx2, S);
  if (skin.stars)       _drawStarsOverlay(ctx2, S);
  else if (skin.nebula) _drawNebulaOverlay(ctx2, S);
  else if (skin.belt)   _drawBeltOverlay(ctx2, S);
}

// [2.0-s5a-r1] Draw laser color preview — gradient band + core line — size-aware [2.0-s5c]
function drawLaserPreview(cv, colorId2) {
  const ctx2 = cv.getContext('2d');
  const S = cv.width || 38, f = S / 38; // [2.0-s5c] scale band to canvas size
  const col = LASER_COLORS[colorId2] || LASER_COLORS.red;
  ctx2.clearRect(0, 0, S, S);
  ctx2.fillStyle = '#060616';
  ctx2.fillRect(0, 0, S, S);
  ctx2.save();
  const g = ctx2.createLinearGradient(0, 13 * f, 0, 25 * f);
  g.addColorStop(0, col.charge); g.addColorStop(0.5, col.fire); g.addColorStop(1, col.charge);
  ctx2.fillStyle = g; ctx2.fillRect(4 * f, 13 * f, 30 * f, 12 * f);
  ctx2.shadowColor = col.fire; ctx2.shadowBlur = 6 * f;
  ctx2.strokeStyle = col.fire; ctx2.lineWidth = 1 * f;
  ctx2.beginPath(); ctx2.moveTo(4 * f, 19 * f); ctx2.lineTo(34 * f, 19 * f); ctx2.stroke();
  ctx2.restore();
}

// ══════════════════════════════════════════════════
// BOARD
// ══════════════════════════════════════════════════
// [2.0-boardfix] One-shot latch so the re-measure below can never become an rAF loop.
let _boardRemeasureQueued = false;

function buildBoard() {
  const vw = document.documentElement.clientWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  // [2.0-boardfix] `vh - 120` goes negative on any viewport under ~104px tall, and the viewport
  // measures ~0 during the first synchronous layout of a cold load. That made the whole chain
  // negative: size -120 -> cellSize -7.5 -> getSkinCanvas' `Math.ceil(cellSize) || 24` returned -7
  // (negative is truthy, so the intended 24px fallback never engaged) -> drawSkin drew the default
  // skin's rings at radius -7 x .48 x .2, and canvas threw
  //   "Failed to execute 'roundRect': Radius value -0.672 is negative"
  // on literally every first launch. `canvas.width = -120` was silently failing to 300px too.
  const raw  = Math.min(vw - 16, vh - 120, 440);
  const size = Math.max(MIN_BOARD_PX, raw);
  cellSize = size / N;
  // A clamped board is a guess. If the viewport was simply not measurable yet, re-measure once it
  // is — otherwise a one-frame blip at boot would leave the player on a 160px board all game. The
  // inner check is what keeps a genuinely tiny window from rebuilding forever.
  if (raw < MIN_BOARD_PX && !_boardRemeasureQueued) {
    _boardRemeasureQueued = true;
    requestAnimationFrame(() => {
      _boardRemeasureQueued = false;
      const vh2 = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const raw2 = Math.min(document.documentElement.clientWidth - 16, vh2 - 120, 440);
      if (raw2 >= MIN_BOARD_PX) { invalidateSkinCache(); buildBoard(); render(); }
    });
  }
  boardEl.style.width = boardEl.style.height = size + 'px';
  boardEl.style.gridTemplate = `repeat(${N},1fr)/repeat(${N},1fr)`;
  canvas.width = canvas.height = size;
  boardEl.innerHTML = ''; cells = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      const c = document.createElement('div');
      c.className = 'cell';
      c.addEventListener('pointerdown', () => { _dashPressX = x; _dashPressY = y; }); // [2.0-s4] lock dash target on press
      boardEl.appendChild(c); row.push(c);
    }
    cells.push(row);
  }
  applyBoardSkin(); // [1.9]
}

// ══════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════
function skinColor() {
  const colors = {
    default:'#00ffe0', stripes:'#ff4488', grid:'#00ff64', gradient:'#ff88cc', rainbow:'#ffff00',
    glitch:'#00ffff', aura:'#cc44ff', magma:'#ff6600', void:'#9933ff', neontrail:'#00ffaa',
    spike:'#00ffcc', robot:'#4488ff', wave:'#8844ff', ball:'#ff44ff', ufo:'#00ffb0',
    sun:'#ffdd00', blackhole:'#aa44ff', galaxy:'#aaddff',
    // [2.0-s5a] Void skins
    singularityheart:'#ffcc55', supernova:'#ff7722', pulsarskin:'#66ddff', cosmicdust:'#cc88ff',
    comet:'#aaddff', aurora:'#66ffaa', meteor:'#ff6633', stardust:'#ddeeff', orbit:'#88bbff', lunar:'#cccccc'
  };
  return colors[skinId] || '#00e0c6';
}

// ── SKIN CACHE ──
// Instead of recalculating drawSkin every frame — buffer onto offscreen canvas
// and only copy via drawImage (10-100× faster)
let skinCache = null;       // offscreen canvas
let skinCacheId = null;     // skin id in cache
let skinCacheT  = -1;       // t in cache (for animated skins)

function getSkinCanvas(t) {
  // [2.0-boardfix] Was `Math.ceil(cellSize) || 24`, which only caught cellSize 0 — a negative
  // cellSize is truthy and sailed straight through into drawSkin. Same 24px fallback, but now it
  // triggers on any size that isn't drawable. buildBoard() no longer produces one; this is the
  // second line of defence, since every skin's geometry trusts this number.
  const sz = cellSize > 0 ? Math.ceil(cellSize) : 24;
  const animated = ANIMATED_SKINS.has(skinId);
  const needRegen = !skinCache
    || skinCacheId !== skinId
    || skinCache.width !== sz
    || (animated && Math.floor(t/CACHE_INTERVAL) !== Math.floor(skinCacheT/CACHE_INTERVAL));

  if (needRegen) {
    if (!skinCache || skinCache.width !== sz) {
      skinCache = document.createElement('canvas');
      skinCache.width = skinCache.height = sz;
    }
    const c2 = skinCache.getContext('2d');
    c2.clearRect(0, 0, sz, sz);
    drawSkin(c2, skinId, 0, 0, sz, t);
    skinCacheId = skinId;
    skinCacheT  = t;
  }
  return skinCache;
}

function invalidateSkinCache() {
  skinCacheId = null;
}

let skinAnimT = 0;

function drawCubeOnCanvas(gx, gy, t) {
  cubeDrawPending = {gx, gy, t};
  if (!animFrame) _paintCube();
}

let cubeDrawPending = null;
function _paintCube() {
  if (!cubeDrawPending) return;
  const {gx, gy, t} = cubeDrawPending;
  const px = gx * cellSize, py = gy * cellSize;
  const sz = cellSize;
  // use cache instead of redrawing from scratch
  const cached = getSkinCanvas(t);
  ctx.drawImage(cached, px, py, sz, sz);
  // glow
  ctx.save();
  ctx.shadowColor = skinColor();
  ctx.shadowBlur = 8;
  ctx.strokeStyle = skinColor() + '66';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px+1, py+1, sz-2, sz-2, 3);
  ctx.stroke();
  ctx.restore();
}

function render() {
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const c = cells[y][x];
    c.className='cell';
    c.style.background='';
    c.style.boxShadow='';
  }
  // range — build set of cells occupied by lasers (2-wide flares in World 2) [2.0-s2]
  const laserCells = new Set();
  for (const L of lasers) {
    for (const ix of laserIdxs(L)) {
      if (L.type==='row') for (let x=0;x<N;x++) laserCells.add(`${x},${ix}`);
      else                for (let y=0;y<N;y++) laserCells.add(`${ix},${y}`);
    }
  }
  const bossCells = getBossCells(); // [1.11]
  _dashCells = []; // [2.0-s2] recapture for the World 2 canvas overlay
  if (alive) for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const key = `${x},${y}`;
    if (dist(x,y,cube.x,cube.y)<=DASH_RANGE && !(x===cube.x&&y===cube.y)
        && !laserCells.has(key) && !bossCells.has(key) && !bossShockwaveCells.has(key)) { // [1.11]
      cells[y][x].classList.add('dashable');
      _dashCells.push([x, y]); // [2.0-s2]
    }
  }
  // blocks (on cells — small, no border issue)
  if (!bossRound) blocks = blocks.filter(b => !b.bossRain && !b.bossThrow && !b.bossPressure); // [2.0-s3][2.0-s4] never show boss blocks outside boss rounds
  for (const b of blocks) cells[b.y][b.x].classList.add(b.state==='land'?'block':'block-charge');
  // [1.11] Shockwave cells
  for (const key of bossShockwaveCells) {
    const [sx, sy] = key.split(',').map(Number);
    if (cells[sy]?.[sx]) cells[sy][sx].classList.add('boss-shockwave');
  }
  // [2.0-s4b] World 2 boss markers — destroyed craters, hit plate, charging turret
  if (w2Boss) {
    for (const key of destroyedCells) { const [dx,dy]=key.split(',').map(Number); if (cells[dy]?.[dx]) cells[dy][dx].classList.add('cell-destroyed'); }
    if (hitPlate && cells[hitPlate.y]?.[hitPlate.x]) cells[hitPlate.y][hitPlate.x].classList.add('hit-plate');
    if (turret) {
      if (cells[turret.ey]?.[turret.ex]) cells[turret.ey][turret.ex].classList.add('w2-turret','w2-turret-charge');
      if (cells[turret.py]?.[turret.px]) cells[turret.py][turret.px].classList.add('w2-turret-charge');
    }
  }
  // lasers — NOT on cells, drawn on canvas in animLoop
  // cube — draw on canvas
  drawCubeOnCanvas(cube.x, cube.y, skinAnimT);
  startAnim(); // starts animLoop which draws cube + lasers

  const _wal = curWallet(); // [2.0-s1]
  hudCoins.textContent = gridlockActive ? `${curIcon()} ${_wal} ×2` : `${curIcon()} ${_wal}`; // [1.12][2.0-s1]
  if (_wal !== _prevHudCoins) { // [1.9.3]
    _prevHudCoins = _wal;
    hudCoins.classList.remove('hud-bump'); void hudCoins.offsetWidth;
    hudCoins.classList.add('hud-bump');
  }
  hudInfo.textContent  = (bossRound && bossActive && w2Boss) // [2.0-s4b][2.0-deemoji] multi-state line stays plain text
    ? `${w2Boss.name} · ${bossHitsLeft} hit${bossHitsLeft===1?'':'s'} left${Date.now()<bossShieldUntil?' · SHIELD':''} · +${w2Boss.reward} ✦`
    : (bossRound && bossActive) // [1.11]
    ? `${BOSS_CONFIG[bossTier].name} · +${BOSS_CONFIG[bossTier].reward} 🪙`
    : `Round ${round} · ${aliveTime()}s`; // [1.9]
  if (round !== _prevHudRound) { // [1.9.3]
    _prevHudRound = round;
    hudInfo.classList.remove('hud-bump'); void hudInfo.offsetWidth;
    hudInfo.classList.add('hud-bump');
  }
  hudDashVal.textContent = `${dashesLeft}`; // [2.0-deemoji]
  updateBlackHoleHud(); // [2.0-s2]
  // [1.9.2] Combo indicator — only visible when combo >= 5
  if (comboCount >= 5) {
    hudComboVal.textContent = `x${comboCount}`; hudCombo.style.display = ''; // [2.0-deemoji]
    if (comboCount !== _prevCombo) { // [1.9.3]
      _prevCombo = comboCount;
      hudCombo.classList.remove('combo-pop'); void hudCombo.offsetWidth;
      hudCombo.classList.add('combo-pop');
    }
  } else { hudCombo.style.display = 'none'; _prevCombo = 0; } // [1.9.3]
}


function dist(x1,y1,x2,y2){return Math.abs(x1-x2)+Math.abs(y1-y2);}
function _virtMs() { // [1.10.2-fix] virtual elapsed ms using committed round-boundary multiplier
  return _virtAccum + (Date.now() - _virtBase);
}
function _freezeVirtTime() { // [1.10.2-fix] snapshot virtual time (called at round boundaries and pause)
  if (!alive) return;
  _virtAccum += (Date.now() - _virtBase);
  _virtBase = Date.now();
}
function aliveTime(){ // [1.10.2-fix]
  return alive ? (_virtMs() / 1000).toFixed(1) : lastTime;
}
function flash(t){msgEl.textContent=t;}
function animateCounter(id, target, duration) { // [1.9.3]
  const el = document.getElementById(id);
  if (!el) return;
  if (target === 0) { el.textContent = '0'; return; }
  const start = Date.now();
  (function tick() {
    const p = Math.min((Date.now() - start) / duration, 1);
    el.textContent = Math.round(p * target);
    if (p < 1) requestAnimationFrame(tick);
  })();
}

function showComboFlash(combo, bonus) { // [1.9.2]
  const el = document.getElementById('combo-flash');
  if (!el) return;
  el.textContent = `Combo x${combo}! +${bonus} bonus ${curIcon()}`; // [2.0-s1][2.0-deemoji]
  el.style.display = 'block'; el.style.opacity = '1';
  clearTimeout(el._t1); clearTimeout(el._t2);
  const _cf1 = 1200, _cf2 = 1600;
  el._t1FiresAt = Date.now() + _cf1; // [1.10.2]
  el._t2FiresAt = Date.now() + _cf2; // [1.10.2]
  el._t1 = setTimeout(() => { el.style.opacity = '0'; el._t1FiresAt = 0; }, _cf1);
  el._t2 = setTimeout(() => { el.style.display = 'none'; el._t2FiresAt = 0; }, _cf2);
}

// Timer every 100ms — updates time in HUD
setInterval(()=>{
  if (gamePaused) return; // [1.10.2] halt all HUD logic while paused
  if (alive && appEl.style.visibility !== 'hidden') {
    hudInfo.textContent = (bossRound && bossActive) // [1.11][2.0-deemoji]
      ? `${BOSS_CONFIG[bossTier].name} · +${BOSS_CONFIG[bossTier].reward} 🪙`
      : `Round ${round} · ${aliveTime()}s`; // [1.9]
    hudCoins.textContent = gridlockActive ? `${curIcon()} ${curWallet()} ×2` : `${curIcon()} ${curWallet()}`; // [1.12][2.0-s1]
    updateBlackHoleHud(); // [2.0-s2]
    if (gameMode === 'timeattack') { // [1.10]
      const virtualMs = _virtMs(); // [1.10.2-fix]
      const left = Math.max(0, Math.ceil((60000 - virtualMs) / 1000));
      if (hudTimerVal) { // [2.0-deemoji] write the value, keep the static icon; classList so the markup survives
        hudTimerVal.textContent = `${left}s`;
        hudTimerEl.classList.toggle('urgent', left <= 10);
      }
      if (virtualMs >= 60000) _timeAttackOver();
    }
  }
}, 100);

// ══════════════════════════════════════════════════
// CANVAS ANIMATIONS
// ══════════════════════════════════════════════════
let particles = [];   // death particles
let trails    = [];   // dash trail
let animFrame = null;

function animLoop() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBoardGridLines(ctx, canvas.width, N); // [1.9]
  const now = Date.now();

  // ── LASERS / SOLAR FLARES ON CANVAS — entirely skipped when boss is active ──
  // [1.11] bossActive guard: no clip regions, no shadows, no canvas state set at all
  if (lasers.length > 0 && !bossActive) {
    if (currentWorld === 2) { // [2.0-s2] Solar Flares: charge orb → wide beam release
      drawSolarFlares(now);
    } else {
      const laserCol     = LASER_COLORS[laserColorId] || LASER_COLORS.red; // [1.9]
      const fireLasers   = lasers.filter(l => l.state === 'fire');
      const chargeLasers = lasers.filter(l => l.state === 'charge');
      const pulse = .45 + .35*Math.sin(now*.009);

      // Charge — pulsing dark color
      if (chargeLasers.length > 0) {
        ctx.save();
        ctx.beginPath();
        for (const L of chargeLasers) {
          if (L.type==='row') ctx.rect(0, L.idx*cellSize, canvas.width, cellSize);
          else                ctx.rect(L.idx*cellSize, 0, cellSize, canvas.height);
        }
        ctx.clip();
        ctx.globalAlpha = .28 + .22*pulse;
        ctx.fillStyle = laserCol.charge; // [1.9]
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Fire — flat beam [2.0-s5a-r7]
      if (fireLasers.length > 0) {
        ctx.save();
        ctx.beginPath();
        for (const L of fireLasers) {
          if (L.type==='row') ctx.rect(0, L.idx*cellSize, canvas.width, cellSize);
          else                ctx.rect(L.idx*cellSize, 0, cellSize, canvas.height);
        }
        ctx.clip();
        ctx.fillStyle = laserCol.fire;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  }

  // [2.0-s2] World 2 dash-range indicator — drawn ABOVE flares so it's always visible
  // [2.0-s3.1] uniform fill only (no per-cell border) so adjacent cells merge into a smooth diamond
  if (alive && currentWorld === 2 && !blackHoleAnimating) {
    ctx.save();
    ctx.fillStyle = 'rgba(150,90,235,0.32)';
    for (const c of _dashCells) ctx.fillRect(c[0]*cellSize, c[1]*cellSize, cellSize, cellSize);
    ctx.restore();
  }

  // cube always drawn above lasers (suppressed during teleport — drawBlackHole owns the player visual)
  if (alive && !blackHoleAnimating) _paintCube(); // [2.0-s2]

  // trail
  trails = trails.filter(t => now - t.born < 300);
  for (const t of trails) {
    const age = (now - t.born) / 300;
    ctx.globalAlpha = (1-age) * 0.6;
    ctx.fillStyle = skinColor();
    const s = cellSize * (1 - age * 0.5);
    const ox = t.x * cellSize + (cellSize-s)/2;
    const oy = t.y * cellSize + (cellSize-s)/2;
    ctx.beginPath();
    ctx.roundRect(ox, oy, s, s, 3);
    ctx.fill();
  }

  // particles
  particles = particles.filter(p => now - p.born < p.life);
  for (const p of particles) {
    const age = (now - p.born) / p.life;
    ctx.globalAlpha = (1-age) * 0.9;
    ctx.fillStyle = p.color;
    const s = p.size * (1-age*0.6);
    ctx.beginPath();
    ctx.roundRect(
      p.x + p.vx*(now-p.born)/1e3 - s/2,
      p.y + p.vy*(now-p.born)/1e3 + 60*(now-p.born)*(now-p.born)/1e6 - s/2,
      s, s, 2
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // [1.11] Boss — drawn above particles, below pause overlay
  if (bossActive) { w2Boss ? drawW2Boss(now) : drawBoss(bossTier, now); } // [1.11][2.0-s4b]

  // [2.0-s2] Asteroids (World 2) and Black Hole teleport
  if (currentWorld === 2 && asteroids.length > 0) drawAsteroids(now);
  if (blackHoleAnimating) drawBlackHole(now);

  // [1.12] GRIDLOCK scanlines overlay
  if (gridlockActive) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#000';
    for (let sy = 0; sy < canvas.height; sy += 4) ctx.fillRect(0, sy, canvas.width, 2);
    ctx.restore();
  }

  // [1.10.2] Pause overlay — drawn on top of everything
  // [2.0-pause] ...except during a player pause, which puts its own DOM overlay up. Both routes
  // set gamePaused, so without this check an ad pause and a player pause would render at once.
  if (gamePaused && !_pausedByPlayer) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0cf';
    ctx.font = `bold ${Math.round(canvas.width/14)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', canvas.width/2, canvas.height/2);
    ctx.textAlign = 'left';
  }

  // animated skins — refresh every frame
  if (alive && ANIMATED_SKINS.has(skinId)) skinAnimT++;

  const shouldContinue = particles.length > 0 || trails.length > 0
    || (alive && ANIMATED_SKINS.has(skinId))
    || (lasers.length > 0 && !bossActive) // [1.11]
    || gamePaused         // [1.10.2] keep running to display pause overlay
    || bossActive         // [1.11] keep running for boss animations
    || bossRound          // [1.11] keep running during boss intro (before bossActive)
    || gridlockActive     // [1.12] keep running for scanlines animation
    || asteroids.length > 0 // [2.0-s2] keep running for asteroids
    || blackHoleAnimating;  // [2.0-s2] keep running for teleport animation
  if (shouldContinue) animFrame = requestAnimationFrame(animLoop);
  else { animFrame = null; }
}

function startAnim() {
  if (!animFrame) animFrame = requestAnimationFrame(animLoop);
}

function spawnTrail(fromX, fromY, toX, toY) {
  // points along dash path
  const steps = Math.max(Math.abs(toX-fromX), Math.abs(toY-fromY));
  for (let i=1; i<steps; i++) {
    const t = i/steps;
    trails.push({
      x: fromX + (toX-fromX)*t,
      y: fromY + (toY-fromY)*t,
      born: Date.now() - i*10
    });
  }
  startAnim();
}

function spawnDeath(x, y) {
  const cx = (x + 0.5) * cellSize, cy = (y + 0.5) * cellSize;
  const col = skinColor();
  for (let i=0; i<18; i++) {
    const angle = (Math.PI*2/18)*i + Math.random()*0.3;
    const spd = 60 + Math.random()*120;
    particles.push({
      x:cx, y:cy,
      vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 40,
      color: i%3===0 ? '#fff' : col,
      size: 4 + Math.random()*6,
      born: Date.now(), life: 600 + Math.random()*400
    });
  }
  startAnim();
}

function spawnBlockImpact(x, y) {
  const cx = (x+0.5)*cellSize, cy = (y+0.5)*cellSize;
  for (let i=0; i<8; i++) {
    const angle = Math.PI + Math.random()*Math.PI; // explodes upward
    const spd = 30+Math.random()*60;
    particles.push({
      x:cx, y:cy,
      vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd,
      color:'#ffa040', size:3+Math.random()*4, // [2.0-w1fix] match the burnt-orange block
      born:Date.now(), life:300+Math.random()*200
    });
  }
  startAnim();
}

function spawnDashParticles(px, py) { // [1.9.3]
  const cx = (px + 0.5) * cellSize, cy = (py + 0.5) * cellSize;
  const col = (LASER_COLORS[laserColorId] || LASER_COLORS.red).fire;
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 80 + Math.random() * 100;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      color: col,
      size: 3 + Math.random() * 4,
      born: Date.now(), life: 260 + Math.random() * 80
    });
  }
  startAnim();
}
