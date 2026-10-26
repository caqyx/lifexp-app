// [MODULE] Every cached DOM element reference, collected from the 7 places they had scattered to.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// DOM
// ══════════════════════════════════════════════════
const screenStart  = document.getElementById('screen-start');
const appEl        = document.getElementById('app');
const boardEl      = document.getElementById('board');
const canvas       = document.getElementById('anim-canvas');
const ctx          = canvas.getContext('2d');
const hudCoins     = document.getElementById('hud-coins');
const hudInfo      = document.getElementById('hud-info');
const hudDash      = document.getElementById('hud-dash');
const hudCombo     = document.getElementById('hud-combo'); // [1.9.2]
const hudTimerEl   = document.getElementById('hud-timer');   // [1.10]
const hudGridlock  = document.getElementById('hud-gridlock'); // [1.12]
const hudBlackhole = document.getElementById('hud-blackhole'); // [2.0-s2]
// [2.0-deemoji] value spans — the icon beside them is static SVG in index.html, so the HUD tick
// only ever writes text and the markup is never re-parsed
const hudDashVal      = document.getElementById('hud-dash-val');
const hudComboVal     = document.getElementById('hud-combo-val');
const hudTimerVal     = document.getElementById('hud-timer-val');
const hudGridlockVal  = document.getElementById('hud-gridlock-val');
const hudBlackholeVal = document.getElementById('hud-blackhole-val');
const msgEl        = document.getElementById('msg');
const shopBtn      = document.getElementById('shop-btn');
const shopEl       = document.getElementById('shop');
const shopBal      = document.getElementById('shop-bal');
const shopGrid     = document.getElementById('shop-grid');
const shopGridBL   = document.getElementById('shop-grid-bl'); // [1.9]
const shopClose    = document.getElementById('shop-close');
// [2.0-s5c] Void Shop elements
const voidShopEl   = document.getElementById('void-shop');
const voidBalEl    = document.getElementById('void-bal');
const voidOpenerEl = document.getElementById('void-opener');
const voidCollEl   = document.getElementById('void-collection');
const voidRevealEl = document.getElementById('void-reveal');
const voidReelStrip= document.getElementById('void-reel-strip');
const voidReelVp   = document.getElementById('void-reel-viewport');
const voidRevealCard = document.getElementById('void-reveal-card');
const voidRevealOk = document.getElementById('void-reveal-ok');
const deathOverlay = document.getElementById('death-overlay');
const deathStats   = document.getElementById('death-stats');
const screenStats = document.getElementById('screen-stats');
const screenPin    = document.getElementById('screen-pin');
const menuCoinsEl = document.getElementById('menu-coins');
const _tutCoachEl = document.getElementById('tut-coach');
const _tutSkipEl  = document.getElementById('tut-skip');
const resetDialog = document.getElementById('reset-dialog');
