// [MODULE] localStorage reads/writes, the tester snapshot, and date/seed helpers.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// [2.0-s3] world-aware stat writers
function addStatLasers(n){ if(currentWorld===2){w2StatLasers+=n;localStorage.setItem('cm_world2_stat_lasers',w2StatLasers);} else {statLasers+=n;localStorage.setItem('cm_stat_lasers',statLasers);} }
function addCurrencyTotal(n){ if(currentWorld===2){w2CrystalsTotal+=n;localStorage.setItem('cm_world2_stat_crystals_total',w2CrystalsTotal);} else {statCoinsTotal+=n;localStorage.setItem('cm_stat_coins_total',statCoinsTotal);} }
function recordBestCombo(c){ if(currentWorld===2){ if(c>w2BestCombo){w2BestCombo=c;localStorage.setItem('cm_world2_stat_best_combo',w2BestCombo);} } else { if(c>statBestCombo){statBestCombo=c;localStorage.setItem('cm_stat_best_combo',statBestCombo);} } }
function addTimePlayed(s){ if(currentWorld===2){w2TimePlayed+=s;localStorage.setItem('cm_world2_stat_time',w2TimePlayed);} else {statTimePlayed+=s;localStorage.setItem('cm_stat_time',statTimePlayed);} }
function save() {
  localStorage.setItem('cm_coins',  coins);
  localStorage.setItem('cm_owned',  JSON.stringify(owned));
  localStorage.setItem('cm_skin',   skinId);
  localStorage.setItem('cm_best',   bestTime);
  localStorage.setItem('cm_bestR',  bestRound);
  localStorage.setItem('cm_games',  gamesPlayed);
  localStorage.setItem('cm_crystals', crystals); // [2.0-s1]
  // [2.0-s3] World 2 records
  localStorage.setItem('cm_world2_best',  w2BestTime);
  localStorage.setItem('cm_world2_bestR', w2BestRound);
  localStorage.setItem('cm_world2_games', w2Games);
}

// ── [1.10] Mode helpers ──────────────────────────────────────────────────────
function _todayStr() { // [1.10]
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _msUntilMidnight() { // [1.10]
  const d = new Date();
  return new Date(d.getFullYear(),d.getMonth(),d.getDate()+1) - d;
}
function _fmtCountdown(ms) { // [1.10]
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function _isModeBlocked(mode) { // [1.10]
  const today = _todayStr();
  if (mode === 'hardcore') return localStorage.getItem('cm_hardcore_date') === today;
  if (mode === 'daily')    return localStorage.getItem('cm_daily_date')    === today;
  return false;
}
function _seededRng(seed) { // [1.10] xorshift32
  let s = seed >>> 0 || 1;
  return function() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
function _dateSeed() { // [1.10]
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}
// ─────────────────────────────────────────────────────────────────────────────
let _testerSnap = null; // [1.9.2] Bug #3: tester snapshot
function _saveTesterSnap() { // [1.9.2]
  if (_testerSnap) return; // [2.0-w1fix] baseline is taken once, when tester mode is enabled — never overwrite it
  const KEYS=['cm_coins','cm_owned','cm_skin','cm_best','cm_bestR','cm_games',
    'cm_board','cm_laser','cm_boards_owned','cm_lasers_owned','cm_nogrid',
    'cm_stat_lasers','cm_stat_time','cm_stat_coins_total','cm_stat_best_combo',
    'cm_crystals','cm_world2_best','cm_world2_bestR','cm_world2_games',          // [2.0-s3]
    'cm_world2_stat_lasers','cm_world2_stat_time','cm_world2_stat_crystals_total','cm_world2_stat_best_combo'];
  _testerSnap={};
  for(const k of KEYS) _testerSnap[k]=localStorage.getItem(k);
}
function _restoreTesterSnap() { // [1.9.2]
  if(!_testerSnap) return;
  for(const [k,v] of Object.entries(_testerSnap)){
    if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v);
  }
  coins        = parseInt(localStorage.getItem('cm_coins')  || '0');
  owned        = JSON.parse(localStorage.getItem('cm_owned') || '["default"]');
  skinId       = localStorage.getItem('cm_skin') || 'default';
  bestTime     = parseFloat(localStorage.getItem('cm_best')  || '0');
  bestRound    = parseInt(localStorage.getItem('cm_bestR')   || '0');
  gamesPlayed  = parseInt(localStorage.getItem('cm_games')  || '0');
  boardSkinId  = localStorage.getItem('cm_board') || 'classic';
  boardSkinIdW2 = localStorage.getItem('cm_board_w2') || 'eventhorizon';
  laserColorId = localStorage.getItem('cm_laser') || 'red';
  laserColorIdW2 = localStorage.getItem('cm_laser_w2') || 'plasma';
  boardsOwned  = JSON.parse(localStorage.getItem('cm_boards_owned') || '["classic"]');
  lasersOwned  = JSON.parse(localStorage.getItem('cm_lasers_owned') || '["red"]');
  box_lastFreeDate = localStorage.getItem('cm_world2_box_date') || '';
  box_boughtToday  = parseInt(localStorage.getItem('cm_world2_box_bought') || '0');
  box_boughtDate   = localStorage.getItem('cm_world2_box_bought_date') || '';
  voidSkinsOwned  = JSON.parse(localStorage.getItem('cm_world2_skins_owned')  || '[]');
  voidBoardsOwned = JSON.parse(localStorage.getItem('cm_world2_boards_owned') || '[]');
  voidLasersOwned = JSON.parse(localStorage.getItem('cm_world2_lasers_owned') || '[]');
  statLasers     = parseInt(localStorage.getItem('cm_stat_lasers')       || '0');
  statTimePlayed = parseInt(localStorage.getItem('cm_stat_time')         || '0');
  statCoinsTotal = parseInt(localStorage.getItem('cm_stat_coins_total')  || '0');
  statBestCombo  = parseInt(localStorage.getItem('cm_stat_best_combo')   || '0');
  // [2.0-s3] World 2 stats
  crystals        = parseInt(localStorage.getItem('cm_crystals')                   || '0');
  w2BestTime      = parseFloat(localStorage.getItem('cm_world2_best')              || '0');
  w2BestRound     = parseInt(localStorage.getItem('cm_world2_bestR')               || '0');
  w2Games         = parseInt(localStorage.getItem('cm_world2_games')               || '0');
  w2StatLasers    = parseInt(localStorage.getItem('cm_world2_stat_lasers')         || '0');
  w2TimePlayed    = parseInt(localStorage.getItem('cm_world2_stat_time')           || '0');
  w2CrystalsTotal = parseInt(localStorage.getItem('cm_world2_stat_crystals_total') || '0');
  w2BestCombo     = parseInt(localStorage.getItem('cm_world2_stat_best_combo')     || '0');
  _testerSnap=null;
}
