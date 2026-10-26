// [MODULE] Mutable game state - every shared top-level 'let', plus the two load-time migration guards.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
let cells = [], cube = {x:8,y:8}, round = 0, dashesLeft = 2;
let sessionCoinsEarned = 0;  // coins earned this game
// [2.0-ads] Per-game bookkeeping for the rewarded revive. A revive makes die() a repeatable event,
// so anything that must count exactly once per game needs a memory of what it already banked.
let reviveUsedThisGame  = false; // one revive per startGame()
let _timeBankedThisGame = 0;     // seconds already handed to addTimePlayed() this game
let _recBonusPaidThisGame = 0;   // record bonus already paid this game (keeps it from compounding)
let _lastRecBonus = 0;           // record bonus of the death currently on screen (for _earnRows re-render)
let _lastInterstitialAt = 0;     // timestamp of the last ad of ANY kind — throttles interstitials
let hardMode = false;
let _prevHudCoins = -1, _prevHudRound = -1, _prevCombo = 0; // [1.9.3]
// [2.0-notester] The tester mode is gone: no PIN screen, no FAB, no noclip/slow/freeze/speed
// overrides, no sandbox. Everything that used to branch on it now has exactly one path.
// [2.0-pause] Both pause flags live here, not in pause.js, because js/sdk.js's visibilitychange
// handler reads them — a tab switch during page load would hit the temporal dead zone if the
// bindings were declared in a later-loading file.
let gamePaused = false;       // frozen by an ad or by the player
let _pausedByPlayer = false;  // ...and the player-facing overlay is up
let _phaseFn = null;          // [1.10.2] currently pending phase callback
let _phaseFiresAt = 0;        // [1.10.2] absolute ms when phaseTimer fires
let _phaseRemainingMs = 0;    // [1.10.2] stored on pause

// FPS counter
let fpsFrames = 0, fpsLast = 0, fpsCurrent = 0;
let lasers = [], blocks = [], alive = true, startTime = 0, lastTime = 0;
// [2.0-w1fix] "Lasers Dodged" counts beams the player actually dashed over this round, not every beam that spawned
let roundLasersDodgedByDash = 0, _roundDodgedKeys = new Set();
let _virtAccum = 0, _virtBase = 0; // [1.10.2-fix] virtual-time accumulator for scaled elapsed
let phaseTimer = null, cellSize = 0;
// Persistent
let coins    = parseInt(localStorage.getItem('cm_coins') || '0');
let owned    = JSON.parse(localStorage.getItem('cm_owned') || '["default"]');
let skinId   = localStorage.getItem('cm_skin') || 'default';
// migration: remove old IDs not in the new skin system
owned  = owned.filter(id=>VALID_IDS.has(id));
if (!owned.includes('default')) owned.push('default');
if (!VALID_IDS.has(skinId)) skinId = 'default';
let bestTime  = parseFloat(localStorage.getItem('cm_best')  || '0');
let bestRound = parseInt(localStorage.getItem('cm_bestR')   || '0');
let gamesPlayed = parseInt(localStorage.getItem('cm_games') || '0');
let boardSkinId  = localStorage.getItem('cm_board') || 'classic'; // [1.9] World 1 board slot — [2.0-w1fix] live again
let boardSkinIdW2 = localStorage.getItem('cm_board_w2') || 'eventhorizon'; // [2.0-s5a-r9] Void-only slot
let laserColorId = localStorage.getItem('cm_laser') || 'red'; // [1.9]
let laserColorIdW2 = localStorage.getItem('cm_laser_w2') || 'plasma'; // [2.0-s5a-r8] Void-only slot
let boardsOwned  = JSON.parse(localStorage.getItem('cm_boards_owned') || '["classic"]'); // [1.9] World 1 board ownership — [2.0-w1fix] live again
let lasersOwned  = JSON.parse(localStorage.getItem('cm_lasers_owned') || '["red"]'); // [1.9]
let showBoardGrid = localStorage.getItem('cm_nogrid') !== '1'; // [1.9.1] bug #8: true = grid visible

// [2.0-s5b] Void Shop loot box engine — state
let box_lastFreeDate = localStorage.getItem('cm_world2_box_date') || '';
// [2.0-ads] rewarded-ad box: one per day, independent of the free box and the 2/day buy limit
let box_adWatchedDate = localStorage.getItem('cm_world2_box_ad_date') || '';
let box_boughtToday  = parseInt(localStorage.getItem('cm_world2_box_bought') || '0');
let box_boughtDate   = localStorage.getItem('cm_world2_box_bought_date') || '';
let voidSkinsOwned  = JSON.parse(localStorage.getItem('cm_world2_skins_owned')  || '[]');
let voidBoardsOwned = JSON.parse(localStorage.getItem('cm_world2_boards_owned') || '[]');
let voidLasersOwned = JSON.parse(localStorage.getItem('cm_world2_lasers_owned') || '[]');
// [1.9.2] Combo system
let comboCount = 0;
let bestComboThisSession = 0;
// [1.9.2] Extended statistics
let statLasers     = parseInt(localStorage.getItem('cm_stat_lasers')      || '0');
let statTimePlayed = parseInt(localStorage.getItem('cm_stat_time')        || '0');
let statCoinsTotal = parseInt(localStorage.getItem('cm_stat_coins_total') || '0');
let statBestCombo  = parseInt(localStorage.getItem('cm_stat_best_combo')  || '0');
// [2.0-s3] World 2 statistics — mirror of World 1 with cm_world2_ keys (W1 keys stay as W1 history)
let w2BestTime     = parseFloat(localStorage.getItem('cm_world2_best')              || '0');
let w2BestRound    = parseInt(localStorage.getItem('cm_world2_bestR')               || '0');
let w2Games        = parseInt(localStorage.getItem('cm_world2_games')               || '0');
let w2StatLasers   = parseInt(localStorage.getItem('cm_world2_stat_lasers')         || '0'); // flares dodged
let w2TimePlayed   = parseInt(localStorage.getItem('cm_world2_stat_time')           || '0');
let w2CrystalsTotal= parseInt(localStorage.getItem('cm_world2_stat_crystals_total') || '0');
let w2BestCombo    = parseInt(localStorage.getItem('cm_world2_stat_best_combo')     || '0');
// [1.10] Game mode state and records
let gameMode = null;
// [1.11] Boss state
let bossRound        = false;
let bossActive       = false;
let bossTier         = 0;
let bossX            = 0;     // [2.0-s4] live boss position (init from BOSS_CONFIG, drifts between attacks)
let bossY            = 0;     // [2.0-s4]
let bossTimeLeft     = 20;
let bossTimer        = null;
let bossThrowTimer   = null;
let bossPressureTimer = null; // [2.0-s4] continuous 1/s attack on the player's current cell
let bossAttackTimers = [];
let bossShockwaveCells = new Set();
// [2.0-s4b] World 2 active-combat boss state
let w2Boss           = null;   // active W2 boss config (PULSAR/NEUTRON/SINGULARITY) or null
let w2SpeedMult      = 1;      // attack-speed scaling per cycle (1 → 2×)
let bossHitsLeft     = 0;      // turret hits remaining to defeat the W2 boss
let bossShieldUntil  = 0;      // timestamp; while now < this the boss is invulnerable (no new plate)
let hitPlate         = null;   // {x,y} golden plate the player steps on to summon a turret
let turret           = null;   // {px,py,ex,ey,firesAt} active Solar-Flare turret
let w2BhBlocks       = [];     // [{x,y,until}, …] SINGULARITY black-hole blocks (1–3 per activation) // [2.0-s4f]
let destroyedCells   = new Set(); // SINGULARITY falling-star craters (lethal to stand on)
let _w2PowerBusyUntil = 0;      // [2.0-s4d] shared gate: serializes powerful attacks (spin/gravity/star/black-hole), ≥3s apart, no overlap
let _w2Pulling       = false;  // [2.0-s4c] true while a gravity/black-hole pull animation is stepping (input locked)
let w2SpinState      = null;   // {start,dur} active Laser Spin rotation
let w2SpinCells      = new Set(); // cells currently covered by spin beams (per-frame)
let w2Beam           = null;   // {ex,ey,until} brief turret→boss beam visual
let w2GravityWarn    = null;   // {until} Gravity Pull telegraph window
let w2Star           = null;   // {sx,sy,ex,ey,landAt} falling-star streak in flight
let w2StarShock      = null;   // [2.0-s4d] {x,y,born} expanding shockwave + flash at the star's impact
// [1.12] GRIDLOCK MODE
let gridlockActive     = false;
let gridlockRoundsLeft = 0;
let _glitchTimer       = null;
// [2.0-s1] World system
let world2Unlocked = localStorage.getItem('cm_world2_unlocked') === 'true';
let currentWorld   = parseInt(localStorage.getItem('cm_current_world') || '1');
if (!world2Unlocked) currentWorld = 1; // guard against tampered/stale value
let crystals              = parseInt(localStorage.getItem('cm_crystals') || '0');
let sessionCrystalsEarned = 0;
function curIcon()   { return currentWorld === 2 ? '✦' : '🪙'; }       // [2.0-s1]
function curWallet() { return currentWorld === 2 ? crystals : coins; } // [2.0-s1]
// [2.0-s2] Stage 2 — threats & black hole
let asteroids = [];             // active + warning asteroids
let asteroidTimer = null;       // spawn scheduler handle
let blackHoleCooldown = 0;      // rounds until BH ready (0 = ready)
let blackHoleReadyAt  = 0;      // [2.0-s4g] timestamp: BH usable when Date.now() >= this (W2 boss only)
let blackHoleAnimating = false; // true during the 0.5s teleport
let blackHole = null;           // { born, origin:{x,y}, dest:{x,y} } during anim
let _bhTimer = null;            // teleport completion timer handle
let _bhFiresAt = 0;             // absolute ms the teleport completes (for pause)
let _cubek2After = null;        // [2.0-s4d] action to run once the Cubek 2.0 intro finishes
let _pauseStart = 0;            // [2.0-s2] Date.now() at fab pause (asteroid freeze)
let _bhRemaining = 0;           // [2.0-s2] remaining teleport ms stored on pause
let _flareChargeStart = 0, _flareChargeDur = 0; // [2.0-s2] solar flare charge-orb timing
let _flareFireStart = 0, _flareFireDur = 0;     // [2.0-s2] solar flare beam release timing
let _dashCells = [];           // [2.0-s2] dashable cells captured each render (World 2 overlay)
// [2.0-s3] Round Randomizer — modifiers (Normal/Hard only)
let activeMod = null;          // currently active modifier def (or null)
let _roundsSinceMod = 99;      // rounds since last modifier ended (cooldown gate)
let _modRoundsLeft = 0;        // [2.0-s3.1] rounds remaining for the active modifier
let roundCoinMult = 1;         // coin/crystal multiplier this round
let roundSpeedMult = 1;        // obstacle speed multiplier this round (>1 = faster)
let comboStep = 1;             // combo increment per survived round
let boardTear = null;          // [2.0-s3.2] active Grid Glitch tear config (or null)
let tutorialActive = false; // [2.0-s4h] guided live-run tutorial on the real engine
let tutBeat = 0;            // [2.0-s4h] current scripted tutorial beat (0-based)
let _tutLaserRow = -1;      // [2.0-s4h-r1] row the beat-2 laser is charging on
let _tutBlock    = null;    // [2.0-s4h-r1] {x,y} of the beat-3 block
let _tutAwaiting = null;    // [2.0-s4h-r1] 'escape' | 'dodge' | null
// [2.0-notester] Which hazards a run uses. These were switches once — the Custom Game sandbox let
// the tester turn each one on or off — so every hazard site still asks rather than testing the
// world inline. Kept as functions: the question is the same, the sandbox answer is just gone.
function _lasersEnabled()    { return true; }
function _blocksEnabled()    { return currentWorld !== 2; } // no blocks in W2
function _asteroidsEnabled() { return currentWorld === 2; }
function _blackHoleEnabled() { return currentWorld === 2; }
let timeAttackEndTime = 0;
let _dailyRng = null;
let bestTimeAttack = parseInt(localStorage.getItem('cm_best_timeattack') || '0');
let bestHardcore   = parseInt(localStorage.getItem('cm_best_hardcore')   || '0');
let bestDaily      = parseInt(localStorage.getItem('cm_best_daily')      || '0');
let _modesCountdownInterval = null;
