// @ts-check
// Strażnicy Doliny's interface icons (docs/v2/PLAN.md 9.1, td-2): HUD icons and stars,
// drawn for this game. Letters are palette colours (pixelart.js); "." is clear. The
// characters and towers on the board are drawn in code (art.js, td-3).

/** @typedef {readonly string[]} Rows */

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
