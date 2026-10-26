// @ts-check
// Drawing (docs/v2/PLAN.md 9.1, stage g-3): our own art from canvas shapes in the
// LifeXP colours (the dark theme's background, the violet accent, the warm yellow and
// green of its signals). Layers back to front: sky, stars, hills, pipes, ground, bird,
// sparks, flash. Everything is drawn in world units; renderFrame sets the scale.
import { BIRD, GROUND_HEIGHT, GROUND_Y, PIPE, WORLD_HEIGHT, birdTilt, createRng } from './logic.js';
import { squashScale } from './effects.js';

/** LifeXP dark theme (v2/src/ui/tokens.css) and a few shades made from it. */
export const PALETTE = {
  skyTop: '#0e0f13',
  skyMid: '#171833',
  skyLow: '#2b2560',
  glow: 'rgba(143, 136, 255, 0.22)',
  star: '#e8eaf0',
  hillFar: '#1d1c3d',
  hillNear: '#16172c',
  pipeDark: '#3b33b5',
  pipe: '#5f56f2',
  pipeLight: '#8f88ff',
  pipeEdge: '#2a238f',
  groundTop: '#4ecca3',
  groundTopDark: '#2f9c7b',
  ground: '#16181f',
  groundStripe: '#1e2029',
  bird: '#ffd166',
  birdBelly: '#ffe7a8',
  wing: '#f2a93b',
  beak: '#ff8a5c',
  eye: '#ffffff',
  pupil: '#0e0f13',
  outline: 'rgba(14, 15, 19, 0.55)',
  spark: ['#ffd166', '#8f88ff'],
};

const CAP_HEIGHT = 24;
const CAP_OVERHANG = 5;

/**
 * Stars at fixed places (their own seed, so the sky is the same every game).
 * @returns {{ x: number, y: number, r: number, phase: number }[]}
 */
function createStars() {
  const rng = createRng(20261026);
  return Array.from({ length: 42 }, () => ({
    x: rng() * 600,
    y: rng() * GROUND_Y * 0.62,
    r: 0.6 + rng() * 1.1,
    phase: rng() * Math.PI * 2,
  }));
}
const STARS = createStars();

/** @param {CanvasRenderingContext2D} ctx @param {number} width */
function renderSky(ctx, width) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, GROUND_Y);

  const glow = ctx.createRadialGradient(width * 0.78, 96, 0, width * 0.78, 96, 150);
  glow.addColorStop(0, PALETTE.glow);
  glow.addColorStop(1, 'rgba(143, 136, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 300);
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} distance @param {number} time
 * @param {boolean} reduced
 */
function renderStars(ctx, width, distance, time, reduced) {
  ctx.fillStyle = PALETTE.star;
  const span = 600;
  const shift = (distance * 0.04) % span;
  for (const star of STARS) {
    const x = (((star.x - shift) % span) + span) % span;
    if (x > width) continue;
    ctx.globalAlpha = reduced ? 0.55 : 0.35 + 0.3 * (1 + Math.sin(time * 1.6 + star.phase)) * 0.5;
    ctx.beginPath();
    ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * A soft line of hills, moving at `parallax` of the world's speed.
 * @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} distance
 * @param {{ color: string, base: number, height: number, parallax: number, wave: number }} layer
 */
function renderHillLayer(ctx, width, distance, layer) {
  const offset = distance * layer.parallax;
  ctx.fillStyle = layer.color;
  ctx.beginPath();
  ctx.moveTo(-8, GROUND_Y);
  for (let x = -8; x <= width + 16; x += 12) {
    const u = (x + offset) / layer.wave;
    const y = layer.base - layer.height * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width + 16, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} distance */
function renderHills(ctx, width, distance) {
  renderHillLayer(ctx, width, distance, { color: PALETTE.hillFar, base: GROUND_Y - 92, height: 34, parallax: 0.12, wave: 70 });
  renderHillLayer(ctx, width, distance, { color: PALETTE.hillNear, base: GROUND_Y - 38, height: 22, parallax: 0.3, wave: 46 });
}

/**
 * A rectangle with rounded corners as a path.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x0 @param {number} width */
function pipeGradient(ctx, x0, width) {
  const g = ctx.createLinearGradient(x0, 0, x0 + width, 0);
  g.addColorStop(0, PALETTE.pipeDark);
  g.addColorStop(0.28, PALETTE.pipe);
  g.addColorStop(0.42, PALETTE.pipeLight);
  g.addColorStop(0.6, PALETTE.pipe);
  g.addColorStop(1, PALETTE.pipeDark);
  return g;
}

/**
 * One half of a pipe: the body and its cap at the gap's edge.
 * @param {CanvasRenderingContext2D} ctx @param {number} top @param {number} bottom @param {boolean} capAtBottom
 */
function renderPipeHalf(ctx, top, bottom, capAtBottom) {
  ctx.fillStyle = pipeGradient(ctx, 0, PIPE.width);
  ctx.fillRect(0, top, PIPE.width, bottom - top);
  ctx.fillStyle = PALETTE.pipeEdge;
  ctx.fillRect(0, top, 2, bottom - top);
  ctx.fillRect(PIPE.width - 2, top, 2, bottom - top);

  const capY = capAtBottom ? bottom - CAP_HEIGHT : top;
  roundRect(ctx, -CAP_OVERHANG, capY, PIPE.width + CAP_OVERHANG * 2, CAP_HEIGHT, 6);
  ctx.fillStyle = pipeGradient(ctx, -CAP_OVERHANG, PIPE.width + CAP_OVERHANG * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.pipeEdge;
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {import('./logic.js').Pipe[]} pipes @param {number} lag
 */
function renderPipes(ctx, pipes, lag) {
  for (const pipe of pipes) {
    const top = pipe.gapY - pipe.gap / 2;
    const bottom = pipe.gapY + pipe.gap / 2;
    ctx.save();
    ctx.translate(Math.round((pipe.x + lag) * 2) / 2, 0);
    renderPipeHalf(ctx, -20, top, true);
    renderPipeHalf(ctx, bottom, GROUND_Y + 2, false);
    ctx.restore();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} distance */
function renderGround(ctx, width, distance) {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(-12, GROUND_Y, width + 24, GROUND_HEIGHT + 12);

  const stripe = 28;
  const shift = distance % stripe;
  ctx.fillStyle = PALETTE.groundStripe;
  for (let x = -stripe - shift; x < width + stripe; x += stripe) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 12);
    ctx.lineTo(x + 12, GROUND_Y + 12);
    ctx.lineTo(x + 12 - 18, WORLD_HEIGHT + 12);
    ctx.lineTo(x - 18, WORLD_HEIGHT + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.groundTopDark;
  ctx.fillRect(-12, GROUND_Y + 6, width + 24, 6);
  ctx.fillStyle = PALETTE.groundTop;
  ctx.fillRect(-12, GROUND_Y, width + 24, 6);
}

/**
 * The bird: a round body, a beating wing, an eye and a beak.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, vy: number, flapSince: number, time: number, alive: boolean, tiltOverride: number | null }} bird
 */
function renderBird(ctx, bird) {
  const r = BIRD.radius;
  const scale = squashScale(bird.flapSince);
  const tilt = bird.tiltOverride ?? birdTilt(bird.vy);
  // The wing beats fast right after a flap, slowly while gliding, not at all when dead.
  const beat = bird.alive ? Math.sin(bird.time * (bird.flapSince < 0.25 ? 28 : 10)) : 0.6;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(tilt);
  ctx.scale(scale.x, scale.y);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.bird;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.outline;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(1, 6, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.birdBelly;
  ctx.fill();

  ctx.save();
  ctx.translate(-5, 2);
  ctx.rotate(-0.25 + beat * 0.55);
  ctx.beginPath();
  ctx.ellipse(-3, 0, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.wing;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = PALETTE.outline;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(r - 3, -2);
  ctx.quadraticCurveTo(r + 10, 1, r - 2, 6);
  ctx.closePath();
  ctx.fillStyle = PALETTE.beak;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(6, -5, 5, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.eye;
  ctx.fill();
  ctx.beginPath();
  if (bird.alive) ctx.arc(7.5, -5, 2.4, 0, Math.PI * 2);
  else {
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = PALETTE.pupil;
    ctx.moveTo(4, -7.5);
    ctx.lineTo(9, -2.5);
    ctx.moveTo(9, -7.5);
    ctx.lineTo(4, -2.5);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.pupil;
  ctx.fill();
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {import('./effects.js').Particle[]} particles */
function renderParticles(ctx, particles) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (!p.alive) continue;
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = PALETTE.spark[p.hue] ?? PALETTE.bird;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} alpha */
function renderFlash(ctx, width, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, width, WORLD_HEIGHT);
}

/**
 * @typedef {{
 *   width: number,
 *   distance: number,
 *   time: number,
 *   pipes: import('./logic.js').Pipe[],
 *   pipeLag: number,
 *   bird: { x: number, y: number, vy: number, flapSince: number, time: number, alive: boolean, tiltOverride: number | null },
 *   particles: import('./effects.js').Particle[],
 *   shake: { x: number, y: number },
 *   flash: number,
 *   reduced: boolean,
 * }} Scene
 */

/**
 * One frame, back to front.
 * @param {CanvasRenderingContext2D} ctx @param {number} pixelScale CSS scale × devicePixelRatio
 * @param {Scene} scene
 */
export function renderFrame(ctx, pixelScale, scene) {
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  renderSky(ctx, scene.width);
  renderStars(ctx, scene.width, scene.distance, scene.time, scene.reduced);
  renderHills(ctx, scene.width, scene.distance);

  ctx.save();
  ctx.translate(scene.shake.x, scene.shake.y);
  renderPipes(ctx, scene.pipes, scene.pipeLag);
  renderGround(ctx, scene.width, scene.distance);
  renderBird(ctx, scene.bird);
  renderParticles(ctx, scene.particles);
  ctx.restore();

  renderFlash(ctx, scene.width, scene.flash);
}
