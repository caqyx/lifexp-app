// [MODULE] The coin shop: cube skins, board skins, laser colours, and the lock/unlock visuals.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
let shopActiveTab  = 'cube'; // [1.9]
// ══════════════════════════════════════════════════
// SKLEP
// ══════════════════════════════════════════════════
let shopFromMenu = false;
function openShop(fromMenu=false){
  shopFromMenu = fromMenu;
  clearTimeout(phaseTimer);
  // hide every screen — the shop covers everything via z-index:60
  SCREENS.forEach(s=>{
    const el = s==='app' ? appEl : document.getElementById(s);
    if (el) { el.style.visibility='hidden'; el.style.pointerEvents='none'; }
  });
  shopEl.classList.add('open');
  playShopOpen(); // [1.9.2]
  renderShop();
}
function closeShop(){
  shopEl.classList.remove('open');
  if (shopFromMenu) showMenu();
  else if (alive) { showScreen('app'); startRound(); }
  else showMenu();
}
let _shopUnlockFx = null; // [2.0-w1fix] {kind:'skin'|'board'|'laser', id} — one-shot baton, consumed by the next renderShop()

function renderShop(){ // [1.9] tab-aware
  shopBal.textContent=`🪙 ${coins}`;
  // sync tab buttons
  const tabCube = document.getElementById('shop-tab-cube');
  const tabBL   = document.getElementById('shop-tab-bl');
  if (tabCube) tabCube.classList.toggle('active', shopActiveTab==='cube');
  if (tabBL)   tabBL.classList.toggle('active', shopActiveTab==='bl');

  if (shopActiveTab === 'cube') {
    shopGrid.style.display = '';
    if (shopGridBL) shopGridBL.style.display = 'none';
    renderShopCubeTab();
  } else {
    shopGrid.style.display = 'none';
    if (shopGridBL) { shopGridBL.style.display = ''; renderShopBLTab(); }
  }
  _shopUnlockFx = null; // [2.0-w1fix] one-shot — never carries over into a later render
}

// ── SHOP LOCK / UNLOCK VISUALS ── [2.0-w1fix]
// Every locked item now wears the same SVG padlock overlay; what separates the two kinds is what
// sits *under* it. Ordinary unowned items show their real preview, greyed. Prestige items show a
// blank tile and a gold padlock — no preview at all, because you can't buy your way to them.
function _shopDrawLockTile(cv) { // [2.0-w1fix] blank prestige tile — [2.0-deemoji] the lock is now a DOM overlay
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#0a0a18'; c2.fillRect(0, 0, cv.width, cv.height);
}

function _shopLockOverlay() { // [2.0-w1fix] thin outline padlock, same line-art style as the mode-card icons
  const el = document.createElement('div');
  el.className = 'shop-lock-overlay';
  el.innerHTML = `<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/>`
               + `<path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><circle cx="12" cy="15.5" r="1.3"/></svg>`;
  return el;
}

function _shopMarkLocked(card) { // [2.0-w1fix] affordable-or-not, it just isn't owned yet
  card.classList.add('shop-locked');
  card.appendChild(_shopLockOverlay());
}

function _shopMarkLockedPrestige(card) { // [2.0-deemoji] gold padlock over the blank tile
  const lock = _shopLockOverlay();
  lock.classList.add('prestige');
  card.appendChild(lock);
}

function _shopPlayUnlockFx(card, kind, id) { // [2.0-w1fix] lock falls away, then the preview glows
  if (!_shopUnlockFx || _shopUnlockFx.kind !== kind || _shopUnlockFx.id !== id) return;
  _shopUnlockFx = null;
  const lock = _shopLockOverlay();
  lock.classList.add('shop-unlock-anim');
  card.appendChild(lock);
  card.classList.add('shop-glow-reveal');
  setTimeout(() => lock.remove(), 420);
  setTimeout(() => card.classList.remove('shop-glow-reveal'), 2500);
}

function _shopDeny(cardEl) { // [2.0-w1fix] can't afford it: sound + shake, no text — the balance line stays a balance line
  playError();
  if (!cardEl) return;
  cardEl.classList.remove('shake-deny'); void cardEl.offsetWidth; cardEl.classList.add('shake-deny');
  setTimeout(() => cardEl.classList.remove('shake-deny'), 340);
}

function renderShopCubeTab() { // [1.9] extracted from old renderShop
  shopGrid.innerHTML='';
  const cats = ['Patterns','Effects','Shapes','Prestige'];
  for (const cat of cats) {
    const header = document.createElement('div');
    header.style.cssText='grid-column:1/-1;font-size:11px;letter-spacing:2px;margin-top:8px;';
    header.style.color = cat==='Prestige' ? '#ffd700' : '#0cf';
    header.textContent = `— ${cat.toUpperCase()} —`;
    if (cat==='Prestige') {
      const sub = document.createElement('div');
      sub.style.cssText='grid-column:1/-1;font-size:9px;color:#664;margin-top:-4px;letter-spacing:1px;';
      sub.textContent = 'Unlock by beating round records — not purchasable'; // [1.9]
      shopGrid.appendChild(header);
      shopGrid.appendChild(sub);
    } else {
      shopGrid.appendChild(header);
    }

    for (const s of SKINS.filter(x=>x.cat===cat)) {
      const isOwned=owned.includes(s.id), isActive=skinId===s.id;
      const isPrestige=!!s.unlock;
      const isLocked=isPrestige && !isOwned;

      const card=document.createElement('div');
      card.className='skin-card'+(isActive?' active':isOwned?' owned':'');
      if (isLocked) card.style.opacity='.5';

      const cv=document.createElement('canvas');
      cv.width=cv.height=38; cv.className='skin-preview';
      if (!isLocked) {
        drawSkin(cv.getContext('2d'),s.id,0,0,38,skinAnimT);
        if (isActive) cv.style.boxShadow=`0 0 10px ${skinColor()}`;
      } else {
        _shopDrawLockTile(cv); // [2.0-w1fix]
      }

      const nm=document.createElement('div'); nm.className='skin-name'; nm.textContent=s.name;

      const pr=document.createElement('div');
      pr.className='skin-price'+(isOwned||isActive?' owned':'');
      if (isActive)        pr.textContent='✓ Active'; // [1.9]
      else if (isOwned)    pr.textContent='Equip'; // [1.9]
      else if (isLocked)   pr.textContent=`${s.unlockDesc}`;
      else                 pr.textContent=`${s.price} 🪙`;

      if (isLocked) pr.style.cssText='font-size:9px;color:#664;text-align:center;line-height:1.3;';

      card.append(cv,nm,pr);
      if (isLocked) _shopMarkLockedPrestige(card); // [2.0-deemoji] gold padlock over the blank tile
      else { // [2.0-w1fix] ordinary items: greyed preview + thin lock instead of the prestige tile
        if (!isOwned) _shopMarkLocked(card);
        card.addEventListener('click',()=>buySkin(s.id, card));
        _shopPlayUnlockFx(card, 'skin', s.id);
      }
      shopGrid.appendChild(card);
    }
  }
}

function renderShopBLTab() { // [1.9] board skins + laser colors tab
  shopGridBL.innerHTML='';

  // [1.9.1] bug #8: No Grid toggle row (full-width, above board skins)
  const gridToggleRow = document.createElement('div');
  gridToggleRow.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.03);border:1.5px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 14px;cursor:pointer;margin-bottom:4px;';
  const gridLabel = document.createElement('span');
  gridLabel.style.cssText = 'font-size:11px;letter-spacing:2px;color:#88aacc;';
  gridLabel.textContent = 'BOARD GRID LINES';
  const gridStatus = document.createElement('span');
  gridStatus.style.cssText = `font-size:11px;font-weight:bold;letter-spacing:1px;color:${showBoardGrid?'#0cf':'#446'};`;
  gridStatus.textContent = showBoardGrid ? '● ON' : '○ OFF';
  gridToggleRow.append(gridLabel, gridStatus);
  gridToggleRow.addEventListener('click', toggleNoGrid);
  shopGridBL.appendChild(gridToggleRow);

  const isVoid = currentWorld === 2; // [2.0-s5b]

  // ── SECTION A: BOARD SKINS ── [2.0-w1fix] rendered in both worlds again;
  // World 1 buys with coins, World 2 still only drops from the loot box.
  const bHeader = document.createElement('div');
  bHeader.className = 'shop-section-header';
  bHeader.textContent = '— BOARD SKINS —';
  shopGridBL.appendChild(bHeader);

  for (const def of (isVoid ? VOID_BOARD_SKIN_LIST : BOARD_SKIN_LIST)) {
    const isOwned    = isVoid ? voidBoardsOwned.includes(def.id) : boardsOwned.includes(def.id); // [2.0-s5b]
    const isActive   = (isVoid ? boardSkinIdW2 : boardSkinId) === def.id;
    const isPrestige = !!def.unlock;            // [2.0-w1fix] Prestige Gold — record unlock, not purchasable
    const isLocked   = isPrestige && !isOwned;

    const card = document.createElement('div');
    card.className = 'skin-card' + (isActive?' active':isOwned?' owned':'');
    if (isLocked || (isVoid && !isOwned)) card.style.opacity = '.5';

    const cv = document.createElement('canvas');
    cv.width = cv.height = 38; cv.className = 'skin-preview';
    if (isLocked) _shopDrawLockTile(cv); // [2.0-w1fix]
    else {
      drawBoardPreview(cv, def.id);
      if (isActive) cv.style.boxShadow = `0 0 10px ${BOARD_SKINS[def.id].grid}`;
    }

    const nm = document.createElement('div'); nm.className = 'skin-name'; nm.textContent = def.name;
    const pr = document.createElement('div');
    pr.className = 'skin-price' + (isOwned||isActive?' owned':'');
    if (isActive)           pr.textContent = '✓ Active';
    else if (isOwned)       pr.textContent = 'Equip';
    else if (isVoid)        pr.textContent = 'Loot box'; // [2.0-s5b] only obtainable via loot box
    else if (isLocked)    { pr.textContent = def.unlockDesc; pr.style.cssText='font-size:9px;color:#664;text-align:center;line-height:1.3;'; } // [2.0-w1fix]
    else if (def.price===0) pr.textContent = 'Free';
    else                    pr.textContent = `${def.price} 🪙`;

    card.append(cv,nm,pr);
    if (isVoid) {
      if (!isOwned) card.appendChild(_shopLockOverlay()); // [2.0-deemoji] padlock replaces the lock glyph in the price text
      card.addEventListener('click', ()=>buyBoardSkinW2(def.id));
    }
    else if (isLocked) _shopMarkLockedPrestige(card); // [2.0-deemoji] Prestige Gold
    else { // [2.0-w1fix] World 1 board skins are buyable again
      if (!isOwned) _shopMarkLocked(card);
      card.addEventListener('click', ()=>buyBoardSkin(def.id, card));
      _shopPlayUnlockFx(card, 'board', def.id);
    }
    shopGridBL.appendChild(card);
  }

  // ── SECTION B: LASER COLORS ──
  const lHeader = document.createElement('div');
  lHeader.className = 'shop-section-header';
  lHeader.textContent = '— LASER COLORS —';
  shopGridBL.appendChild(lHeader);

  const laserList      = isVoid ? VOID_LASER_COLOR_LIST : LASER_COLOR_LIST; // [2.0-s5a-r8]
  const laserOwnedList = isVoid ? voidLasersOwned : lasersOwned; // [2.0-s5b]
  const laserActiveId  = isVoid ? laserColorIdW2 : laserColorId;
  const buyLaserFn     = isVoid ? buyLaserColorW2 : buyLaserColor;

  for (const def of laserList) {
    const isOwned  = laserOwnedList.includes(def.id);
    const isActive = laserActiveId === def.id;

    const card = document.createElement('div');
    card.className = 'skin-card' + (isActive?' active':isOwned?' owned':'');
    if (isVoid && !isOwned) card.style.opacity = '.5';

    const cv = document.createElement('canvas');
    cv.width = cv.height = 38; cv.className = 'skin-preview';
    drawLaserPreview(cv, def.id);
    if (isActive) cv.style.boxShadow = `0 0 10px ${LASER_COLORS[def.id].fire}`;

    const nm = document.createElement('div'); nm.className = 'skin-name'; nm.textContent = def.name;
    const pr = document.createElement('div');
    pr.className = 'skin-price' + (isOwned||isActive?' owned':'');
    if (isActive)       pr.textContent = '✓ Active';
    else if (isOwned)   pr.textContent = 'Equip';
    else if (isVoid)    pr.textContent = 'Loot box'; // [2.0-s5b] only obtainable via loot box
    else if (def.price===0) pr.textContent = 'Free';
    else                pr.textContent = `${def.price} 🪙`;

    card.append(cv,nm,pr);
    if (!isVoid && !isOwned)     _shopMarkLocked(card); // [2.0-w1fix] W1 lasers get the same locked treatment
    else if (isVoid && !isOwned) card.appendChild(_shopLockOverlay()); // [2.0-deemoji] padlock replaces the lock glyph in the price text
    card.addEventListener('click', ()=>buyLaserFn(def.id, card));
    if (!isVoid) _shopPlayUnlockFx(card, 'laser', def.id); // [2.0-w1fix]
    shopGridBL.appendChild(card);
  }
}
function buySkin(id, cardEl){
  const s=SKINS.find(x=>x.id===id); if(!s||skinId===id) return;
  if (owned.includes(id)){skinId=id; invalidateSkinCache(); save(); playSkinSelect(); renderShop(); return;} // [1.9.2]
  if (coins<s.price){ _shopDeny(cardEl); return; } // [2.0-w1fix] sound + shake, no text
  coins-=s.price; owned.push(id); skinId=id; invalidateSkinCache(); save(); playSkinSelect(); // [1.9.2]
  _shopUnlockFx={kind:'skin',id}; renderShop(); // [2.0-w1fix]
  shopBal.classList.remove('purchase-flash'); void shopBal.offsetWidth; shopBal.classList.add('purchase-flash'); // [1.9.3]
}

// [2.0-w1fix] World 1 board skins — bought with coins (mirrors buyLaserColor); W2 boards stay loot-box-only
function buyBoardSkin(id, cardEl) {
  const def = BOARD_SKIN_LIST.find(b=>b.id===id);
  if (!def) return;
  if (def.unlock && !boardsOwned.includes(id)) return; // Prestige Gold: earned by beating round records
  if (boardsOwned.includes(id)) {
    if (boardSkinId === id) return;
    boardSkinId = id; localStorage.setItem('cm_board', id);
    applyBoardSkin(); playSkinSelect(); renderShop(); return;
  }
  if (def.price > 0 && coins < def.price) { _shopDeny(cardEl); return; }
  if (def.price > 0) coins -= def.price;
  boardsOwned.push(id); localStorage.setItem('cm_boards_owned', JSON.stringify(boardsOwned));
  boardSkinId = id; localStorage.setItem('cm_board', id);
  applyBoardSkin(); save(); playSkinSelect();
  _shopUnlockFx={kind:'board',id}; renderShop();
  shopBal.classList.remove('purchase-flash'); void shopBal.offsetWidth; shopBal.classList.add('purchase-flash');
}

function buyBoardSkinW2(id) { // [2.0-s5a-r9][2.0-s5b] equip-only — ownership comes from the loot box
  const def = VOID_BOARD_SKIN_LIST.find(b=>b.id===id);
  if (!def || !voidBoardsOwned.includes(id)) return; // not owned: no-op, must come from a loot box
  boardSkinIdW2 = id; localStorage.setItem('cm_board_w2', id);
  applyBoardSkin(); playSkinSelect(); renderShop();
}

function buyLaserColor(id, cardEl) { // [1.9]
  const def = LASER_COLOR_LIST.find(c=>c.id===id);
  if (!def) return;
  if (lasersOwned.includes(id)) {
    laserColorId = id; localStorage.setItem('cm_laser', id);
    playSkinSelect(); renderShop(); return; // [1.9.2]
  }
  if (def.price > 0 && coins < def.price) { _shopDeny(cardEl); return; } // [2.0-w1fix] sound + shake, no text
  if (def.price > 0) { coins -= def.price; save(); }
  lasersOwned.push(id); localStorage.setItem('cm_lasers_owned', JSON.stringify(lasersOwned));
  laserColorId = id; localStorage.setItem('cm_laser', id);
  playSkinSelect(); // [1.9.2]
  _shopUnlockFx={kind:'laser',id}; renderShop(); // [2.0-w1fix]
  shopBal.classList.remove('purchase-flash'); void shopBal.offsetWidth; shopBal.classList.add('purchase-flash'); // [1.9.3]
}

function buyLaserColorW2(id) { // [2.0-s5a-r8][2.0-s5b] equip-only — ownership comes from the loot box
  const def = VOID_LASER_COLOR_LIST.find(c=>c.id===id);
  if (!def || !voidLasersOwned.includes(id)) return; // not owned: no-op, must come from a loot box
  laserColorIdW2 = id; localStorage.setItem('cm_laser_w2', id);
  playSkinSelect(); renderShop();
}

function toggleNoGrid() { // [1.9.1]
  showBoardGrid = !showBoardGrid;
  localStorage.setItem('cm_nogrid', showBoardGrid ? '0' : '1');
  renderShop();
}
