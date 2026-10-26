// [MODULE] Idle-menu easter egg. After 5 minutes of inactivity on the main menu
// (#screen-start), a pixel-art capybara pops up in the corner with a clickable
// speech bubble that cycles through a short line sequence. Purely a session toy —
// nothing here is ever written to localStorage.
// ── CAPYBARA EASTER EGG ──

const CAPY_IDLE_MS     = 300000; // 5 min of inactivity on #screen-start before it appears
const CAPY_AUTOHIDE_MS = 15000;  // hides itself if the bubble goes untouched this long
const CAPY_LINES = [
  "Why are you still here?",
  "Seriously, go touch some grass.",
  "...or keep playing, I'm not your mom.",
  "Okay fine, one more round won't hurt.",
  "This is my final form. Bye.",
];

let _capyOnStartScreen = false; // mirrors #screen-start's real visibility — see _capybaraPoll()
let _capyVisible       = false;
let _capyLineIdx       = 0;
let _capyIdleTimer     = null;
let _capyAutoHideTimer = null;

const _capyEggEl    = document.getElementById('capybara-egg');
const _capySpriteEl = document.getElementById('capybara-sprite');
const _capyBubbleEl = document.getElementById('capybara-bubble');

// ── pixel art: hand-authored row spans on an 18×10 grid, auto-outlined ──
// A "loaf" body (dominant, squat) with a smaller head merged in at the front,
// two small ears, a blunt lighter snout, one eye. Kept intentionally simple —
// this renders at ~54px on screen and rotated ~70deg, so fine detail is wasted.
function _capyDrawSprite() {
  if (!_capySpriteEl) return;
  const W = 18, H = 10;
  const PAL = { b:'#a9764a', s:'#7f5230', l:'#d9b27c', k:'#231208', eye:'#0e0906', nose:'#2c1a10' };
  const grid = Array.from({length:H}, () => Array(W).fill(null));
  const span = (y,x0,x1,c) => { for (let x=x0;x<=x1;x++) if (x>=0 && x<W) grid[y][x]=PAL[c]; };

  span(0, 6,7,'s');  span(0, 10,11,'s');          // two small ears
  span(1, 4,14,'b');                               // head — already wide, ears sit right on it
  span(2, 2,16,'b'); span(2, 15,16,'l');           // widening, snout starting (light)
  span(3, 0,17,'b'); span(3, 15,17,'l');           // full width, snout tip
  span(4, 0,17,'b'); span(4, 14,17,'l');
  span(5, 0,16,'b');
  span(6, 0,14,'b');
  span(7, 1,11,'b');
  span(8, 2,9,'b');
  span(9, 3,4,'k'); span(9, 7,8,'k');              // tiny leg hints
  grid[2][11] = PAL.eye;
  grid[3][17] = PAL.nose;

  // outline pass: any filled pixel touching empty space gets the dark edge colour
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    if (!grid[y][x] || grid[y][x]===PAL.eye || grid[y][x]===PAL.nose) continue;
    for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const ny=y+dy, nx=x+dx;
      if (ny<0||ny>=H||nx<0||nx>=W||!grid[ny][nx]) { grid[y][x]=PAL.k; break; }
    }
  }

  const ctx2 = _capySpriteEl.getContext('2d');
  ctx2.imageSmoothingEnabled = false;
  ctx2.clearRect(0, 0, W, H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (grid[y][x]) { ctx2.fillStyle = grid[y][x]; ctx2.fillRect(x, y, 1, 1); }
}
_capyDrawSprite();

// ── idle tracking ──
// Polls #screen-start's own visibility rather than hooking showScreen(): openShop()
// and openVoidShop() also hide screen-start (to cover it with their own overlay) but
// do it directly, without calling showScreen() — hooking only showScreen() would miss
// them. Every code path that shows/hides a screen sets this same style property, so
// polling it once a second is the one check that can't miss a future call site either.
function _capybaraPoll() {
  const onStart = !!screenStart && screenStart.style.visibility === 'visible';
  if (onStart && !_capyOnStartScreen) {
    _capyOnStartScreen = true;
    _capybaraResetIdleTimer(); // entering the menu — start (or restart) the countdown
  } else if (!onStart && _capyOnStartScreen) {
    _capyOnStartScreen = false;
    clearTimeout(_capyIdleTimer);
    if (_capyVisible) _capybaraHide(); // leaving the menu — never lingers behind another screen
  }
}
setInterval(_capybaraPoll, 1000);

function _capybaraResetIdleTimer() {
  clearTimeout(_capyIdleTimer);
  if (!_capyOnStartScreen || _capyVisible) return; // only counts down toward the NEXT appearance
  _capyIdleTimer = setTimeout(_capybaraShow, CAPY_IDLE_MS);
}

function _capybaraShow() {
  if (!_capyOnStartScreen || _capyVisible || !_capyEggEl) return;
  _capyVisible = true;
  _capyLineIdx = 0;
  _capyBubbleEl.textContent = CAPY_LINES[0];
  _capyEggEl.style.display = 'flex';
  requestAnimationFrame(() => _capyEggEl.classList.add('show')); // pop-in animation
  playCapybaraPop();
  clearTimeout(_capyAutoHideTimer);
  _capyAutoHideTimer = setTimeout(_capybaraHide, CAPY_AUTOHIDE_MS);
}

function _capybaraHide() {
  if (!_capyVisible || !_capyEggEl) return;
  _capyVisible = false;
  _capyLineIdx = 0; // next appearance always starts the sequence over from line 1
  clearTimeout(_capyAutoHideTimer);
  _capyEggEl.classList.remove('show');
  setTimeout(() => { if (!_capyVisible) _capyEggEl.style.display = 'none'; }, 240); // matches the opacity transition
  _capybaraResetIdleTimer(); // a fresh 5 minutes of idleness is required for the next appearance
}

function _capybaraNextLine() {
  if (!_capyVisible) return;
  _capyLineIdx = (_capyLineIdx + 1) % CAPY_LINES.length; // loops forever — no natural "end"
  _capyBubbleEl.textContent = CAPY_LINES[_capyLineIdx];
  clearTimeout(_capyAutoHideTimer);
  _capyAutoHideTimer = setTimeout(_capybaraHide, CAPY_AUTOHIDE_MS);
  playUISound('click');
}
if (_capyBubbleEl) _capyBubbleEl.addEventListener('click', (e) => { e.stopPropagation(); _capybaraNextLine(); });

// Any other click while the menu is the active screen either resets the boredom
// clock (capybara not shown yet — this is what "activity resets idle" means) or,
// if it's already up, dismisses it. Bubble clicks never reach here — stopPropagation
// above keeps them from being read as "click elsewhere".
document.addEventListener('click', () => {
  if (!_capyOnStartScreen) return;
  if (_capyVisible) _capybaraHide();
  else _capybaraResetIdleTimer();
});
