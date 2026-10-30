// @ts-check
// The ship, drawn every frame in the player's skin (docs/v2/PLAN.md 9.1, stage s-1): ten
// original hulls in unit coordinates, pointing to +x, about 1 long and 0.6 high — the
// size of its body, so a ship resting on a surface looks as if it rests on it. A canopy,
// the skin's accent, and a flame from the engine while thrusting; upside down when
// gravity is.

/** @typedef {import('../skins.js').Skin} Skin */

/**
 * The hull's outline (and its wing or fin, drawn in the accent).
 * @param {import('../skins.js').Hull} hull
 * @returns {{ body: Path2D, accent: Path2D, canopy: [number, number, number, number], engine: number }}
 *   canopy: centre x, y and radii; engine: the x the flame comes out of.
 */
function hullShape(hull) {
  const body = new Path2D();
  const accent = new Path2D();
  switch (hull) {
    case 'falcon':
      body.moveTo(0.55, 0.04);
      body.lineTo(0.1, -0.16);
      body.lineTo(-0.3, -0.18);
      body.lineTo(-0.5, -0.3);
      body.lineTo(-0.42, 0.02);
      body.lineTo(-0.5, 0.26);
      body.lineTo(0.2, 0.2);
      accent.moveTo(0.05, 0.1);
      accent.lineTo(-0.35, 0.3);
      accent.lineTo(-0.15, 0.1);
      return { body, accent, canopy: [0.12, -0.1, 0.16, 0.09], engine: -0.45 };
    case 'manta':
      body.moveTo(0.5, 0.02);
      body.quadraticCurveTo(0.1, -0.3, -0.5, -0.28);
      body.quadraticCurveTo(-0.3, 0.0, -0.5, 0.28);
      body.quadraticCurveTo(0.1, 0.28, 0.5, 0.02);
      accent.moveTo(-0.1, -0.12);
      accent.lineTo(-0.42, -0.24);
      accent.lineTo(-0.3, -0.08);
      return { body, accent, canopy: [0.1, -0.06, 0.15, 0.08], engine: -0.38 };
    case 'rocket':
      body.moveTo(0.55, 0);
      body.quadraticCurveTo(0.35, -0.18, 0, -0.18);
      body.lineTo(-0.38, -0.18);
      body.lineTo(-0.5, -0.3);
      body.lineTo(-0.5, 0.3);
      body.lineTo(-0.38, 0.18);
      body.lineTo(0, 0.18);
      body.quadraticCurveTo(0.35, 0.18, 0.55, 0);
      accent.moveTo(0.55, 0);
      accent.quadraticCurveTo(0.44, -0.11, 0.32, -0.15);
      accent.lineTo(0.32, 0.15);
      accent.quadraticCurveTo(0.44, 0.11, 0.55, 0);
      return { body, accent, canopy: [0.08, -0.02, 0.1, 0.09], engine: -0.5 };
    case 'glider':
      body.moveTo(0.52, 0.06);
      body.lineTo(-0.1, -0.06);
      body.lineTo(-0.3, -0.3);
      body.lineTo(-0.42, -0.3);
      body.lineTo(-0.36, -0.02);
      body.lineTo(-0.5, 0.06);
      body.lineTo(-0.48, 0.16);
      body.lineTo(0.3, 0.18);
      accent.moveTo(0.15, 0.1);
      accent.lineTo(-0.3, 0.12);
      accent.lineTo(-0.36, 0.26);
      accent.lineTo(-0.1, 0.24);
      return { body, accent, canopy: [0.2, 0.0, 0.14, 0.08], engine: -0.48 };
    case 'saucer':
      body.ellipse(0, 0.08, 0.52, 0.16, 0, 0, Math.PI * 2);
      accent.rect(-0.4, 0.06, 0.8, 0.05);
      return { body, accent, canopy: [0, -0.06, 0.24, 0.18], engine: -0.4 };
    case 'hornet':
      body.moveTo(0.55, 0.02);
      body.lineTo(0.2, -0.2);
      body.lineTo(-0.2, -0.22);
      body.lineTo(-0.5, -0.06);
      body.lineTo(-0.5, 0.12);
      body.lineTo(-0.2, 0.26);
      body.lineTo(0.2, 0.22);
      for (const x of [-0.25, -0.05, 0.15]) {
        accent.moveTo(x, -0.21);
        accent.lineTo(x + 0.08, -0.21);
        accent.lineTo(x + 0.08, 0.23);
        accent.lineTo(x, 0.23);
        accent.closePath();
      }
      return { body, accent, canopy: [0.25, -0.08, 0.12, 0.08], engine: -0.5 };
    case 'twin':
      body.moveTo(0.55, -0.12);
      body.lineTo(-0.5, -0.3);
      body.lineTo(-0.42, -0.06);
      body.lineTo(-0.42, 0.06);
      body.lineTo(-0.5, 0.3);
      body.lineTo(0.55, 0.12);
      body.lineTo(0.2, 0);
      accent.moveTo(0.3, 0);
      accent.lineTo(-0.3, -0.12);
      accent.lineTo(-0.3, 0.12);
      return { body, accent, canopy: [-0.05, 0, 0.12, 0.07], engine: -0.45 };
    case 'comet':
      body.arc(0.22, 0, 0.26, -Math.PI / 2, Math.PI / 2);
      body.lineTo(-0.5, 0.2);
      body.lineTo(-0.36, 0);
      body.lineTo(-0.5, -0.2);
      accent.moveTo(-0.05, -0.18);
      accent.lineTo(-0.45, -0.12);
      accent.lineTo(-0.3, 0);
      accent.lineTo(-0.45, 0.12);
      accent.lineTo(-0.05, 0.18);
      return { body, accent, canopy: [0.26, -0.02, 0.13, 0.13], engine: -0.42 };
    case 'crown':
      body.moveTo(0.55, 0.04);
      body.lineTo(0.05, -0.18);
      body.lineTo(-0.1, -0.34);
      body.lineTo(-0.2, -0.2);
      body.lineTo(-0.32, -0.36);
      body.lineTo(-0.4, -0.2);
      body.lineTo(-0.52, -0.3);
      body.lineTo(-0.48, 0.24);
      body.lineTo(0.2, 0.22);
      accent.moveTo(-0.05, 0.05);
      accent.lineTo(0.12, 0.12);
      accent.lineTo(-0.05, 0.19);
      accent.lineTo(-0.22, 0.12);
      return { body, accent, canopy: [0.18, -0.06, 0.14, 0.08], engine: -0.48 };
    default:
      // swift: a sleek dart with swept wings.
      body.moveTo(0.55, 0.05);
      body.quadraticCurveTo(0.25, -0.18, -0.15, -0.18);
      body.lineTo(-0.5, -0.3);
      body.lineTo(-0.42, 0.0);
      body.lineTo(-0.5, 0.26);
      body.lineTo(0.25, 0.22);
      accent.moveTo(0.0, 0.06);
      accent.lineTo(-0.38, 0.22);
      accent.lineTo(-0.3, 0.06);
      return { body, accent, canopy: [0.08, -0.1, 0.17, 0.09], engine: -0.45 };
  }
}

/** @type {Map<string, ReturnType<typeof hullShape>>} */
const shapes = new Map();

/** @param {import('../skins.js').Hull} hull */
function shapeOf(hull) {
  let s = shapes.get(hull);
  if (!s) {
    s = hullShape(hull);
    shapes.set(hull, s);
  }
  return s;
}

/**
 * The ship at (x, y) px, `size` px long, tilted by `angle`; a flame while `thrust`.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size
 * @param {number} angle @param {boolean} thrust @param {boolean} flipped @param {number} time
 */
export function drawShip(ctx, skin, x, y, size, angle, thrust, flipped, time) {
  const shape = shapeOf(skin.hull);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, flipped ? -size : size);
  ctx.lineJoin = 'round';
  if (thrust) {
    const flicker = 0.85 + 0.15 * Math.sin(time * 60);
    const g = ctx.createLinearGradient(shape.engine, 0, shape.engine - 0.5 * flicker, 0);
    g.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 150, 60, 0.85)');
    g.addColorStop(1, 'rgba(255, 80, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(shape.engine + 0.04, -0.11);
    ctx.quadraticCurveTo(shape.engine - 0.3 * flicker, -0.06, shape.engine - 0.5 * flicker, 0.02);
    ctx.quadraticCurveTo(shape.engine - 0.3 * flicker, 0.1, shape.engine + 0.04, 0.13);
    ctx.closePath();
    ctx.fill();
  }
  // A thin dark shadow line under the hull, so it reads on a bright sky.
  ctx.lineWidth = 0.14;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.stroke(shape.body);
  ctx.fillStyle = skin.body;
  ctx.fill(shape.body);
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = skin.edge;
  ctx.stroke(shape.body);
  ctx.fillStyle = skin.accent;
  ctx.fill(shape.accent);
  const [cx, cy, rx, ry] = shape.canopy;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.glass;
  ctx.fill();
  ctx.lineWidth = 0.04;
  ctx.stroke();
  // A glint on the canopy.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.35, ry * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The wave (the finale's wave stretches): a dart in the skin's colours, its canopy glass
 * as the accent, turned to its flight.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size
 * @param {number} angle @param {boolean} flipped
 */
export function drawWaveIcon(ctx, skin, x, y, size, angle, flipped) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, flipped ? -size : size);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0.55, 0);
  ctx.lineTo(-0.5, -0.42);
  ctx.lineTo(-0.28, 0);
  ctx.lineTo(-0.5, 0.42);
  ctx.closePath();
  ctx.fillStyle = skin.body;
  ctx.fill();
  ctx.lineWidth = 0.08;
  ctx.strokeStyle = skin.edge;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.25, 0);
  ctx.lineTo(-0.2, -0.15);
  ctx.lineTo(-0.1, 0);
  ctx.lineTo(-0.2, 0.15);
  ctx.closePath();
  ctx.fillStyle = skin.accent;
  ctx.fill();
  ctx.restore();
}

