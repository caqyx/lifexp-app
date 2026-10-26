// [MODULE] Things that can kill you and the moves that avoid them - asteroids, black hole, dash, blocks.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// [2.0-s2] ASTEROIDS (World 2 moving obstacles)
// ══════════════════════════════════════════════════

function _spawnAsteroid() {
  if (asteroids.filter(a => Date.now() >= a.warnUntil).length >= MAX_ASTEROIDS) return;
  const [dirX, dirY] = ASTEROID_DIRS[Math.floor(Math.random()*ASTEROID_DIRS.length)];
  let sx, sy;
  if (dirX !== 0 && dirY !== 0) { // [2.0-s3.1] diagonal: enter from a random point on one edge (not always corners)
    if (Math.random() < 0.5) { sx = Math.floor(Math.random()*N) + 0.5; sy = dirY > 0 ? -1.5 : N + 0.5; } // top/bottom edge
    else                     { sy = Math.floor(Math.random()*N) + 0.5; sx = dirX > 0 ? -1.5 : N + 0.5; } // left/right edge
  } else {
    if (dirX > 0) sx = -1.5; else if (dirX < 0) sx = N + 0.5; else sx = Math.floor(Math.random()*N) + 0.5;
    if (dirY > 0) sy = -1.5; else if (dirY < 0) sy = N + 0.5; else sy = Math.floor(Math.random()*N) + 0.5;
  }
  // [2.0-s3.1] warning cell = entry cell, clamped into the grid (matches randomized start)
  const ex = Math.max(0, Math.min(N-1, Math.floor(sx)));
  const ey = Math.max(0, Math.min(N-1, Math.floor(sy)));
  asteroids.push({ born: Date.now(), dirX, dirY, sx, sy, ex, ey, warnUntil: Date.now() + 400 });
  startAnim();
}

function scheduleAsteroid() { // self-rescheduling spawner; skips (but survives) boss/pause
  clearTimeout(asteroidTimer);
  const next = () => 2000 + Math.random()*1000;
  asteroidTimer = setTimeout(function tick() {
    if (!_asteroidsEnabled() || !alive) { asteroidTimer = null; return; } // [2.0-s3.1]
    if (!bossRound && !gamePaused) _spawnAsteroid();
    asteroidTimer = setTimeout(tick, next());
  }, next());
}

function _drawAstWarning(a, now) {
  const cx = (a.ex + 0.5) * cellSize, cy = (a.ey + 0.5) * cellSize;
  const blink = 0.4 + 0.6*Math.abs(Math.sin(now*0.012));
  ctx.save();
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#ff2200';
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 8;
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(a.dirY, a.dirX));
  const s = cellSize*0.42;
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(-s*0.4, s*0.6); ctx.lineTo(-s*0.4, -s*0.6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function _drawAstRock(gx, gy, a, now) {
  const cx = (gx + 0.5) * cellSize, cy = (gy + 0.5) * cellSize;
  // fading trail behind
  for (let k = 1; k <= 4; k++) {
    const tx = (gx - a.dirX*k*0.6 + 0.5) * cellSize, ty = (gy - a.dirY*k*0.6 + 0.5) * cellSize;
    ctx.globalAlpha = 0.20 * (1 - k/5);
    ctx.fillStyle = '#ff4400';
    ctx.beginPath(); ctx.arc(tx, ty, cellSize*0.30*(1-k/6), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#554433';
  const r = cellSize*0.38;
  const jag = [1,0.7,1,0.65,0.95,0.7,1,0.6];
  ctx.beginPath();
  for (let i=0;i<8;i++){ const ang=(i/8)*Math.PI*2; const rr=r*jag[i];
    const px=cx+Math.cos(ang)*rr, py=cy+Math.sin(ang)*rr;
    if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#332211'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawAsteroids(now) {
  // despawn once fully off the far edge
  asteroids = asteroids.filter(a => {
    const t = now - a.warnUntil;
    const gx = a.sx + a.dirX*ASTEROID_SPEED*t, gy = a.sy + a.dirY*ASTEROID_SPEED*t;
    return !((a.dirX>0&&gx>N+1)||(a.dirX<0&&gx<-1)||(a.dirY>0&&gy>N+1)||(a.dirY<0&&gy<-1));
  });
  for (const a of asteroids) {
    if (now < a.warnUntil) { _drawAstWarning(a, now); continue; }
    const t = now - a.warnUntil;
    const gx = a.sx + a.dirX*ASTEROID_SPEED*t, gy = a.sy + a.dirY*ASTEROID_SPEED*t;
    _drawAstRock(gx, gy, a, now);
    const cx = Math.floor(gx), cy = Math.floor(gy);
    if (cx>=0&&cx<N&&cy>=0&&cy<N && cx===cube.x && cy===cube.y
        && !blackHoleAnimating && !tutorialActive) { // [2.0-s4h] immortal during the tutorial
      die('asteroid'); return;
    }
  }
}

// ══════════════════════════════════════════════════
// [2.0-s2] BLACK HOLE TELEPORT (World 2 long-range move)
// ══════════════════════════════════════════════════
function _resetBlackHole() {
  clearTimeout(_bhTimer); _bhTimer = null; _bhFiresAt = 0; _bhRemaining = 0;
  blackHoleAnimating = false; blackHole = null;
}

function updateBlackHoleHud() { // [2.0-s2] cooldown indicator, World 2 only
  if (!hudBlackhole) return;
  if (!_blackHoleEnabled()) { hudBlackhole.style.display = 'none'; return; } // [2.0-s3.1]
  hudBlackhole.style.display = '';
  // [2.0-deemoji] value-only writes; the singularity icon is static SVG and picks up bh-ready /
  // bh-cooldown colour through stroke:currentColor
  const _bh = (txt, cls) => { hudBlackholeVal.textContent = txt; hudBlackhole.className = cls; };
  if (w2Boss && bossRound) { // [2.0-s4g] time-based countdown during W2 boss
    const msLeft = blackHoleReadyAt - Date.now();
    if (msLeft <= 0) _bh('Ready', 'bh-ready');
    else             _bh(`${Math.ceil(msLeft/1000)}s`, 'bh-cooldown');
  } else {
    if (blackHoleCooldown <= 0) _bh('Ready', 'bh-ready');
    else                        _bh(`${blackHoleCooldown}r`, 'bh-cooldown');
  }
}

function _bhParticles(gx, gy, inward) {
  const cx = (gx+0.5)*cellSize, cy = (gy+0.5)*cellSize;
  for (let i=0;i<14;i++){
    const ang = Math.random()*Math.PI*2, spd = 60 + Math.random()*90;
    if (inward) {
      const dist = cellSize*0.9;
      particles.push({ x: cx+Math.cos(ang)*dist, y: cy+Math.sin(ang)*dist,
        vx: -Math.cos(ang)*spd, vy: -Math.sin(ang)*spd,
        color: 'hsla(275,80%,70%,1)', size: 2+Math.random()*3, born: Date.now(), life: 230+Math.random()*70 });
    } else {
      particles.push({ x: cx, y: cy, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        color: 'hsla(285,90%,75%,1)', size: 2+Math.random()*4, born: Date.now(), life: 300+Math.random()*120 });
    }
  }
  startAnim();
}

function startBlackHole(tx, ty) {
  blackHole = { born: Date.now(), origin: { x: cube.x, y: cube.y }, dest: { x: tx, y: ty } };
  blackHoleAnimating = true;
  _bhParticles(cube.x, cube.y, true);
  cube.x = tx; cube.y = ty; // logic moves now; visuals are owned by drawBlackHole
  playBlackHole();
  _bhFiresAt = Date.now() + 500;
  _bhTimer = setTimeout(_bhFinish, 500);
  setTimeout(() => { if (blackHoleAnimating) _bhParticles(tx, ty, false); }, 250);
  startAnim();
}

function _bhFinish() {
  _bhTimer = null; _bhFiresAt = 0;
  blackHoleAnimating = false; blackHole = null;
  if (!alive) return;
  if (w2Boss && bossRound) { // [2.0-s4g] time-based cooldown during W2 boss
    blackHoleReadyAt = Date.now() + 10000;
  } else {
    blackHoleCooldown = 3; // [2.0-s3.3]
  }
  if (w2Boss) _w2OnPlayerMoved(); // [2.0-s4e] teleporting onto a hit plate / crater registers like a dash landing
  render();
}

function _bhHoleR(t, a, b, c, e) { // radius envelope: 0 at a, full b..c, 0 at e
  const max = cellSize*0.78;
  if (t < a || t > e) return 0;
  if (t < b) return max * (t-a)/(b-a);
  if (t > c) return max * (1-(t-c)/(e-c));
  return max;
}

function _drawHole(cx, cy, r, now) {
  if (r <= 0) return;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, '#000'); g.addColorStop(0.7, '#1a0030'); g.addColorStop(1, 'rgba(40,0,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(180,80,255,.7)'; ctx.lineWidth = 1.5;
  const rot = now*0.012;
  for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(cx, cy, r*0.7, rot+i*2.1, rot+i*2.1+1.2); ctx.stroke(); }
  ctx.restore();
}

function drawBlackHole(now) {
  if (!blackHole) return;
  const t = now - blackHole.born;
  const o = blackHole.origin, d = blackHole.dest;
  const ocx = (o.x+0.5)*cellSize, ocy = (o.y+0.5)*cellSize;
  const dcx = (d.x+0.5)*cellSize, dcy = (d.y+0.5)*cellSize;
  _drawHole(ocx, ocy, _bhHoleR(t, 0, 250, 450, 500), now);   // origin hole
  _drawHole(dcx, dcy, _bhHoleR(t, 250, 350, 450, 500), now); // destination hole
  // player: shrink at origin (100–250), grow at dest (350–450)
  let scale, px, py;
  if (t < 100)      { scale = 1;                 px = ocx; py = ocy; }
  else if (t < 250) { scale = 1 - (t-100)/150;   px = ocx; py = ocy; }
  else if (t < 350) { scale = 0;                 px = dcx; py = dcy; }
  else if (t < 450) { scale = (t-350)/100;       px = dcx; py = dcy; }
  else              { scale = 1;                 px = dcx; py = dcy; }
  if (scale > 0.01) {
    const sz = cellSize * scale;
    ctx.drawImage(getSkinCanvas(skinAnimT), px - sz/2, py - sz/2, sz, sz);
  }
}

// ══════════════════════════════════════════════════
// DASH
// ══════════════════════════════════════════════════
let _dashPressX = -1, _dashPressY = -1; // [2.0-s4] cell where the dash was first pressed (target locked on press)
function tryDash(x,y) {
  if (!alive) return;
  if (gamePaused) return; // [1.10.2] no input while the game is frozen
  if (blackHoleAnimating) return; // [2.0-s2] input locked during teleport
  if (_w2Pulling) return; // [2.0-s4c] input locked while a gravity/black-hole pull is animating
  if (x===cube.x&&y===cube.y) return;

  const dx=x-cube.x, dy=y-cube.y, d=Math.abs(dx)+Math.abs(dy);

  // [2.0-s4f] SINGULARITY black-hole blocks — clicking within 5 cells of any active hole yanks you toward the closest one
  {
    const _now = Date.now();
    let _nearest = null, _nearDist = Infinity;
    for (const h of w2BhBlocks) {
      if (_now >= h.until) continue;
      const d = Math.abs(x - h.x) + Math.abs(y - h.y);
      if (d <= 5 && d < _nearDist) { _nearest = h; _nearDist = d; }
    }
    if (_nearest) {
      _bhParticles(_nearest.x, _nearest.y, true);
      playSound('dash');
      _w2PullPlayer(_nearest.x, _nearest.y, 3);
      render();
      return;
    }
  }

  // [2.0-s2] World 2: long-range click = Black Hole teleport (independent of dashesLeft)
  if (_blackHoleEnabled() && d > DASH_RANGE) { // [2.0-s3.1]
    if (w2Boss && bossRound) { // [2.0-s4g] time-based gate during W2 boss
      if (Date.now() < blackHoleReadyAt) { flash('NOT READY'); return; }
    } else {
      if (blackHoleCooldown > 0) { flash('NOT READY'); return; }
    }
    const dest = `${x},${y}`;
    if (getBossCells().has(dest) || bossShockwaveCells.has(dest) || flareCellHas(x,y)) { flash('Blocked!'); return; }
    startBlackHole(x, y);
    return;
  }

  if (dashesLeft<=0 && !bossRound && !tutorialActive){flash('No dash available!');return;} // [1.9][1.11][2.0-s4h]
  const prevX=cube.x, prevY=cube.y;

  if (d<=DASH_RANGE) { cube.x=x; cube.y=y; }
  else {
    const sx=Math.round(DASH_RANGE*Math.abs(dx)/d), sy=DASH_RANGE-sx;
    cube.x=Math.max(0,Math.min(N-1,cube.x+Math.sign(dx)*sx));
    cube.y=Math.max(0,Math.min(N-1,cube.y+Math.sign(dy)*sy));
  }

  // [1.11] Block dash into boss cells or active shockwave
  if (bossActive || bossShockwaveCells.size > 0) {
    const dest = `${cube.x},${cube.y}`;
    if (getBossCells().has(dest) || bossShockwaveCells.has(dest)) {
      cube.x = prevX; cube.y = prevY;
      flash('Blocked!');
      render();
      return;
    }
  }

  spawnDashParticles(prevX, prevY); // [1.9.3]
  spawnTrail(prevX, prevY, cube.x, cube.y);
  playSound('dash');
  if (!bossRound && !tutorialActive) dashesLeft--; // [1.11][2.0-s4h] unlimited dashes during a boss fight and the tutorial

  // near miss — check if laser fire is on adjacent cell
  for (const L of lasers) {
    if (L.state !== 'fire') continue;
    const onRow = L.type==='row' && Math.abs(cube.y - L.idx) === 1;
    const onCol = L.type==='col' && Math.abs(cube.x - L.idx) === 1;
    if (onRow || onCol) { playSound('near_miss'); break; }
  }

  // [2.0-w1fix] a real dodge: the dash flew over a beam that was firing, and the player came out alive
  const _crossed = _lasersCrossedByDash(prevX, prevY, cube.x, cube.y);
  checkDeathByLaser();
  if (alive) for (const k of _crossed) {
    if (!_roundDodgedKeys.has(k)) { _roundDodgedKeys.add(k); roundLasersDodgedByDash++; }
  }
  if (w2Boss) _w2OnPlayerMoved(); // [2.0-s4b] plate-step + crater death after the move
  if (tutorialActive) _tutOnDash(); // [2.0-s4h] advance the scripted tutorial on the player's dash
  render();
}

// ══════════════════════════════════════════════════
// BLOCKS
// ══════════════════════════════════════════════════
function _genLasers(total) { // [2.0-s3.2] build a fresh laser set into `lasers` (extracted from startRound)
  lasers=[]; const uR=new Set(), uC=new Set();
  const rng = _dailyRng || Math.random; // [1.10]
  let i = 0;
  if (gamesPlayed > 0) { // [fix] whole first-ever game (all rounds) gets fully random lasers, no guaranteed hit on spawn
    if (rng()<.5){lasers.push({type:'row',idx:cube.y,state:'charge'});uR.add(cube.y);} // [1.10]
    else         {lasers.push({type:'col',idx:cube.x,state:'charge'});uC.add(cube.x);}
    i = 1;
  }
  for (; i<total; i++) {
    if (i%2===0){let idx;do{idx=Math.floor(rng()*N);}while(uR.has(idx));uR.add(idx);lasers.push({type:'row',idx,state:'charge'});} // [1.10]
    else        {let idx;do{idx=Math.floor(rng()*N);}while(uC.has(idx));uC.add(idx);lasers.push({type:'col',idx,state:'charge'});}
  }
}

function generateBlocks(countOverride) { // [2.0-s3.2] optional count for the sandbox
  const rng = _dailyRng || Math.random; // [1.10]
  const count = countOverride ?? Math.min(1+Math.floor((round-1)/BLOCK_INTERVAL), MAX_BLOCKS);
  blocks = [];
  const occ = new Set([`${cube.x},${cube.y}`]);
  for (const L of lasers) {
    if (L.type==='row') for (let x=0;x<N;x++) occ.add(`${x},${L.idx}`);
    else                for (let y=0;y<N;y++) occ.add(`${L.idx},${y}`);
  }
  for (let i=0;i<count;i++) {
    let x,y,k,t=0;
    do { x=Math.floor(rng()*N); y=Math.floor(rng()*N); k=`${x},${y}`; t++; } // [1.10]
    while (occ.has(k)&&t<200);
    if (t<200){occ.add(k);blocks.push({x,y,state:'charge'});}
  }
}
// [2.0-w1fix] Which firing beams did this dash pass over? A dash is a teleport, so "crossed" means the
// beam's row/column sits strictly between the start and end cell — strict, so starting on or landing on
// a beam never counts (landing on one is death anyway). Returns stable keys for per-round dedupe.
function _lasersCrossedByDash(x0, y0, x1, y1) {
  const out = [];
  for (const L of lasers) {
    if (L.state !== 'fire') continue;
    const a = L.type === 'row' ? y0 : x0, b = L.type === 'row' ? y1 : x1;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    for (const i of laserIdxs(L)) if (i > lo && i < hi) { out.push(`${L.type}:${L.idx}`); break; } // 2-wide W2 flare counts once
  }
  return out;
}
