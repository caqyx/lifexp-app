// @ts-check
// Strażnicy Doliny's sprites (docs/v2/PLAN.md 9.1, td-2), drawn for this game: enemies
// with walk cycles (facing right; the renderer mirrors them), tower tops by type with an
// idle and a firing frame, HUD icons and stars. Letters are palette colours (pixelart.js);
// "." is clear. Shapes, not only colours, tell kinds apart: a round slime, a pointed
// runner, a domed shell, winged moths, a double blob, a crystal shard, a horned giant;
// towers are a figure with a bow, a squat cannon, a crystal, a wide crossbow and a flag.

/** @typedef {readonly string[]} Rows */

// ── Enemies (two to four frames each) ───────────────────────────────────────

/** A green slime that heaves as it creeps. 12 × 11 */
const CRAWLER = [
  [
    '............',
    '....kkkk....',
    '..kkFFFfkk..',
    '.kfFFfffwkk.',
    '.kffffffkwk.',
    'kffffffffkfk',
    'kfEfffffffEk',
    'kfEEfffffEEk',
    '.kEEEEEEEEk.',
    '..kkkkkkkk..',
    '............',
  ],
  [
    '............',
    '............',
    '....kkkk....',
    '..kkFFFfkk..',
    '.kfFFffwkfk.',
    'kffffffkwkfk',
    'kfEfffffffEk',
    'kfEEEfffEEEk',
    'kEEEEEEEEEEk',
    '.kkkkkkkkkk.',
    '............',
  ],
];

/** A lean yellow runner, pointed nose forward, legs in four steps. 12 × 11 */
const RUNNER_BODY = [
  '............',
  '......kkk...',
  '....kkyyykk.',
  '...kyyYYwkyk',
  '..kyyyyykkok',
  '.kyyyyyyyykk',
  'kOyyyyyyyk..',
  '.kkOOOOOk...',
];
const RUNNER_LEGS = [
  ['..kn..kn....', '.kn....kn...', '.k......k...'],
  ['...kn.kn....', '...kn.kn....', '...k..k.....'],
  ['....knkn....', '....kkn.....', '....kk......'],
  ['...kn..kn...', '..kn....k...', '..k.........'],
];
const RUNNER = RUNNER_LEGS.map((legs) => [...RUNNER_BODY, ...legs]);

/** An armoured shell, plates and a small head; slow steps. 14 × 11 */
const SHELLBACK = [
  [
    '..............',
    '....kkkkkk....',
    '..kkGGgGGGkk..',
    '.kGGgGGGgGGGk.',
    '.kgGGGgGGGgGkk',
    'kGGgGGGgGGGgkwk',
    'kKKKKKKKKKKKkkk',
    '.kKgKKgKKgKk..',
    '..kk.kk.kk.k..',
    '..k...k...k...',
    '..............',
  ].map((row) => row.slice(0, 14)),
  [
    '..............',
    '....kkkkkk....',
    '..kkGGgGGGkk..',
    '.kGGgGGGgGGGk.',
    '.kgGGGgGGGgGkk',
    'kGGgGGGgGGGgkw',
    'kKKKKKKKKKKKkk',
    '.kKgKKgKKgKk..',
    '..k.kk.kk.kk..',
    '...k...k...k..',
    '..............',
  ],
];

/** A pink moth, wings up and down; it flies over the road. 13 × 11 */
const MOTH = [
  [
    '.kk.......kk.',
    'kPPk.....kPPk',
    'kPpPk...kPpPk',
    'kPPpPk.kPpPPk',
    '.kPPPkpkPPPk.',
    '..kkkpwpkkk..',
    '.....kpk.....',
    '.....kpk.....',
    '......k......',
    '.............',
    '.............',
  ],
  [
    '.............',
    '.............',
    '.............',
    '.kkkk...kkkk.',
    'kPPPPkpkPPPPk',
    'kPpPPpwpPPpPk',
    '.kPPpkpkpPPk.',
    '..kkk.k.kkk..',
    '......k......',
    '.............',
    '.............',
  ],
];

/** Two red blobs stuck together; they part when it dies. 14 × 11 */
const SPLITTER = [
  [
    '..............',
    '..kkkk..kkkk..',
    '.kOORRkkOORRk.',
    'kOORRRRkORRwkk',
    'kORRRRRkRRRkwk',
    'kRRRRRRkRRRRRk',
    'kRrRRRRkRrRRRk',
    'krrRRRrkrrRRrk',
    '.krrrrk.krrrk.',
    '..kkkk...kkk..',
    '..............',
  ],
  [
    '..............',
    '..............',
    '..kkkk..kkkk..',
    '.kOORRkkOORRk.',
    'kORRRRRkORRwkk',
    'kRRRRRRkRRRkwk',
    'kRrRRRRkRrRRRk',
    'krrRRRrkrrRRrk',
    'krrrrrrkrrrrrk',
    '.kkkkkk.kkkkk.',
    '..............',
  ],
];

/** A shard of red crystal, tumbling. 8 × 8 */
const SHARD = [
  ['...kk...', '..kOOk..', '.kORRwk.', 'kORRRRRk', '.kRrRRk.', '..krrk..', '...kk...', '........'],
  ['........', '...kk...', '..kOOk..', '.kORRwk.', 'kORrRRRk', '.krrRRk.', '..kkkk..', '........'],
];

/** The Colossus: a horned stone giant twice an enemy's size, stomping. 24 × 22 */
const COLOSSUS_TOP = [
  '........................',
  '..kk................kk..',
  '..kyk..............kyk..',
  '...kyk............kyk...',
  '...kyyk..kkkkkk..kyyk...',
  '....kyykkRRRRRRkkyyk....',
  '.....kkRRRRRRRRRRkk.....',
  '....kRRRRRRRRRRRRRRk....',
  '...kRRRRwwkRRRRwwkRRk...',
  '...kRRRRwkkRRRRwkkRRk...',
  '..kRRRRRRRRRRRRRRRRRRk..',
  '..kRRrRRRRkkkkRRRRrRRk..',
  '.kRRrrRRRRRRRRRRRRrrRRk.',
  '.kRrrrrRRRRRRRRRRrrrrRk.',
  'kRRrrrrrRRRRRRRRrrrrrRRk',
  'kRrrkrrrrRRRRRRrrrrkrrRk',
  'kRrk.krrrrrrrrrrrrk.krRk',
  '.kk..krrrrrrrrrrrrk..kk.',
];
const COLOSSUS_LEGS = [
  ['.....krrrrk..krrrrk.....', '.....krrrk....krrrk.....', '....kkkkkk....kkkkkk....', '........................'],
  ['....krrrrk....krrrrk....', '....krrrk......krrrk....', '...kkkkkk......kkkkkk...', '........................'],
];
const COLOSSUS = COLOSSUS_LEGS.map((legs) => [...COLOSSUS_TOP, ...legs]);

export const ENEMY_FRAMES = /** @type {const} */ ({
  crawler: CRAWLER,
  runner: RUNNER,
  shellback: SHELLBACK,
  moth: MOTH,
  splitter: SPLITTER,
  shard: SHARD,
  colossus: COLOSSUS,
});

/** How fast each kind's frames go round (frames a second). */
export const ENEMY_FPS = /** @type {const} */ ({
  crawler: 4,
  runner: 12,
  shellback: 3,
  moth: 10,
  splitter: 4,
  shard: 6,
  colossus: 3,
});

// ── Tower tops (idle, firing), 12 wide ──────────────────────────────────────

/** A hooded archer with a bow; firing, the string is drawn back. */
const ARCHER = [
  [
    '............',
    '....kkkk....',
    '...kEEEEk.k.',
    '...kEBwBk.kN',
    '...kEBBBk..kN',
    '..kkEEEEkk.kN',
    '.kNEEEEEEkkkN',
    '..kkEEEEk..kN',
    '...kEnnEk.kN',
    '...kEk.kEk.k.',
    '...kk...kk...',
  ].map((row) => row.padEnd(12, '.').slice(0, 12)),
  [
    '............',
    '....kkkk....',
    '...kEEEEk..k',
    '...kEBwBk.kN',
    '...kEBBBkkN.',
    '..kkEEEEkwNk',
    '.kNEEEEEwwwy',
    '..kkEEEEkwNk',
    '...kEnnEkkN.',
    '...kEk.kEkkN',
    '...kk...kk.k',
  ],
];

/** A squat cannon on a wooden carriage; firing, it kicks back and smokes. */
const MORTAR = [
  [
    '............',
    '............',
    '.......kkkk.',
    '......kKKgGk',
    '.....kKKKgk.',
    '....kKKKKk..',
    '...kKKKKKk..',
    '..kNNKKKkNk.',
    '.kNNNkkkNNNk',
    '.kNnNk.kNnNk',
    '..kkk...kkk.',
  ],
  [
    '.........GG.',
    '........GwwG',
    '......kkkGG.',
    '.....kKKgGk.',
    '....kKKKgk..',
    '....kKKKk...',
    '...kKKKKKk..',
    '..kNNKKKkNk.',
    '.kNNNkkkNNNk',
    '.kNnNk.kNnNk',
    '..kkk...kkk.',
  ],
];

/** A tall ice crystal on a plinth; pulsing, it glows white. */
const FROST = [
  [
    '.....kk.....',
    '....kCCk....',
    '....kCwCk...',
    '...kCCwCk...',
    '...kCwCCCk..',
    '...kcCCCCk..',
    '...kccCCck..',
    '....kccck...',
    '....kcck....',
    '...kGGGGk...',
    '...kkkkkk...',
  ],
  [
    '.....kk.....',
    '....kwwk....',
    '....kwwwk...',
    '...kCwwwk...',
    '...kwwwCCk..',
    '...kCCwCCk..',
    '...kcCCCck..',
    '....kcCck...',
    '....kcck....',
    '...kGGGGk...',
    '...kkkkkk...',
  ],
];

/** A wide crossbow on a stand; firing, the arms snap forward. */
const BALLISTA = [
  [
    '........kk..',
    '.......kNk..',
    '......kNk...',
    '.kkkkkkkkkk.',
    'kwNNNNNNNNyk',
    '.kkkkkkkkkk.',
    '......kNk...',
    '.......kNk..',
    '....kk..kk..',
    '...kNNk.....',
    '..kNNNNk....',
  ],
  [
    '..........k.',
    '.........kN.',
    '.........kN.',
    '.kkkkkkkkkk.',
    'kNNNNNNNNNkw',
    '.kkkkkkkkkk.',
    '.........kN.',
    '.........kN.',
    '....kk....k.',
    '...kNNk.....',
    '..kNNNNk....',
  ],
];

/** A violet banner on a pole, waving. */
const BANNER = [
  [
    '...ky.......',
    '...kGkkkkk..',
    '...kGkVVVVk.',
    '...kGkVvVVVk',
    '...kGkVvvVk.',
    '...kGkVVVVk.',
    '...kGkkkkk..',
    '...kGk......',
    '...kGk......',
    '..kGGGk.....',
    '..kkkkk.....',
  ],
  [
    '...ky.......',
    '...kGkkkk...',
    '...kGkVVVkk.',
    '...kGkVvVVVk',
    '...kGkVvvVVk',
    '...kGkVVVkk.',
    '...kGkkkk...',
    '...kGk......',
    '...kGk......',
    '..kGGGk.....',
    '..kkkkk.....',
  ],
];

export const TOWER_TOPS = /** @type {const} */ ({ archer: ARCHER, mortar: MORTAR, frost: FROST, ballista: BALLISTA, banner: BANNER });

// ── Icons (HUD, stars) ──────────────────────────────────────────────────────

export const ICONS = /** @type {const} */ ({
  coin: ['..kkkk..', '.kyyyyk.', 'kyYyyOyk', 'kyYyOyyk', 'kyyOyyyk', 'kyOyyyyk', '.kyyyyk.', '..kkkk..'],
  heart: ['.kk..kk.', 'kRRkkRRk', 'kRwRRRRk', 'kRRRRRRk', '.kRRRRk.', '..kRRk..', '...kk...', '........'],
  flag: ['kk......', 'kGkkkkk.', 'kGkVVVk.', 'kGkVvVVk', 'kGkVVVk.', 'kGkkkkk.', 'kGk.....', 'kkk.....'],
  star: ['....k....', '...kyk...', '...kyk...', 'kkkkyykkk', '.kyyYyyk.', '..kyyyk..', '..kykyk..', '.kyk.kyk.', '.kk...kk.'],
  starEmpty: ['....k....', '...kKk...', '...kKk...', 'kkkkKKkkk', '.kKKKKKk.', '..kKKKk..', '..kKkKk..', '.kKk.kKk.', '.kk...kk.'],
  pause: ['.......', 'kk..kk.', 'kwk.kwk', 'kwk.kwk', 'kwk.kwk', 'kwk.kwk', 'kk..kk.'],
  speed: ['........', 'kk..kk..', 'kwk.kwk.', 'kwwkkwwk', 'kwk.kwk.', 'kk..kk..', '........'],
});
