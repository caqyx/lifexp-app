// [MODULE] World 2 Void loot box - roll engine, reel animation, reveal, and collection UI.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
function _voidItemName(item) { // [2.0-s5c]
  if (item.cat === 'skin')  return VOID_SKIN_NAMES[item.id] || item.id;
  if (item.cat === 'board') return (VOID_BOARD_SKIN_LIST.find(b=>b.id===item.id)||{}).name || item.id;
  return (VOID_LASER_COLOR_LIST.find(l=>l.id===item.id)||{}).name || item.id;
}
// ══════════════════════════════════════════════════
// VOID SHOP — LOOT BOX ENGINE [2.0-s5b]
// State/RNG/ownership only — no UI. 5c calls openFreeBox()/buyBox() and renders the result.
// ══════════════════════════════════════════════════
function _boxCheckReset() {
  const today = _todayStr();
  if (box_boughtDate !== today) {
    box_boughtToday = 0; box_boughtDate = today;
    localStorage.setItem('cm_world2_box_bought_date', today);
    localStorage.setItem('cm_world2_box_bought', '0');
  }
}
function canOpenFreeBox() { _boxCheckReset(); return box_lastFreeDate !== _todayStr(); }
function canBuyBox()      { _boxCheckReset(); return box_boughtToday < 2; }
// [2.0-ads] Third source, gated on its own date key: watching an ad neither consumes the daily free
// box nor counts against the 2/day purchase limit. The grant itself lives in offerAdBox()
// (js/ads-rewards.js) so the date is only written once the reward actually lands.
function canOpenAdBox()   { return box_adWatchedDate !== _todayStr(); }

function _rollTier() {
  const total = Object.values(VOID_TIER_CONFIG).reduce((s,t)=>s+t.weight,0);
  let r = Math.random() * total;
  for (const [tier,cfg] of Object.entries(VOID_TIER_CONFIG)) {
    if ((r -= cfg.weight) < 0) return tier;
  }
  return 'common';
}
function _rollItem(tier) {
  const pool = VOID_LOOT_TABLE.filter(i => i.tier === tier);
  return pool[Math.floor(Math.random() * pool.length)];
}
function _isOwned(item) {
  if (item.cat === 'skin')  return voidSkinsOwned.includes(item.id);
  if (item.cat === 'board') return voidBoardsOwned.includes(item.id);
  return voidLasersOwned.includes(item.id);
}
function _grantItem(item) {
  if (item.cat === 'skin')  { voidSkinsOwned.push(item.id);  localStorage.setItem('cm_world2_skins_owned',  JSON.stringify(voidSkinsOwned)); }
  if (item.cat === 'board') { voidBoardsOwned.push(item.id); localStorage.setItem('cm_world2_boards_owned', JSON.stringify(voidBoardsOwned)); }
  if (item.cat === 'laser') { voidLasersOwned.push(item.id); localStorage.setItem('cm_world2_lasers_owned', JSON.stringify(voidLasersOwned)); }
}
function openFreeBox() {
  if (!canOpenFreeBox()) return null;
  box_lastFreeDate = _todayStr();
  localStorage.setItem('cm_world2_box_date', box_lastFreeDate);
  return _resolveBoxOpen();
}
function buyBox() {
  _boxCheckReset();
  if (!canBuyBox()) return null;
  const BOX_COST = 100; // placeholder, balance later
  if (crystals < BOX_COST) return { error: 'insufficient_funds', need: BOX_COST, have: crystals };
  crystals -= BOX_COST; save();
  box_boughtToday++; localStorage.setItem('cm_world2_box_bought', String(box_boughtToday));
  return _resolveBoxOpen();
}
function _resolveBoxOpen() {
  const tier = _rollTier();
  const item = _rollItem(tier);
  const wasDuplicate = _isOwned(item);
  let refund = 0;
  if (wasDuplicate) {
    refund = Math.max(1, Math.floor(VOID_TIER_CONFIG[tier].price * 0.10));
    crystals += refund; save();
  } else {
    _grantItem(item);
  }
  return { item, tier, wasDuplicate, refund };
}
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════
// VOID SHOP — UI: loot box opener + CS2-style tier reveal + collection [2.0-s5c]
// Visualizes the engine result only; never rolls loot itself.
// ══════════════════════════════════════════════════
const VOID_BOX_COST = 100;        // mirrors buyBox() internal cost
const _VOID_REEL_LEN = 50;        // reel tile count
const _VOID_REEL_WIN = 45;        // index of the tile that holds the real result tier
const _VOID_TILE_W   = 66;        // 60px tile + 6px gap (must match CSS)
let _voidCountdownTimer = null;
let _voidReelBusy = false;

function openVoidShop() {
  SCREENS.forEach(s=>{
    const el = s==='app' ? appEl : document.getElementById(s);
    if (el) { el.style.visibility='hidden'; el.style.pointerEvents='none'; }
  });
  voidShopEl.classList.add('open');
  playShopOpen();
  renderVoidOpener();
  renderVoidCollection();
  clearInterval(_voidCountdownTimer);
  _voidCountdownTimer = setInterval(_updateVoidCountdown, 1000);
}
function closeVoidShop() {
  voidShopEl.classList.remove('open');
  clearInterval(_voidCountdownTimer); _voidCountdownTimer = null;
  showMenu();
}

function renderVoidOpener() {
  voidBalEl.textContent = `✦ ${crystals}`;
  const freeAvail  = canOpenFreeBox();
  const boughtLeft = Math.max(0, 2 - box_boughtToday);
  const canBuy     = canBuyBox();
  const affordBuy  = crystals >= VOID_BOX_COST;
  voidOpenerEl.innerHTML = '';

  // Free box row
  const freeRow = document.createElement('div'); freeRow.className = 'void-open-row';
  const fInfo = document.createElement('div'); fInfo.className = 'void-open-info';
  const fTitle = document.createElement('div'); fTitle.className = 'void-open-title'; fTitle.textContent = 'FREE BOX';
  const fSub = document.createElement('div'); fSub.className = 'void-open-sub'; fSub.id = 'void-free-sub';
  fSub.textContent = freeAvail ? 'Available now — 1 per day' : `Next in ⏳ ${_fmtCountdown(_msUntilMidnight())}`;
  fInfo.append(fTitle, fSub);
  const fBtn = document.createElement('button'); fBtn.className = 'void-open-btn'; fBtn.id = 'void-free-btn';
  fBtn.textContent = 'OPEN FREE BOX'; fBtn.disabled = !freeAvail || _voidReelBusy;
  fBtn.addEventListener('click', ()=>handleVoidOpen('free'));
  freeRow.append(fInfo, fBtn);

  // Buy box row
  const buyRow = document.createElement('div'); buyRow.className = 'void-open-row';
  const bInfo = document.createElement('div'); bInfo.className = 'void-open-info';
  const bTitle = document.createElement('div'); bTitle.className = 'void-open-title'; bTitle.textContent = 'BUY BOX';
  const bSub = document.createElement('div'); bSub.className = 'void-open-sub'; bSub.id = 'void-buy-sub';
  bSub.textContent = !canBuy ? 'Daily limit reached (2/2)' : !affordBuy ? `Not enough ✦ (need ${VOID_BOX_COST})` : `${boughtLeft} / 2 left today`;
  bInfo.append(bTitle, bSub);
  const bBtn = document.createElement('button'); bBtn.className = 'void-open-btn'; bBtn.id = 'void-buy-btn';
  bBtn.textContent = `BUY BOX (${VOID_BOX_COST}✦)`; bBtn.disabled = !canBuy || !affordBuy || _voidReelBusy;
  bBtn.addEventListener('click', ()=>handleVoidOpen('buy'));
  buyRow.append(bInfo, bBtn);

  voidOpenerEl.append(freeRow, buyRow);

  // [2.0-ads] Ad box row — only rendered where ads exist at all, so off CrazyGames the shop looks
  // exactly as it did before.
  if (_adsAvailable()) {
    const adAvail = canOpenAdBox();
    const adRow = document.createElement('div'); adRow.className = 'void-open-row';
    const aInfo = document.createElement('div'); aInfo.className = 'void-open-info';
    const aTitle = document.createElement('div'); aTitle.className = 'void-open-title'; aTitle.textContent = 'AD BOX';
    const aSub = document.createElement('div'); aSub.className = 'void-open-sub'; aSub.id = 'void-ad-sub';
    aSub.textContent = adAvail ? 'Watch an ad — 1 per day, on top of the free box'
                               : `Watched today — next in ⏳ ${_fmtCountdown(_msUntilMidnight())}`;
    aInfo.append(aTitle, aSub);
    const aBtn = document.createElement('button'); aBtn.className = 'void-open-btn'; aBtn.id = 'void-ad-btn';
    aBtn.textContent = 'WATCH AD FOR BOX'; aBtn.disabled = !adAvail || _voidReelBusy || _adBoxPending;
    aBtn.addEventListener('click', ()=>handleVoidOpen('ad'));
    adRow.append(aInfo, aBtn);
    voidOpenerEl.appendChild(adRow);
  }
}

function _updateVoidCountdown() { // per-second refresh of countdown + free-button state
  const fSub = document.getElementById('void-free-sub');
  const fBtn = document.getElementById('void-free-btn');
  if (!fSub || !fBtn) return;
  const freeAvail = canOpenFreeBox();
  fBtn.disabled = !freeAvail || _voidReelBusy;
  fSub.textContent = freeAvail ? 'Available now — 1 per day' : `Next in ⏳ ${_fmtCountdown(_msUntilMidnight())}`;
  // [2.0-ads] same treatment for the ad row, which only exists when the SDK does
  const aSub = document.getElementById('void-ad-sub');
  const aBtn = document.getElementById('void-ad-btn');
  if (!aSub || !aBtn) return;
  const adAvail = canOpenAdBox();
  aBtn.disabled = !adAvail || _voidReelBusy || _adBoxPending;
  aSub.textContent = adAvail ? 'Watch an ad — 1 per day, on top of the free box'
                             : `Watched today — next in ⏳ ${_fmtCountdown(_msUntilMidnight())}`;
}

// [2.0-ads] Guards the window between clicking the ad row and the ad resolving. Deliberately not
// _voidReelBusy, which stays true until closeVoidReveal() and would strand the shop if the player
// dismissed the ad.
let _adBoxPending = false;

function handleVoidOpen(kind) {
  if (_voidReelBusy) return;
  if (kind === 'ad') { // [2.0-ads] async source, same reel afterwards
    if (_adBoxPending || !canOpenAdBox()) return;
    _adBoxPending = true;
    renderVoidOpener(); // grey the row out for the duration of the ad
    offerAdBox().then((result) => {
      _adBoxPending = false;
      renderVoidOpener();
      if (result) startTierReel(result); // declined/failed → nothing consumed, row stays available
    });
    return;
  }
  const result = kind === 'free' ? openFreeBox() : buyBox();
  if (!result) { renderVoidOpener(); return; } // gated / unavailable
  if (result.error === 'insufficient_funds') {
    const bSub = document.getElementById('void-buy-sub');
    if (bSub) bSub.textContent = `Not enough ✦ (need ${result.need})`;
    return;
  }
  renderVoidOpener(); // wallet/counters already mutated by the engine
  startTierReel(result);
}

function _reelRollTierVisual() { // cosmetic-only weighted tier pick — must NOT touch engine state
  const total = Object.values(VOID_TIER_CONFIG).reduce((s,t)=>s+t.weight,0);
  let r = Math.random() * total;
  for (const [tier,cfg] of Object.entries(VOID_TIER_CONFIG)) {
    if ((r -= cfg.weight) < 0) return tier;
  }
  return 'common';
}
function _voidTileEl(tier) {
  const t = document.createElement('div'); t.className = 'void-reel-tile';
  const col = VOID_TIER_COLORS[tier];
  if (col.rainbow) t.classList.add('void-reel-tile--rainbow');
  else t.style.background = `linear-gradient(135deg, ${col.c1}, ${col.c2})`;
  const lbl = document.createElement('span'); // [2.0-s5c] show rarity name on the tile
  lbl.className = 'void-reel-label'; lbl.textContent = col.label;
  t.appendChild(lbl);
  return t;
}
function startTierReel(result) {
  _voidReelBusy = true;
  voidReelVp.style.display = '';
  voidRevealCard.classList.remove('show'); voidRevealCard.innerHTML = '';
  voidRevealOk.classList.remove('show');
  voidRevealEl.classList.add('open');

  // build tiles (visuals only); force the winning index to the engine's tier
  voidReelStrip.innerHTML = '';
  const tiles = [];
  for (let i=0;i<_VOID_REEL_LEN;i++) {
    const tier = i === _VOID_REEL_WIN ? result.tier : _reelRollTierVisual();
    const el = _voidTileEl(tier);
    tiles.push(el); voidReelStrip.appendChild(el);
  }
  // reset, then animate on next frame
  voidReelStrip.style.transition = 'none';
  voidReelStrip.style.transform = 'translateX(0px)';
  const vpW = voidReelVp.clientWidth;
  const tileCenter = 6 /*strip padding*/ + _VOID_REEL_WIN * _VOID_TILE_W + 30 /*half tile*/;
  const jitter = (Math.random()*40 - 20); // ±20px inside the tile — avoids always dead-center
  const finalX = tileCenter - vpW/2 + jitter;

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    voidReelStrip.style.transition = 'transform 3.6s cubic-bezier(.12,.7,.16,1)';
    voidReelStrip.style.transform = `translateX(${-finalX}px)`;
  }));

  const onEnd = (e)=>{
    if (e.propertyName !== 'transform') return;
    voidReelStrip.removeEventListener('transitionend', onEnd);
    tiles[_VOID_REEL_WIN].classList.add('void-reel-win');
    setTimeout(()=>revealItem(result), 550);
  };
  voidReelStrip.addEventListener('transitionend', onEnd);
}

function revealItem(result) {
  const { item, tier, wasDuplicate, refund } = result;
  const col = VOID_TIER_COLORS[tier];
  voidReelVp.style.display = 'none';
  voidRevealCard.innerHTML = '';
  voidRevealCard.style.borderColor = col.glow;
  voidRevealCard.style.boxShadow = `0 0 26px ${col.glow}66`;

  const tierEl = document.createElement('div');
  tierEl.className = 'void-reveal-tier'; tierEl.textContent = col.label; tierEl.style.color = col.glow;

  const cv = document.createElement('canvas');
  cv.width = cv.height = 96; cv.className = 'void-reveal-preview';
  if (item.cat === 'skin')       drawSkin(cv.getContext('2d'), item.id, 0, 0, 96, skinAnimT);
  else if (item.cat === 'board') drawBoardPreview(cv, item.id);
  else                           drawLaserPreview(cv, item.id);
  if (wasDuplicate) cv.classList.add('void-dup-grey');

  const nameEl = document.createElement('div');
  nameEl.className = 'void-reveal-name'; nameEl.textContent = _voidItemName(item);
  if (wasDuplicate) nameEl.classList.add('void-dup-grey');

  voidRevealCard.append(tierEl, cv, nameEl);
  if (wasDuplicate) {
    const dup = document.createElement('div');
    dup.className = 'void-reveal-dup'; dup.textContent = `DUPLICATE  +${refund}✦`;
    voidRevealCard.appendChild(dup);
  }
  voidRevealCard.classList.add('show');
  voidRevealOk.classList.add('show');
}

function closeVoidReveal() {
  voidRevealEl.classList.remove('open');
  voidRevealCard.classList.remove('show');
  voidRevealOk.classList.remove('show');
  voidReelVp.style.display = '';
  _voidReelBusy = false;
  renderVoidOpener();
  renderVoidCollection();
}

function renderVoidCollection() {
  voidCollEl.innerHTML = '';
  const cats = [['skin','SKINS'],['board','BOARDS'],['laser','LASERS']];
  for (const [cat, label] of cats) {
    const header = document.createElement('div');
    header.className = 'shop-section-header'; header.textContent = `— ${label} —`;
    voidCollEl.appendChild(header);

    const items = VOID_LOOT_TABLE.filter(i=>i.cat===cat)
      .sort((a,b)=>VOID_TIER_ORDER.indexOf(a.tier)-VOID_TIER_ORDER.indexOf(b.tier));
    for (const item of items) {
      const owned  = _isOwned(item);
      const active = owned && ( // [2.0-s5c] never show a locked/unowned item as active
                     (cat==='skin'  && skinId===item.id)
                  || (cat==='board' && boardSkinIdW2===item.id)
                  || (cat==='laser' && laserColorIdW2===item.id));
      const col = VOID_TIER_COLORS[item.tier];

      const card = document.createElement('div');
      card.className = 'skin-card' + (active?' active':owned?' owned':'');
      if (!owned) card.style.opacity = '.5';
      else if (!active) card.style.borderColor = col.glow;

      const cv = document.createElement('canvas');
      cv.width = cv.height = 38; cv.className = 'skin-preview';
      if (owned) {
        if (cat==='skin')       drawSkin(cv.getContext('2d'), item.id, 0, 0, 38, skinAnimT);
        else if (cat==='board') drawBoardPreview(cv, item.id);
        else                    drawLaserPreview(cv, item.id);
      } else {
        _shopDrawLockTile(cv); // [2.0-deemoji] was an inlined copy of the same tile + a canvas lock glyph
      }

      const nm = document.createElement('div'); nm.className='skin-name'; nm.textContent = owned ? _voidItemName(item) : '???'; // [2.0-s5c] hide unearned item names
      const pr = document.createElement('div'); pr.className='skin-price'+(owned?' owned':'');
      if (active)     pr.textContent='✓ Active';
      else if (owned) pr.textContent='Equip';
      else { pr.textContent=col.label; pr.style.color=col.glow; pr.style.fontSize='9px'; }

      card.append(cv,nm,pr);
      if (!owned) card.appendChild(_shopLockOverlay()); // [2.0-deemoji] padlock over the blank tile
      if (owned) card.addEventListener('click', ()=>equipVoidItem(item));
      voidCollEl.appendChild(card);
    }
  }
}

function equipVoidItem(item) { // no crystal cost — already owned via loot box
  if (!_isOwned(item)) return;
  if (item.cat === 'skin')       { skinId = item.id; invalidateSkinCache(); localStorage.setItem('cm_skin', item.id); save(); }
  else if (item.cat === 'board') { boardSkinIdW2 = item.id; localStorage.setItem('cm_board_w2', item.id); applyBoardSkin(); }
  else                           { laserColorIdW2 = item.id; localStorage.setItem('cm_laser_w2', item.id); }
  playSkinSelect();
  renderVoidCollection();
}
// ─────────────────────────────────────────────────────────────────────────────
