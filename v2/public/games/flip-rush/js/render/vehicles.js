// @ts-check
// The ball and the spider, drawn every frame in the player's skin (docs/v2/PLAN.md 9.1,
// stage f-1), both original machines in unit coordinates (1 = the body's size):
// - the BALL: a round shell with the skin's pattern, rolling — it turns by the distance it
//   covers over its radius, the way a wheel does, forward on the floor and backward on the
//   ceiling (render only: the physics has no angle);
// - the SPIDER: a domed body with two eyes and four legs that step with the distance run,
//   tucked in while it falls; upside down when gravity is. Its snap across is instant, so
//   for a moment a streak of the skin's trail colour joins where it left to where it
//   landed, fading out.

/** @typedef {import('../skins.js').Skin} Skin */

/**
 * The ball's turn, accumulated from the distance run (reset when the run restarts or
 * jumps). Module state: the page has one game.
 */
const roll = { x: NaN, angle: 0 };

/**
 * The ball's angle for this frame: how far it has rolled since the last one.
 * @param {number} x world x @param {number} radius cells @param {boolean} flipped
 */
export function rollAngle(x, radius, flipped) {
  const dx = x - roll.x;
  if (!(dx >= 0 && dx < 2)) roll.angle = 0;
  else roll.angle += (dx / radius) * (flipped ? -1 : 1);
  roll.x = x;
  return roll.angle;
}

/**
 * The skin's pattern on the ball's shell (radius 0.5).
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin
 */
function ballPattern(ctx, skin) {
  ctx.fillStyle = skin.accent;
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 0.07;
  switch (skin.pattern) {
    case 'gear': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.rect(Math.cos(a) * 0.28 - 0.05, Math.sin(a) * 0.28 - 0.05, 0.1, 0.1);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(0.08, -0.36);
      ctx.lineTo(-0.16, 0.04);
      ctx.lineTo(0.02, 0.04);
      ctx.lineTo(-0.08, 0.36);
      ctx.lineTo(0.18, -0.06);
      ctx.lineTo(0, -0.06);
      ctx.closePath();
      ctx.fill();
      break;
    case 'rivets':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * 0.32 + 0.05, Math.sin(a) * 0.32);
        ctx.arc(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.05, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.32, 0);
      ctx.lineTo(0.32, 0);
      ctx.stroke();
      break;
    case 'split':
      ctx.beginPath();
      ctx.arc(0, 0, 0.44, Math.PI * 0.5, Math.PI * 1.5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hazard':
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 0.44, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      for (let k = -3; k <= 3; k++) {
        ctx.moveTo(k * 0.22 - 0.5, 0.5);
        ctx.lineTo(k * 0.22 - 0.39, 0.5);
        ctx.lineTo(k * 0.22 + 0.61, -0.5);
        ctx.lineTo(k * 0.22 + 0.5, -0.5);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
      break;
    case 'core':
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 0.36, a, a + Math.PI / 3);
        ctx.closePath();
      }
      ctx.fill();
      ctx.fillStyle = skin.eye;
      ctx.beginPath();
      ctx.arc(0, 0, 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'grid':
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.18);
      ctx.lineTo(0, -0.18);
      ctx.lineTo(0.12, -0.3);
      ctx.moveTo(-0.3, 0.12);
      ctx.lineTo(0.3, 0.12);
      ctx.moveTo(0.1, 0.12);
      ctx.lineTo(0.1, 0.32);
      ctx.moveTo(-0.12, -0.18);
      ctx.lineTo(-0.12, 0.12);
      ctx.stroke();
      ctx.beginPath();
      for (const [px, py] of [[0.12, -0.3], [0.3, 0.12], [0.1, 0.32], [-0.3, -0.18]]) {
        ctx.moveTo(/** @type {number} */ (px) + 0.05, /** @type {number} */ (py));
        ctx.arc(/** @type {number} */ (px), /** @type {number} */ (py), 0.05, 0, Math.PI * 2);
      }
      ctx.fill();
      break;
    case 'spiral':
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const a = t * Math.PI * 5;
        const r = 0.04 + t * 0.34;
        if (t === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.rect(-0.36, -0.07, 0.72, 0.14);
      ctx.rect(-0.07, -0.36, 0.14, 0.72);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-0.3, 0.16);
      ctx.lineTo(-0.3, -0.12);
      ctx.lineTo(-0.15, 0.02);
      ctx.lineTo(0, -0.24);
      ctx.lineTo(0.15, 0.02);
      ctx.lineTo(0.3, -0.12);
      ctx.lineTo(0.3, 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.eye;
      ctx.beginPath();
      ctx.arc(0, 0.06, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
}

/**
 * The ball at (x, y) device px, `size` px across, turned by `angle`.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size @param {number} angle
 */
export function drawBall(ctx, skin, x, y, size, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  // A soft dark rim, so it reads on a bright wall.
  ctx.beginPath();
  ctx.arc(0, 0, 0.53, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 0.48, 0, Math.PI * 2);
  ctx.fillStyle = skin.body;
  ctx.fill();
  ctx.save();
  ctx.rotate(angle);
  ballPattern(ctx, skin);
  ctx.restore();
  // Shading that stays put while the pattern turns: a highlight up left, a shadow down right.
  const shine = ctx.createRadialGradient(-0.18, -0.2, 0.02, 0, 0, 0.5);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  shine.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.beginPath();
  ctx.arc(0, 0, 0.48, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = skin.edge;
  ctx.stroke();
  ctx.restore();
}

/**
 * The spider at (x, y) device px, `size` px across: legs stepping with `stride` (the
 * distance run, in cells), tucked while in the air; feet toward +y unless flipped.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size
 * @param {number} stride @param {boolean} grounded @param {boolean} flipped
 */
export function drawSpider(ctx, skin, x, y, size, stride, grounded, flipped) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, flipped ? -size : size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Four legs: two pairs out of phase, each a thigh up and out and a shin down to the foot.
  const phase = stride * Math.PI * 1.6;
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = 0.13;
  /** @type {[number, number, number, number][]} */
  const legs = [];
  for (const [i, side] of /** @type {[number, number][]} */ ([[0, -1], [1, -1], [2, 1], [3, 1]])) {
    const off = i % 2 === 0 ? 0 : Math.PI;
    const step = grounded ? Math.sin(phase + off) : 0;
    const lift = grounded ? Math.max(0, Math.cos(phase + off)) * 0.12 : 0.2;
    const hipX = side * (0.12 + (i % 2) * 0.1);
    const kneeX = side * (0.38 + (i % 2) * 0.12) + step * 0.06;
    const footX = side * (0.34 + (i % 2) * 0.16) + step * 0.14;
    const footY = 0.5 - lift;
    legs.push([hipX, kneeX, footX, footY]);
  }
  for (const [hipX, kneeX, footX, footY] of legs) {
    ctx.beginPath();
    ctx.moveTo(hipX, 0.05);
    ctx.lineTo(kneeX, -0.12);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  }
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 0.07;
  for (const [hipX, kneeX, footX, footY] of legs) {
    ctx.beginPath();
    ctx.moveTo(hipX, 0.05);
    ctx.lineTo(kneeX, -0.12);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  }
  // The body: a dome over a flat belly, the skin's pattern as a band.
  ctx.beginPath();
  ctx.moveTo(-0.36, 0.14);
  ctx.quadraticCurveTo(-0.36, -0.34, 0, -0.34);
  ctx.quadraticCurveTo(0.36, -0.34, 0.36, 0.14);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 0.14;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.stroke();
  ctx.fillStyle = skin.body;
  ctx.fill();
  ctx.fillStyle = skin.accent;
  ctx.fillRect(-0.36, 0.02, 0.72, 0.1);
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = skin.edge;
  ctx.stroke();
  // Two eyes looking ahead.
  ctx.fillStyle = skin.eye;
  for (const ex of [0.06, 0.22]) {
    ctx.beginPath();
    ctx.arc(ex, -0.13, 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = skin.edge;
  for (const ex of [0.08, 0.24]) {
    ctx.beginPath();
    ctx.arc(ex, -0.13, 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The spider's snap: a streak from where it left (y0) to where it is (y1), device px,
 * `fade` 1 just after the snap and 0 when gone.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y0 @param {number} y1 @param {number} width @param {number} fade
 */
export function drawStreak(ctx, skin, x, y0, y1, width, fade) {
  if (fade <= 0 || Math.abs(y1 - y0) < 1) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, fade);
  const w = width * (0.4 + 0.6 * fade);
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  // A dark outline (it reads on a bright wall), the skin's trail colour inside, fading
  // toward where the spider left, and a white core.
  ctx.fillStyle = skin.edge;
  ctx.globalAlpha = Math.min(1, fade) * 0.6;
  ctx.fillRect(x - w / 2 - 1.5, top, w + 3, h);
  ctx.globalAlpha = Math.min(1, fade);
  const g = ctx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
  g.addColorStop(1, skin.trail);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(x - w * 0.12, top, w * 0.24, h);
  ctx.restore();
}
