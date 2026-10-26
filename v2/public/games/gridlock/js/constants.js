// [MODULE] Immutable game data - tuning values, skin/board/laser tables, boss and mission definitions.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════
// [2.0-adgate] The single switch for everything ad-shaped: the two game-over offers, the Void Shop
// ad box and the random interstitial. OFF because the game ships under Basic Launch, where ads are
// not served at all — so every ad affordance would be a control that cannot work, which is the
// worst thing to hand a reviewer. The integration underneath is complete and tested; flip this to
// true on Full Launch and the whole feature appears, with no other change anywhere.
const ADS_ENABLED = false;

const N = 16, DASH_RANGE = 5, MAX_LASERS = 12;
// [2.0-boardfix] Floor for the board's pixel size. buildBoard() derives the size from the viewport
// and the viewport can measure ~0 during the first synchronous layout of a cold load, which used to
// produce a NEGATIVE board. 160px is 10px per cell — cramped but drawable, and no real viewport
// ever reaches down to it (it needs a window under 280px tall).
const MIN_BOARD_PX = 160;
const CHARGE_START = 1100, CHARGE_MIN = 500, CHARGE_STEP = 50;
const FIRE_MS = 700, GAP_MS = 850;
const BLOCK_INTERVAL = 3, MAX_BLOCKS = 12;
// [1.11] Boss system
const BOSS_ROUNDS  = [20, 40, 60]; // [2.0-s4e]
const BOSS_CONFIG  = {
  1: { name: 'SENTINEL',   gridX: 7, gridY: 7, size: 2, reward:  50 },
  2: { name: 'PHANTOM',    gridX: 6, gridY: 6, size: 3, reward: 100 },
  3: { name: 'VOID KING',  gridX: 6, gridY: 6, size: 4, reward: 200 },
};
// [2.0-s4b] World 2 active-combat bosses — round 25/50/75 then every 25 (cycling, faster each cycle)
const W2_BOSS = [
  { id:'pulsar',      name:'PULSAR',      size:3, hits:2, reward: 250, attacks:['throw','spin'] },
  { id:'neutron',     name:'NEUTRON',     size:4, hits:4, reward: 400, attacks:['throw','spin','rain','gravity'] },
  { id:'singularity', name:'SINGULARITY', size:5, hits:8, reward:1000, attacks:['throw','spin','rain','gravity','blackhole','star'] },
];
const SKINS = [
  // PATTERNS [1.9]
  { id:'default',   name:'Core',      cat:'Patterns', price:0    },
  { id:'stripes',   name:'Hex',       cat:'Patterns', price:150  },
  { id:'grid',      name:'Circuit',   cat:'Patterns', price:200  },
  { id:'gradient',  name:'Prism',     cat:'Patterns', price:300  },
  { id:'rainbow',   name:'Vortex',    cat:'Patterns', price:500  },
  // EFFECTS [1.9]
  { id:'glitch',    name:'Glitch',    cat:'Effects',  price:400  },
  { id:'aura',      name:'Aura',      cat:'Effects',  price:450  },
  { id:'magma',     name:'Magma',     cat:'Effects',  price:500  },
  { id:'void',      name:'Void',      cat:'Effects',  price:600  },
  { id:'neontrail', name:'Neon Trail',cat:'Effects',  price:650  },
  // SHAPES [1.9]
  { id:'spike',     name:'Spike',     cat:'Shapes',   price:300  },
  { id:'robot',     name:'Robot',     cat:'Shapes',   price:400  },
  { id:'wave',      name:'Wave',      cat:'Shapes',   price:450  },
  { id:'ball',      name:'Ball',      cat:'Shapes',   price:500  },
  { id:'ufo',       name:'Alien Orb', cat:'Shapes',   price:1000 },
  // PRESTIGE [1.9]
  { id:'sun',       name:'Sun',       cat:'Prestige', price:0, unlock:100, unlockDesc:'Survive 100 rounds' },
  { id:'blackhole', name:'Black Hole',cat:'Prestige', price:0, unlock:250, unlockDesc:'Survive 250 rounds'},
  { id:'galaxy',    name:'Milky Way', cat:'Prestige', price:0, unlock:500, unlockDesc:'Survive 500 rounds'},
];
// [1.9] BOARD & LASER DATA
const BOARD_SKINS = {
  classic:       { bg: '#08081a', grid: '#1a2a4a', glow: false },
  void:          { bg: '#000000', grid: '#222222', glow: false },
  neon_grid:     { bg: '#000a0a', grid: '#00ffcc', glow: true  },
  lava:          { bg: '#0a0000', grid: '#ff3300', glow: false },
  ice:           { bg: '#000a14', grid: '#88ccff', glow: false },
  galaxy:        { bg: '#04001a', grid: '#6633cc', glow: false },
  prestige_gold: { bg: '#0a0800', grid: '#ffd700', glow: true, prestige: true },
  // [2.0-s5a] Void boards
  eventhorizon:  { bg: '#0a0015', grid: '#aa44ff', glow: true,  warped: true },
  starfield:     { bg: '#020010', grid: '#1a2a5a', glow: false, stars: true  },
  nebula:        { bg: '#0a0418', grid: '#3a1a5a', glow: false, nebula: true },
  deepspace:     { bg: '#01010a', grid: '#10153a', glow: false, stars: true  },
  asteroidbelt:  { bg: '#060410', grid: '#2a2535', glow: false, belt: true   }
};
const BOARD_SKIN_LIST = [ // [1.9] World 1 boards — [2.0-w1fix] rendered + purchasable again
  { id:'classic',       name:'Classic',       price:0   },
  { id:'void',          name:'Void',          price:300 },
  { id:'neon_grid',     name:'Neon Grid',     price:500 },
  { id:'lava',          name:'Lava',          price:500 },
  { id:'ice',           name:'Ice',           price:400 },
  { id:'galaxy',        name:'Galaxy',        price:800 },
  { id:'prestige_gold', name:'Prestige Gold', price:0, unlock:500, unlockDesc:'Survive 500 rounds' }
];
const VOID_BOARD_SKIN_LIST = [ // [2.0-s5a-r9] Void-only board skins; ownership finalized by 5b/5c loot box
  { id:'eventhorizon', name:'Event Horizon', price:0 },
  { id:'starfield',    name:'Starfield',     price:0 },
  { id:'nebula',       name:'Nebula',        price:0 },
  { id:'deepspace',    name:'Deep Space',    price:0 },
  { id:'asteroidbelt', name:'Asteroid Belt', price:0 },
];
const LASER_COLORS = { // [1.9]
  red:    { fire: '#dd2200', charge: '#661000' },
  purple: { fire: '#aa00dd', charge: '#440066' },
  blue:   { fire: '#0066dd', charge: '#002266' },
  green:  { fire: '#00dd44', charge: '#005522' },
  gold:   { fire: '#ddaa00', charge: '#664400' },
  // [2.0-s5a] Void lasers — fx field drives signature FX in fire state [2.0-s5a-r1]
  plasma:     { fire: '#cc66ff', charge: '#330055', fx: 'sparks'   },
  ion:        { fire: '#00aaff', charge: '#002244', fx: 'scanline' },
  cosmicblue: { fire: '#3388dd', charge: '#112244', fx: 'pulse'    }
};
const LASER_COLOR_LIST = [ // [1.9]
  { id:'red',    name:'Red',    price:0   },
  { id:'purple', name:'Purple', price:300 },
  { id:'blue',   name:'Blue',   price:300 },
  { id:'green',  name:'Green',  price:400 },
  { id:'gold',   name:'Gold',   price:700 }
];
const VOID_LASER_COLOR_LIST = [ // [2.0-s5a-r8] prices/ownership finalized by 5b/5c loot box
  { id:'plasma',      name:'Plasma',      price:0 },
  { id:'ion',         name:'Ion',         price:0 },
  { id:'cosmicblue',  name:'Cosmic Blue', price:0 },
];
const VOID_LOOT_TABLE = [ // [2.0-s5b]
  { id:'singularityheart', cat:'skin',  tier:'secret' },
  { id:'supernova',        cat:'skin',  tier:'legendary' },
  { id:'eventhorizon',     cat:'board', tier:'legendary' },
  { id:'pulsarskin',       cat:'skin',  tier:'epic' },
  { id:'cosmicdust',       cat:'skin',  tier:'epic' },
  { id:'starfield',        cat:'board', tier:'epic' },
  { id:'plasma',           cat:'laser', tier:'epic' },
  { id:'comet',            cat:'skin',  tier:'rare' },
  { id:'aurora',           cat:'skin',  tier:'rare' },
  { id:'meteor',           cat:'skin',  tier:'rare' },
  { id:'nebula',           cat:'board', tier:'rare' },
  { id:'ion',              cat:'laser', tier:'rare' },
  { id:'stardust',         cat:'skin',  tier:'common' },
  { id:'orbit',            cat:'skin',  tier:'common' },
  { id:'lunar',            cat:'skin',  tier:'common' },
  { id:'deepspace',        cat:'board', tier:'common' },
  { id:'asteroidbelt',     cat:'board', tier:'common' },
  { id:'cosmicblue',       cat:'laser', tier:'common' },
];
const VOID_TIER_CONFIG = { // [2.0-s5b]
  common:    { weight:50, price:50   },
  rare:      { weight:30, price:150  },
  epic:      { weight:13, price:400  },
  legendary: { weight:6,  price:1000 },
  secret:    { weight:1,  price:2500 },
};
const VOID_TIER_COLORS = { // [2.0-s5c] representative tier color/glow for the reel + reveal frame
  common:    { c1:'#6b7280', c2:'#9ca3af', glow:'#9ca3af', label:'COMMON' },
  rare:      { c1:'#1d4ed8', c2:'#3b82f6', glow:'#3b82f6', label:'RARE' },
  epic:      { c1:'#7e22ce', c2:'#a855f7', glow:'#a855f7', label:'EPIC' },
  legendary: { c1:'#b8860b', c2:'#ffd700', glow:'#ffd700', label:'LEGENDARY' },
  secret:    { rainbow:true, glow:'#ff00ff', label:'SECRET' }, // animated rainbow via CSS class
};
const VOID_TIER_ORDER = ['secret','legendary','epic','rare','common']; // [2.0-s5c] display order (rarest first)
const VOID_SKIN_NAMES = { // [2.0-s5c] cube Void skins lack name fields (board/laser names live in their LISTs)
  singularityheart:'Singularity Heart', supernova:'Supernova', pulsarskin:'Pulsar',
  cosmicdust:'Cosmic Dust', comet:'Comet', aurora:'Aurora', meteor:'Meteor',
  stardust:'Stardust', orbit:'Orbit', lunar:'Lunar',
};
const VALID_IDS = new Set(['default','stripes','grid','gradient','rainbow','glitch','aura','magma','void','neontrail','spike','robot','wave','ball','ufo','sun','blackhole','galaxy']);
const MAX_ASTEROIDS = 6;
const CACHE_INTERVAL = 2;   // refresh cache every N frames (animated)
// animation for animated skins
const ANIMATED_SKINS = new Set(['default','stripes','grid','rainbow','glitch','aura','magma','void','neontrail','robot','wave','ball','ufo','sun','blackhole','galaxy',
  'singularityheart','supernova','pulsarskin','cosmicdust','comet','aurora','meteor','stardust','orbit','lunar']); // [2.0-s5a]
const ASTEROID_DIRS  = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const ASTEROID_SPEED = (N + 3) / 1500; // cells per ms — crosses the grid in ~1.5s
const ROUND_MODS = [
  { id:'double_coins', name:'DOUBLE COINS', hint:'×2 reward this round', category:'BUFF',      weight:3,
    onStart(){ roundCoinMult = 2; }, onEnd(){} },
  { id:'extra_dash',   name:'EXTRA DASH',   hint:'+2 dashes this round', category:'BUFF',      weight:3,
    onStart(){ dashesLeft += 2; },  onEnd(){} },
  { id:'combo_boost',  name:'COMBO BOOST',  hint:'combo builds faster',  category:'BUFF',      weight:2,
    onStart(){ comboStep = 2; },    onEnd(){} },
  { id:'fast_lasers',  name:'FAST OBSTACLES', hint:'+50% speed · ×2 reward', category:'CHALLENGE', weight:1,
    onStart(){ roundSpeedMult = 1.5; roundCoinMult = 2; }, onEnd(){} },
  { id:'grid_glitch',  name:'GRID GLITCH',  hint:'lightning bolt · ×1.5 reward', category:'COSMETIC', weight:2,
    onStart(){ roundCoinMult = 1.5; if (!boardTear) { _setBoardTear(); _boltStrike(); } document.getElementById('board-wrap')?.classList.add('board-tear'); }, // [2.0-s3.4] shake once on activation
    onEnd(){ _clearBoardTear(); } },
];
const CUBEK2_LINES = [ // [2.0-s1]
  "Welcome, survivor. I am Cubek 2.0 — I've been waiting for someone strong enough to reach this place.",
  "This is the Void — a cosmic dimension beyond the neon grid. The rules here are different.",
  "You'll face Solar Flares and Asteroids instead of lasers. Master the Black Hole to teleport across the grid.",
  "Void Crystals are the currency here. Spend them wisely in the Void Shop. Good luck — you'll need it."
];
const SCREENS = ['screen-start','screen-stats','screen-missions','screen-modes','screen-world-choice','screen-cubek2','app']; // [2.0-s1] world screens [2.0-s4h] no screen-tutorial [2.0-notester] no screen-pin
const MISSION_POOL = [ // [1.9] all names translated
  { id:'lasers_100',   type:'lasers_dodged',   target:100,  name:'Dodge 100 lasers'                 },
  { id:'lasers_250',   type:'lasers_dodged',   target:250,  name:'Dodge 250 lasers'                 },
  { id:'coins_100',    type:'coins_earned',    target:100,  name:'Earn 100 coins'                   },
  { id:'coins_250',    type:'coins_earned',    target:250,  name:'Earn 250 coins'                   },
  { id:'coins_500',    type:'coins_earned',    target:500,  name:'Earn 500 coins'                   },
  { id:'rounds_20',    type:'rounds_played',   target:20,   name:'Play 20 rounds'                   },
  { id:'rounds_50',    type:'rounds_played',   target:50,   name:'Play 50 rounds'                   },
  { id:'time_10',      type:'time_survived',   target:600,  name:'Survive 10 minutes total'         },
  { id:'time_25',      type:'time_survived',   target:1500, name:'Survive 25 minutes total'         },
  { id:'nohit_15',     type:'rounds_no_hit',   target:15,   name:'Complete 15 rounds unhit'         },
  { id:'score_500',    type:'score_points',    target:500,  name:'Score 500 points'                 },
  { id:'score_1000',   type:'score_points',    target:1000, name:'Score 1000 points'                },
  { id:'play_10',      type:'time_survived',   target:600,  name:'Play for 10 minutes total'        }, // [2.0-s4] daily: was 'Play 7 days in a row'
];
