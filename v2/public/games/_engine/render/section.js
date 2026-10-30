// @ts-check
// One section painted once into its own canvas (docs/v2/PLAN.md 9.1, stages w-1 and s-1),
// for both Rush games: the
// terrain (fill, the sector's block pattern, a lit rim, an inset trim, the outline with a
// restrained glow), its fixed hazards (blocks, pillars, spikes) and its deco (chains with
// ornaments, stars, diamonds, gears, sawtooth edges). Per frame the game only copies the
// visible part; saws, orbs and portals move, so they are drawn per frame (sprites.js).
import { VIEW_H, VIEW_TOP } from '../world.js';
import { profileY } from '../geometry.js';

/**
 * @typedef {{ glow: number, chevrons: boolean, teeth: boolean, ground: string | null, hazardGlow: string | null }} SurfaceFx
 *   glow: outline glow strength (0 = restrained); chevrons: arrow patterns inside the
 *   walls; teeth: toothed edges along every wall; ground: a glowing floor; hazardGlow: a
 *   halo around hazards so they stay readable among glowing deco.
 * @typedef {{
 *   id: string,
 *   pattern: 'tiles' | 'bricks' | 'panels', emblem: 'porthole' | 'diamond' | 'star' | 'eye',
 *   block: { top: string, bottom: string, tile: string, shade: string, rim: string, edge: string, glow: string, detail: string },
 *   hazard: { fill: string, inner: string, edge: string, metal: string },
 *   deco: string, fx?: SurfaceFx,
 * }} SurfaceTheme
 *   What a section's painting needs of a look: each game's themes add their backgrounds.
 * @typedef {SurfaceTheme} Theme
 * @typedef {import('./view.js').View} View
 * @typedef {import('../geometry.js').Geometry} Geometry
 * @typedef {import('../geometry.js').Pt} Pt
 * @typedef {{ canvas: HTMLCanvasElement, left: number, top: number }} Painted
 *   left: the world x (local to the section) of the canvas's left edge; top: the world y of its top.
 */

/** Cells painted beyond each end (outlines and deco hang over a little). */
export const PAD = 0.75;
/** World y of the painted strip's top and bottom: the band and a margin. */
export const STRIP_TOP = VIEW_TOP - 1;
export const STRIP_BOTTOM = VIEW_TOP + VIEW_H + 1;

/**
 * @typedef {{ X: (x: number) => number, Y: (y: number) => number, c: number }} Map
 */

/** @param {CanvasRenderingContext2D} ctx @param {Pt[]} pts @param {Map} m @param {number} [dy] */
function linePath(ctx, pts, m, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(m.X(x), m.Y(y + dy)) : ctx.moveTo(m.X(x), m.Y(y + dy))));
}

/**
 * Both terrain regions as one path (for clipping).
 * @param {Geometry} g @param {Map} m
 */
function terrainPath(g, m) {
  const ceil = new Path2D();
  const floor = new Path2D();
  const add = (/** @type {Path2D} */ p, /** @type {Pt[]} */ pts, /** @type {number} */ edge) => {
    const first = /** @type {Pt} */ (pts[0]);
    const last = /** @type {Pt} */ (pts[pts.length - 1]);
    p.moveTo(m.X(first[0]), m.Y(edge));
    for (const [x, y] of pts) p.lineTo(m.X(x), m.Y(y));
    p.lineTo(m.X(last[0]), m.Y(edge));
    p.closePath();
  };
  add(ceil, g.ceil, STRIP_TOP - 1);
  add(floor, g.floor, STRIP_BOTTOM + 1);
  const both = new Path2D();
  both.addPath(ceil);
  both.addPath(floor);
  return both;
}

// ── Block patterns ───────────────────────────────────────────────────────────

/**
 * The sector's pattern over a rectangle of whole cells (clip first).
 * @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {Map} m
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 */
export function paintPattern(ctx, th, m, x0, y0, x1, y1) {
  const c = m.c;
  const light = new Path2D();
  const dark = new Path2D();
  const inset = 0.09;
  if (th.pattern === 'bricks') {
    for (let y = Math.floor(y0 * 2) / 2; y < y1; y += 0.5) {
      const shift = (Math.round(y * 2) % 2) * 0.5;
      for (let x = Math.floor(x0) - shift; x < x1; x += 1) {
        light.moveTo(m.X(x + inset), m.Y(y + inset));
        light.lineTo(m.X(x + 1 - inset), m.Y(y + inset));
        dark.moveTo(m.X(x + inset), m.Y(y + 0.5 - inset));
        dark.lineTo(m.X(x + 1 - inset), m.Y(y + 0.5 - inset));
        dark.lineTo(m.X(x + 1 - inset), m.Y(y + inset));
      }
    }
  } else {
    const size = th.pattern === 'panels' ? 2 : 1;
    for (let y = Math.floor(y0 / size) * size; y < y1; y += size) {
      for (let x = Math.floor(x0 / size) * size; x < x1; x += size) {
        light.moveTo(m.X(x + inset), m.Y(y + size - inset));
        light.lineTo(m.X(x + inset), m.Y(y + inset));
        light.lineTo(m.X(x + size - inset), m.Y(y + inset));
        dark.moveTo(m.X(x + size - inset), m.Y(y + inset));
        dark.lineTo(m.X(x + size - inset), m.Y(y + size - inset));
        dark.lineTo(m.X(x + inset), m.Y(y + size - inset));
      }
    }
  }
  ctx.lineWidth = Math.max(1, c * 0.06);
  ctx.strokeStyle = th.block.tile;
  ctx.stroke(light);
  ctx.strokeStyle = th.block.shade;
  ctx.stroke(dark);
  if (th.pattern === 'panels') {
    ctx.fillStyle = th.block.detail;
    for (let y = Math.floor(y0 / 2) * 2; y < y1; y += 2) {
      for (let x = Math.floor(x0 / 2) * 2; x < x1; x += 2) {
        for (const [dx, dy] of [[0.3, 0.3], [1.7, 0.3], [0.3, 1.7], [1.7, 1.7]]) {
          ctx.beginPath();
          ctx.arc(m.X(x + /** @type {number} */ (dx)), m.Y(y + /** @type {number} */ (dy)), c * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

// ── Terrain ──────────────────────────────────────────────────────────────────

/**
 * Small ornaments along the inside of flat surfaces: studs on floors, notches on ceilings.
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 */
function paintSurfaceDetail(ctx, g, th, m) {
  ctx.fillStyle = th.block.detail;
  for (const [pts, into] of /** @type {[Pt[], number][]} */ ([[g.floor, 1], [g.ceil, -1]])) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = /** @type {Pt} */ (pts[i - 1]);
      const [bx, by] = /** @type {Pt} */ (pts[i]);
      if (ay !== by || bx - ax < 1) continue;
      for (let x = Math.ceil(ax) + 0.5; x < bx - 0.2; x += 1) {
        const y = ay + into * 0.62;
        const s = m.c * 0.09;
        ctx.beginPath();
        ctx.moveTo(m.X(x), m.Y(y) - s);
        ctx.lineTo(m.X(x) + s, m.Y(y));
        ctx.lineTo(m.X(x), m.Y(y) + s);
        ctx.lineTo(m.X(x) - s, m.Y(y));
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

/**
 * The sector's emblem set into thick walls, every few cells where the surface is level:
 * portholes (sector 1), carved diamonds (2), gold stars (3).
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 */
function paintEmblems(ctx, g, th, m) {
  for (const [pts, side, into] of /** @type {[Pt[], 'ceil' | 'floor', number][]} */ ([[g.ceil, 'ceil', -1], [g.floor, 'floor', 1]])) {
    for (let x = 2.5; x < g.length - 1.5; x += 4) {
      const y = profileY(pts, x, side);
      if (Math.abs(profileY(pts, x - 0.9, side) - y) > 1e-9 || Math.abs(profileY(pts, x + 0.9, side) - y) > 1e-9) continue;
      const cx = m.X(x);
      const cy = m.Y(y + into * 1.55);
      const r = m.c * 0.42;
      if (th.emblem === 'porthole') {
        ctx.strokeStyle = th.block.detail;
        ctx.lineWidth = Math.max(1, m.c * 0.09);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = th.block.shade;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      } else if (th.emblem === 'diamond') paintDiamond(ctx, cx, cy, r, th.block.detail);
      else if (th.emblem === 'eye') paintEye(ctx, cx, cy, r * 1.4, th.block.detail, th.block.glow);
      else paintStar(ctx, cx, cy, r * 1.1, th.block.detail);
    }
  }
}

/**
 * Sawtooth deco: a row of small teeth just inside a surface (part of the block, not a hazard).
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 * @param {{ from: number, to: number, on: 'floor' | 'ceil' }} d
 */
function paintSawtooth(ctx, g, th, m, d) {
  const pts = d.on === 'floor' ? g.floor : g.ceil;
  const into = d.on === 'floor' ? 1 : -1;
  ctx.fillStyle = th.block.rim;
  ctx.beginPath();
  for (let x = d.from; x < d.to - 0.01; x += 0.5) {
    const ya = profileY(pts, x, d.on) + into * 0.45;
    const yb = profileY(pts, x + 0.5, d.on) + into * 0.45;
    const ym = profileY(pts, x + 0.25, d.on) + into * 0.15;
    ctx.moveTo(m.X(x), m.Y(ya));
    ctx.lineTo(m.X(x + 0.25), m.Y(ym));
    ctx.lineTo(m.X(x + 0.5), m.Y(yb));
    ctx.lineTo(m.X(x + 0.5), m.Y(yb + into * 0.3));
    ctx.lineTo(m.X(x), m.Y(ya + into * 0.3));
    ctx.closePath();
  }
  ctx.fill();
}

/**
 * The ceiling and the floor: fill, lit rim, pattern, trim, deco teeth, outline and glow.
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 */
function paintTerrain(ctx, g, th, m) {
  const shape = terrainPath(g, m);
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = th.block.bottom;
  ctx.fillRect(m.X(-1), m.Y(STRIP_TOP - 1), m.X(g.length + 1) - m.X(-1), m.Y(STRIP_BOTTOM + 1) - m.Y(STRIP_TOP - 1));
  // Light gathers near the surface: a broad soft band along each profile.
  ctx.lineJoin = 'round';
  for (const [w, a] of [[2.6, 0.35], [1.4, 0.55], [0.6, 0.9]]) {
    ctx.globalAlpha = /** @type {number} */ (a);
    ctx.strokeStyle = th.block.top;
    ctx.lineWidth = m.c * /** @type {number} */ (w);
    linePath(ctx, g.ceil, m);
    ctx.stroke();
    linePath(ctx, g.floor, m);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  paintPattern(ctx, th, m, 0, STRIP_TOP - 1, g.length, STRIP_BOTTOM + 1);
  // An inset trim line following the surface.
  ctx.strokeStyle = th.block.rim;
  ctx.lineWidth = Math.max(1, m.c * 0.1);
  linePath(ctx, g.ceil, m, -0.32);
  ctx.stroke();
  linePath(ctx, g.floor, m, 0.32);
  ctx.stroke();
  paintSurfaceDetail(ctx, g, th, m);
  paintEmblems(ctx, g, th, m);
  for (const d of g.deco) if (d.type === 'sawtooth') paintSawtooth(ctx, g, th, m, d);
  if (th.fx?.chevrons) paintChevrons(ctx, g, th, m);
  if (th.fx?.teeth) {
    paintSawtooth(ctx, g, th, m, { from: 0, to: g.length, on: 'ceil' });
    paintSawtooth(ctx, g, th, m, { from: 0, to: g.length, on: 'floor' });
  }
  if (th.fx?.ground) paintGroundGlow(ctx, g, th.fx.ground, m);
  ctx.restore();
  paintOutline(ctx, [g.ceil, g.floor], th.block, m, th.fx?.glow ?? 0);
}

/**
 * Arrow (chevron) patterns inside the walls, pointing the way the level flows, in bands
 * that follow each wall's surface.
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 */
function paintChevrons(ctx, g, th, m) {
  ctx.strokeStyle = th.block.detail;
  ctx.lineWidth = Math.max(1, m.c * 0.09);
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  for (const [pts, side, into] of /** @type {[Pt[], 'ceil' | 'floor', number][]} */ ([[g.ceil, 'ceil', -1], [g.floor, 'floor', 1]])) {
    for (let x = 0.5; x < g.length; x += 1) {
      for (const depth of [1.1, 2.1]) {
        const y = profileY(pts, x, side) + into * depth;
        const h = 0.22;
        ctx.moveTo(m.X(x - 0.12), m.Y(y - h));
        ctx.lineTo(m.X(x + 0.12), m.Y(y));
        ctx.lineTo(m.X(x - 0.12), m.Y(y + h));
      }
    }
  }
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * A glowing ground: light pooled along the floor's surface, with faint ripples below it
 * (water or ice).
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {string} color @param {Map} m
 */
function paintGroundGlow(ctx, g, color, m) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  for (const [w, a] of [[1.6, 0.25], [0.7, 0.45]]) {
    ctx.globalAlpha = /** @type {number} */ (a);
    ctx.lineWidth = m.c * /** @type {number} */ (w);
    linePath(ctx, g.floor, m);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1, m.c * 0.06);
  for (const [dy, a] of [[0.75, 0.5], [1.25, 0.3], [1.9, 0.18]]) {
    ctx.globalAlpha = /** @type {number} */ (a);
    linePath(ctx, g.floor, m, /** @type {number} */ (dy));
    ctx.setLineDash([m.c * 0.9, m.c * 0.5]);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A bright outline over a soft glow: restrained in sectors 1–3, stronger (`glow`) later.
 * @param {CanvasRenderingContext2D} ctx @param {Pt[][]} lines @param {{ edge: string, glow: string }} colors @param {Map} m
 * @param {number} [glow]
 */
function paintOutline(ctx, lines, colors, m, glow = 0) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colors.glow;
    for (const [w, a] of [[1.1, 0.35], [0.6, 0.6]]) {
      ctx.globalAlpha = Math.min(1, /** @type {number} */ (a) * glow);
      ctx.lineWidth = m.c * /** @type {number} */ (w);
      for (const pts of lines) {
        linePath(ctx, pts, m);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = m.c * 0.34;
  for (const pts of lines) {
    linePath(ctx, pts, m);
    ctx.stroke();
  }
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = Math.max(1.5, m.c * (glow > 0 ? 0.1 : 0.085));
  for (const pts of lines) {
    linePath(ctx, pts, m);
    ctx.stroke();
  }
}

// ── Fixed hazards ────────────────────────────────────────────────────────────

/**
 * A block or a pillar: like the terrain, with a full outline; a pillar has a capital and a base.
 * @param {CanvasRenderingContext2D} ctx @param {import('../geometry.js').PolyHazard} h @param {Theme} th @param {Map} m
 */
function paintBlock(ctx, h, th, m) {
  const [x0, y0, x1, y1] = /** @type {[number, number, number, number]} */ (h.bbox);
  const g = ctx.createLinearGradient(0, m.Y(y0), 0, m.Y(y1));
  g.addColorStop(0, th.block.top);
  g.addColorStop(1, th.block.bottom);
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.X(x0), m.Y(y0), m.X(x1) - m.X(x0), m.Y(y1) - m.Y(y0));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  paintPattern(ctx, th, m, x0, y0, x1, y1);
  if (h.type === 'pillar') {
    ctx.strokeStyle = th.block.shade;
    ctx.lineWidth = Math.max(1, m.c * 0.08);
    ctx.beginPath();
    for (let x = x0 + 0.33; x < x1 - 0.1; x += 0.33) {
      ctx.moveTo(m.X(x), m.Y(y0 + 0.4));
      ctx.lineTo(m.X(x), m.Y(y1 - 0.4));
    }
    ctx.stroke();
  }
  ctx.restore();
  const rect = /** @type {Pt[]} */ ([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
  paintOutline(ctx, [rect], th.block, m, th.fx?.glow ?? 0);
  if (h.type === 'pillar') {
    // Capital and base: slabs a little wider than the shaft.
    ctx.fillStyle = th.block.rim;
    for (const y of [y0, y1 - 0.3]) ctx.fillRect(m.X(x0 - 0.12), m.Y(y), m.X(x1 + 0.12) - m.X(x0 - 0.12), m.c * 0.3);
    ctx.strokeStyle = th.block.edge;
    ctx.lineWidth = Math.max(1, m.c * 0.06);
    for (const y of [y0, y1 - 0.3]) ctx.strokeRect(m.X(x0 - 0.12), m.Y(y), m.X(x1 + 0.12) - m.X(x0 - 0.12), m.c * 0.3);
  }
}

/**
 * A spike: dark body, a lighter inner facet, the sector's bright hazard edge.
 * @param {CanvasRenderingContext2D} ctx @param {import('../geometry.js').PolyHazard} h @param {Theme} th @param {Map} m
 */
function paintSpike(ctx, h, th, m) {
  const [a, tip, b] = /** @type {[Pt, Pt, Pt]} */ (h.vis);
  const tri = new Path2D();
  tri.moveTo(m.X(a[0]), m.Y(a[1]));
  tri.lineTo(m.X(tip[0]), m.Y(tip[1]));
  tri.lineTo(m.X(b[0]), m.Y(b[1]));
  tri.closePath();
  if (th.fx?.hazardGlow) {
    // A pale halo: hazards read first among glowing walls and deco.
    ctx.strokeStyle = th.fx.hazardGlow;
    ctx.lineWidth = m.c * 0.4;
    ctx.lineJoin = 'round';
    ctx.stroke(tri);
  }
  ctx.fillStyle = th.hazard.fill;
  ctx.fill(tri);
  // Inner facet: a smaller triangle toward the base.
  const k = 0.55;
  const cx = (a[0] + b[0]) / 2;
  ctx.fillStyle = th.hazard.inner;
  ctx.beginPath();
  ctx.moveTo(m.X(cx + (a[0] - cx) * k), m.Y(a[1] + (tip[1] - a[1]) * 0.08));
  ctx.lineTo(m.X(tip[0]), m.Y(a[1] + (tip[1] - a[1]) * 0.72));
  ctx.lineTo(m.X(cx + (b[0] - cx) * k), m.Y(a[1] + (tip[1] - a[1]) * 0.08));
  ctx.closePath();
  ctx.fill();
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = th.hazard.edge;
  ctx.lineWidth = Math.max(1.5, m.c * 0.075);
  ctx.stroke(tri);
}

// ── Deco ─────────────────────────────────────────────────────────────────────

/**
 * A four-point star ornament with a centre ("eye").
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px @param {string} color
 */
export function paintStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The "eye": a four-point star with a glowing core and a ring.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px @param {string} color @param {string} glow
 */
export function paintEye(ctx, x, y, r, color, glow) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
  paintStar(ctx, x, y, r, color);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px @param {string} color */
function paintDiamond(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.45);
  ctx.lineTo(x + r * 0.3, y);
  ctx.lineTo(x, y + r * 0.45);
  ctx.lineTo(x - r * 0.3, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * A chain hanging from the ceiling, links alternating, with an ornament at its end.
 * @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m
 * @param {{ x: number, len: number, ornament?: string }} d
 */
function paintChain(ctx, g, th, m, d) {
  const top = profileY(g.ceil, d.x, 'ceil');
  const c = m.c;
  ctx.strokeStyle = th.deco;
  ctx.lineWidth = Math.max(1, c * 0.07);
  const link = 0.34;
  for (let i = 0; i * link < d.len; i++) {
    const y = top + i * link + link / 2;
    ctx.beginPath();
    if (i % 2 === 0) ctx.ellipse(m.X(d.x), m.Y(y), c * 0.09, c * 0.2, 0, 0, Math.PI * 2);
    else ctx.ellipse(m.X(d.x), m.Y(y), c * 0.03, c * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const end = top + d.len + 0.32;
  if (d.ornament === 'diamond') paintDiamond(ctx, m.X(d.x), m.Y(end), c * 0.32, th.deco);
  else if (d.ornament === 'star') paintStar(ctx, m.X(d.x), m.Y(end), c * 0.36, th.deco);
  else if (d.ornament === 'triangle') {
    ctx.fillStyle = th.deco;
    ctx.beginPath();
    ctx.moveTo(m.X(d.x - 0.22), m.Y(end - 0.18));
    ctx.lineTo(m.X(d.x + 0.22), m.Y(end - 0.18));
    ctx.lineTo(m.X(d.x), m.Y(end + 0.25));
    ctx.closePath();
    ctx.fill();
  }
}

/** A faint gear in the background of the corridor. @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {Map} m @param {{ x: number, y: number, size: number }} d */
function paintGear(ctx, th, m, d) {
  const r = d.size * m.c;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = th.deco;
  ctx.lineWidth = Math.max(1, m.c * 0.08);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx.lineTo(m.X(d.x) + Math.cos(a) * rr, m.Y(d.y) + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(m.X(d.x), m.Y(d.y), r * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {Geometry} g @param {Theme} th @param {Map} m */
function paintDeco(ctx, g, th, m) {
  // Spike orbs that hang on chains: the chain is deco, the orb (drawn per frame) the hazard.
  for (const h of g.hazards) {
    if (h.shape !== 'circle' || !h.chain) continue;
    const top = profileY(g.ceil, h.x, 'ceil');
    paintChain(ctx, g, th, m, { x: h.x, len: Math.max(0, h.y - h.r - top - 0.1), ornament: 'none' });
  }
  for (const d of g.deco) {
    if (d.type === 'chain') paintChain(ctx, g, th, m, d);
    else if (d.type === 'gear') paintGear(ctx, th, m, d);
    else if (d.type === 'star') paintStar(ctx, m.X(d.x), m.Y(d.y), d.size * m.c * 0.6, th.deco);
    else if (d.type === 'diamond') paintDiamond(ctx, m.X(d.x), m.Y(d.y), d.size * m.c * 0.6, th.deco);
  }
}

// ── The whole section ────────────────────────────────────────────────────────

/**
 * Paints a section for this view and theme.
 * @param {Geometry} g @param {Theme} th @param {View} v
 * @returns {Painted}
 */
export function paintSection(g, th, v) {
  const c = v.cell;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((g.length + PAD * 2) * c);
  canvas.height = Math.ceil((STRIP_BOTTOM - STRIP_TOP) * c);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  /** @type {Map} */
  const m = { X: (x) => (x + PAD) * c, Y: (y) => (y - STRIP_TOP) * c, c };
  paintDeco(ctx, g, th, m);
  paintTerrain(ctx, g, th, m);
  for (const h of g.hazards) {
    if (h.shape !== 'poly') continue;
    if (h.type === 'block' || h.type === 'pillar') paintBlock(ctx, h, th, m);
  }
  for (const h of g.hazards) if (h.shape === 'poly' && (h.type === 'spike' || h.type === 'halfSpike')) paintSpike(ctx, h, th, m);
  return { canvas, left: -PAD, top: STRIP_TOP };
}
