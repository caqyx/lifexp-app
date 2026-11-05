// @ts-check
// The robot (docs/v2/PLAN.md 9.1, stage rr-b), original art from canvas shapes: a boxy
// body with a glowing visor and a chest light, two legs that stride on the ground and tuck
// in the air, the thrusters' flame under the feet while a jump climbs, and the skin's crest
// on top. Upside down it is drawn mirrored top to bottom (its feet on the ceiling).

/**
 * @typedef {import('../skins.js').Skin} Skin
 * @typedef {{ stride: number, air: boolean, flame: number, flipped: boolean }} Pose
 *   stride: how far along its stride (cells run; drawing only); air: off the ground (legs
 *   tucked); flame: the thrusters' flame 0..1; flipped: upside down.
 */

/**
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * The crest on top of the head (unit: the robot's size `s`, head top at y = -0.5s).
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} s
 */
function drawCrest(ctx, skin, s) {
  ctx.fillStyle = skin.accent;
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = Math.max(1, s * 0.05);
  const top = -0.5 * s;
  ctx.beginPath();
  switch (skin.crest) {
    case 'antenna':
      ctx.moveTo(0.1 * s, top);
      ctx.lineTo(0.18 * s, top - 0.22 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0.18 * s, top - 0.26 * s, 0.07 * s, 0, Math.PI * 2);
      break;
    case 'fin':
      ctx.moveTo(-0.25 * s, top);
      ctx.lineTo(0.05 * s, top - 0.24 * s);
      ctx.lineTo(0.2 * s, top);
      break;
    case 'horns':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.3 * s, top);
        ctx.lineTo(d * 0.4 * s, top - 0.2 * s);
        ctx.lineTo(d * 0.18 * s, top);
      }
      break;
    case 'dome':
      ctx.arc(0, top, 0.2 * s, Math.PI, 0);
      break;
    case 'mohawk':
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(k * 0.09 * s - 0.05 * s, top);
        ctx.lineTo(k * 0.09 * s, top - 0.16 * s);
        ctx.lineTo(k * 0.09 * s + 0.05 * s, top);
      }
      break;
    case 'ears':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.36 * s, top + 0.02 * s);
        ctx.lineTo(d * 0.32 * s, top - 0.18 * s);
        ctx.lineTo(d * 0.18 * s, top + 0.02 * s);
      }
      break;
    case 'visor':
      ctx.rect(-0.42 * s, top - 0.08 * s, 0.84 * s, 0.1 * s);
      break;
    case 'spikes':
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(k * 0.22 * s - 0.08 * s, top);
        ctx.lineTo(k * 0.22 * s, top - 0.2 * s);
        ctx.lineTo(k * 0.22 * s + 0.08 * s, top);
      }
      break;
    case 'halo':
      ctx.ellipse(0, top - 0.16 * s, 0.26 * s, 0.07 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'crown':
      ctx.moveTo(-0.32 * s, top);
      ctx.lineTo(-0.32 * s, top - 0.2 * s);
      ctx.lineTo(-0.16 * s, top - 0.08 * s);
      ctx.lineTo(0, top - 0.24 * s);
      ctx.lineTo(0.16 * s, top - 0.08 * s);
      ctx.lineTo(0.32 * s, top - 0.2 * s);
      ctx.lineTo(0.32 * s, top);
      break;
    default:
      return;
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * The robot, its body's centre at (x, y), `size` px tall.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size @param {Pose} pose
 */
export function drawRobot(ctx, skin, x, y, size, pose) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  if (pose.flipped) ctx.scale(1, -1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The thrusters' flame under the feet.
  if (pose.flame > 0) {
    const len = s * (0.25 + 0.35 * pose.flame);
    const flame = ctx.createLinearGradient(0, 0.45 * s, 0, 0.45 * s + len);
    flame.addColorStop(0, skin.trail);
    flame.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flame;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * 0.18 * s - 0.09 * s, 0.45 * s);
      ctx.lineTo(d * 0.18 * s, 0.45 * s + len);
      ctx.lineTo(d * 0.18 * s + 0.09 * s, 0.45 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Legs: a stride on the ground, tucked in the air.
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = Math.max(2, s * 0.16);
  const swing = pose.air ? 0 : Math.sin(pose.stride * Math.PI * 2) * 0.14 * s;
  const reach = pose.air ? 0.34 * s : 0.48 * s;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 0.16 * s, 0.12 * s);
    ctx.lineTo(d * 0.18 * s + d * swing, reach);
    ctx.stroke();
  }
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = Math.max(1, s * 0.09);
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 0.16 * s, 0.12 * s);
    ctx.lineTo(d * 0.18 * s + d * swing, reach);
    ctx.stroke();
  }
  // Arms, swinging against the legs.
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = Math.max(2, s * 0.11);
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 0.36 * s, -0.04 * s);
    ctx.lineTo(d * 0.48 * s, (pose.air ? -0.2 : 0.14) * s - d * swing * 0.5);
    ctx.stroke();
  }
  // Body and head in one block.
  roundRect(ctx, -0.38 * s, -0.5 * s, 0.76 * s, 0.66 * s, 0.12 * s);
  const shell = ctx.createLinearGradient(0, -0.5 * s, 0, 0.16 * s);
  shell.addColorStop(0, skin.body);
  shell.addColorStop(1, skin.edge);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.stroke();
  // The visor and its glow, looking the way it runs.
  roundRect(ctx, -0.12 * s, -0.36 * s, 0.44 * s, 0.18 * s, 0.07 * s);
  ctx.fillStyle = skin.edge;
  ctx.fill();
  ctx.fillStyle = skin.eye;
  ctx.fillRect(0.04 * s, -0.31 * s, 0.22 * s, 0.07 * s);
  // The chest light.
  ctx.fillStyle = skin.accent;
  ctx.beginPath();
  ctx.arc(-0.14 * s, -0.02 * s, 0.07 * s, 0, Math.PI * 2);
  ctx.fill();
  drawCrest(ctx, skin, s);
  ctx.restore();
}
