// @ts-check
// Flip Rush's backgrounds (docs/v2/PLAN.md 9.1, stage f-1): a mechanical factory, back to
// front — the back wall, then a far, a middle and a near layer scrolling slower than the
// level (parallax), then floating dust or sparks.
// - hall: tall windows with shafts of daylight, steel trusses, hanging lamps, a conveyor
//   belt carrying crates along the bottom.
// - mine: layered rock with gem glints, timber frames, lanterns swaying on their hooks,
//   rails with ore carts.
// - foundry: furnaces and chimneys far behind, ladles on chains pouring molten streams,
//   the glow of molten metal from below.
// - reactor (stage f-2): turbines turning far behind, pipes with valves and blinking lights;
// - core: fuel rods in blue light, containment rings, the core pulsing with the beat;
// - the Demon: circuits with running pulses (Easy), gears turning in pairs (Hard), saws on
//   swinging arms with chains (Insane), all of it with white sparks (Extreme).
// Everything is placed by a repeatable hash (no state); with reduced motion nothing moves
// on its own (only the scroll moves it).
import { drawMotes, hash } from '../../../_engine/render/backdrop.js';
import { screenY } from '../../../_engine/render/view.js';

/**
 * @typedef {import('./themes.js').Theme} Theme
 * @typedef {import('../../../_engine/render/view.js').View} View
 * @typedef {{ time: number, pulse: number, reduced: boolean }} Clock
 */

/**
 * The left edge (device px) of the `i`-th repeat of something spaced `gap` cells apart at
 * `depth` of the level's scroll, and the index of the first one on screen.
 * @param {View} v @param {number} camX @param {number} depth @param {number} gap
 */
function repeats(v, camX, depth, gap) {
  const step = gap * v.cell;
  const shift = camX * depth * v.cell;
  const first = Math.floor(shift / step) - 1;
  const count = Math.ceil(v.width / step) + 3;
  return { first, count, at: (/** @type {number} */ i) => i * step - shift, step };
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th */
function drawWall(ctx, v, th) {
  const g = ctx.createLinearGradient(0, 0, 0, v.height);
  g.addColorStop(0, th.wall[0]);
  g.addColorStop(0.55, th.wall[1]);
  g.addColorStop(1, th.wall[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.width, v.height);
  const haze = ctx.createRadialGradient(v.width * 0.5, screenY(v, 6), 0, v.width * 0.5, screenY(v, 6), Math.max(v.width, v.height) * 0.7);
  haze.addColorStop(0, th.haze);
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, v.width, v.height);
}

// ── The hall ────────────────────────────────────────────────────────────────

/**
 * Tall factory windows with a grid of panes, and shafts of daylight falling from them.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawWindows(ctx, v, th, camX) {
  const r = repeats(v, camX, 0.05, 7);
  const c = v.cell;
  const top = screenY(v, -1);
  const h = 6.5 * c;
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i);
    const w = 3.6 * c;
    ctx.fillStyle = th.light;
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = th.far;
    ctx.lineWidth = Math.max(1, c * 0.12);
    ctx.strokeRect(x, top, w, h);
    ctx.beginPath();
    for (let k = 1; k < 3; k++) {
      ctx.moveTo(x + (w * k) / 3, top);
      ctx.lineTo(x + (w * k) / 3, top + h);
    }
    for (let k = 1; k < 5; k++) {
      ctx.moveTo(x, top + (h * k) / 5);
      ctx.lineTo(x + w, top + (h * k) / 5);
    }
    ctx.stroke();
    // A shaft of light down and to the right.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shaft = ctx.createLinearGradient(x, top + h, x + w * 1.6, top + h + 7 * c);
    shaft.addColorStop(0, 'rgba(255, 250, 225, 0.22)');
    shaft.addColorStop(1, 'rgba(255, 250, 225, 0)');
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x, top + h);
    ctx.lineTo(x + w, top + h);
    ctx.lineTo(x + w * 2.4, top + h + 8 * c);
    ctx.lineTo(x + w * 1.1, top + h + 8 * c);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * A steel truss across the hall: two chords and diagonal lattice between them, with
 * columns down to the floor every few bays.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawTruss(ctx, v, th, camX) {
  const c = v.cell;
  const r = repeats(v, camX, 0.15, 2);
  const y0 = screenY(v, 0.2);
  const y1 = screenY(v, 1.3);
  ctx.strokeStyle = th.mid;
  ctx.lineWidth = Math.max(1, c * 0.14);
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(v.width, y0);
  ctx.moveTo(0, y1);
  ctx.lineTo(v.width, y1);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i);
    ctx.moveTo(x, y1);
    ctx.lineTo(x + r.step / 2, y0);
    ctx.lineTo(x + r.step, y1);
  }
  ctx.stroke();
  ctx.fillStyle = th.mid;
  for (let i = r.first; i < r.first + r.count; i++) {
    if (((i % 5) + 5) % 5 !== 0) continue;
    ctx.fillRect(r.at(i) - c * 0.25, y1, c * 0.5, v.height - y1);
  }
}

/**
 * Lamps hanging from the truss on thin cords, each with a pool of warm light; they sway a
 * little.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawLamps(ctx, v, th, camX, clock) {
  const c = v.cell;
  const r = repeats(v, camX, 0.15, 6);
  const top = screenY(v, 1.3);
  for (let i = r.first; i < r.first + r.count; i++) {
    const swing = clock.reduced ? 0 : Math.sin(clock.time * 1.3 + i) * 0.06;
    const x = r.at(i) + 3 * c;
    const len = (1.2 + hash(i + 40) * 0.8) * c;
    const lx = x + Math.sin(swing) * len;
    const ly = top + Math.cos(swing) * len;
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = Math.max(1, c * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, c * 2.4);
    glow.addColorStop(0, th.light);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - c * 2.4, ly - c * 2.4, c * 4.8, c * 4.8);
    ctx.fillStyle = th.mid;
    ctx.beginPath();
    ctx.moveTo(lx - c * 0.45, ly + c * 0.35);
    ctx.lineTo(lx + c * 0.45, ly + c * 0.35);
    ctx.lineTo(lx + c * 0.18, ly);
    ctx.lineTo(lx - c * 0.18, ly);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A conveyor belt near the bottom: a belt on rollers, carrying crates along (the belt
 * moves on its own unless motion is reduced).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 * @param {number} y world y of the belt's top @param {number} depth
 */
function drawConveyor(ctx, v, th, camX, clock, y, depth) {
  const c = v.cell;
  const run = clock.reduced ? 0 : clock.time * 1.2;
  const top = screenY(v, y);
  const h = 0.45 * c;
  ctx.fillStyle = th.mid;
  ctx.fillRect(0, top, v.width, h);
  // Rollers and the belt's ridges moving along.
  const rollers = repeats(v, camX - run / depth, depth, 1);
  ctx.fillStyle = th.near;
  for (let i = rollers.first; i < rollers.first + rollers.count; i++) {
    ctx.beginPath();
    ctx.arc(rollers.at(i), top + h / 2, h * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  // Legs every few cells.
  const legs = repeats(v, camX, depth, 4);
  ctx.fillStyle = th.mid;
  for (let i = legs.first; i < legs.first + legs.count; i++) ctx.fillRect(legs.at(i), top + h, c * 0.2, c * 1.4);
  // Crates riding the belt.
  const crates = repeats(v, camX - run / depth, depth, 3);
  for (let i = crates.first; i < crates.first + crates.count; i++) {
    if (hash(i + 900) < 0.35) continue;
    const s = (0.6 + hash(i + 901) * 0.35) * c;
    const x = crates.at(i) + hash(i + 902) * c;
    ctx.fillStyle = th.near;
    ctx.fillRect(x, top - s, s, s);
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, top - s);
    ctx.lineTo(x + s, top);
    ctx.moveTo(x + s, top - s);
    ctx.lineTo(x, top);
    ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawHall(ctx, v, th, camX, clock) {
  drawWindows(ctx, v, th, camX);
  drawConveyor(ctx, v, th, camX, clock, 7.5, 0.1);
  drawTruss(ctx, v, th, camX);
  drawLamps(ctx, v, th, camX, clock);
  drawConveyor(ctx, v, th, camX, clock, 11.2, 0.3);
}

// ── The mine ────────────────────────────────────────────────────────────────

/**
 * Layered rock: wavy strata bands, darker as they go deeper, with gems glinting in them.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawStrata(ctx, v, th, camX, clock) {
  const c = v.cell;
  const shift = camX * 0.05;
  ctx.fillStyle = th.far;
  for (let band = 0; band < 4; band++) {
    const base = 1.5 + band * 2.6;
    ctx.globalAlpha = 0.3 + band * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, screenY(v, base + 1.2));
    for (let px = 0; px <= v.width + c; px += c) {
      const wx = px / c + shift;
      ctx.lineTo(px, screenY(v, base + 0.5 * Math.sin(wx * 0.4 + band * 2) + 0.3 * Math.sin(wx * 1.1 + band)));
    }
    ctx.lineTo(v.width + c, screenY(v, base + 1.2));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Gems in the rock: small diamonds that glint now and then.
  const gems = repeats(v, camX, 0.05, 2.5);
  for (let i = gems.first; i < gems.first + gems.count; i++) {
    if (hash(i + 70) < 0.4) continue;
    const x = gems.at(i) + hash(i + 71) * 2 * c;
    const y = screenY(v, hash(i + 72) * 12);
    const s = c * (0.12 + hash(i + 73) * 0.1);
    const glint = clock.reduced ? 0.6 : 0.35 + 0.65 * Math.max(0, Math.sin(clock.time * 1.7 + i * 2.3));
    ctx.globalAlpha = glint;
    ctx.fillStyle = hash(i + 74) > 0.5 ? '#7fe0ff' : '#ff8fd0';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Timber frames holding up the shaft: two posts and a cap beam with braces.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawTimbers(ctx, v, th, camX) {
  const c = v.cell;
  const r = repeats(v, camX, 0.18, 5);
  const top = screenY(v, 2.6);
  const bottom = screenY(v, 12.5);
  const w = 0.42 * c;
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i);
    ctx.fillStyle = th.mid;
    ctx.fillRect(x, top, w, bottom - top);
    ctx.fillRect(x - c * 0.9, top, c * 2.2, w);
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = w * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, top + c * 1.1);
    ctx.lineTo(x + c * 1.1, top + w);
    ctx.moveTo(x + w / 2, top + c * 1.1);
    ctx.lineTo(x - c * 0.6, top + w);
    ctx.stroke();
    // The grain: two darker lines along the post.
    ctx.strokeStyle = th.near;
    ctx.lineWidth = Math.max(1, c * 0.04);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, top + w);
    ctx.lineTo(x + w * 0.3, bottom);
    ctx.moveTo(x + w * 0.7, top + w);
    ctx.lineTo(x + w * 0.7, bottom);
    ctx.stroke();
  }
}

/**
 * Lanterns hanging from the cap beams, swaying, each with a warm halo.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawLanterns(ctx, v, th, camX, clock) {
  const c = v.cell;
  const r = repeats(v, camX, 0.18, 5);
  const top = screenY(v, 3);
  for (let i = r.first; i < r.first + r.count; i++) {
    const swing = clock.reduced ? 0 : Math.sin(clock.time * 1.6 + i * 1.3) * 0.12;
    const x = r.at(i) + c * 1.15;
    const len = c * 0.9;
    const lx = x + Math.sin(swing) * len;
    const ly = top + Math.cos(swing) * len;
    const flicker = clock.reduced ? 1 : 0.85 + 0.15 * Math.sin(clock.time * 9 + i * 3);
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, c * 2.8 * flicker);
    glow.addColorStop(0, th.light);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - c * 3, ly - c * 3, c * 6, c * 6);
    ctx.strokeStyle = th.near;
    ctx.lineWidth = Math.max(1, c * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(lx, ly - c * 0.25);
    ctx.stroke();
    ctx.fillStyle = '#ffe2a8';
    ctx.fillRect(lx - c * 0.16, ly - c * 0.22, c * 0.32, c * 0.44);
    ctx.strokeStyle = th.near;
    ctx.strokeRect(lx - c * 0.16, ly - c * 0.22, c * 0.32, c * 0.44);
  }
}

/**
 * Rails along the bottom with ore carts standing on them, heaped with rock.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawRails(ctx, v, th, camX) {
  const c = v.cell;
  const depth = 0.1;
  const rail = screenY(v, 8.4);
  const sleepers = repeats(v, camX, depth, 0.8);
  ctx.fillStyle = th.near;
  for (let i = sleepers.first; i < sleepers.first + sleepers.count; i++) ctx.fillRect(sleepers.at(i), rail, c * 0.35, c * 0.25);
  ctx.fillStyle = th.mid;
  ctx.fillRect(0, rail - c * 0.08, v.width, c * 0.1);
  const carts = repeats(v, camX, depth, 9);
  for (let i = carts.first; i < carts.first + carts.count; i++) {
    const x = carts.at(i) + hash(i + 20) * 3 * c;
    const w = 1.8 * c;
    const h = 1 * c;
    const top = rail - c * 0.25 - h;
    ctx.fillStyle = th.near;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.88, top + h);
    ctx.lineTo(x + w * 0.12, top + h);
    ctx.closePath();
    ctx.fill();
    // The heap of ore, with a gem or two.
    ctx.beginPath();
    ctx.arc(x + w / 2, top, w * 0.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#7fe0ff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x + w * 0.4, top - c * 0.35, c * 0.14, c * 0.14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = th.mid;
    for (const k of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.arc(x + w * k, rail - c * 0.18, c * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawMine(ctx, v, th, camX, clock) {
  drawStrata(ctx, v, th, camX, clock);
  drawTimbers(ctx, v, th, camX);
  drawLanterns(ctx, v, th, camX, clock);
  drawRails(ctx, v, th, camX);
}

// ── The foundry ─────────────────────────────────────────────────────────────

/**
 * The molten glow from below and the furnaces' silhouettes far behind: chimneys and
 * squat furnace bodies with glowing mouths.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawFurnaces(ctx, v, th, camX, clock) {
  const c = v.cell;
  const glow = ctx.createLinearGradient(0, screenY(v, 6), 0, v.height);
  glow.addColorStop(0, 'rgba(255, 90, 20, 0)');
  glow.addColorStop(1, 'rgba(255, 110, 30, 0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, v.width, v.height);
  const r = repeats(v, camX, 0.06, 8);
  const ground = screenY(v, 13);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i) + hash(i + 3) * 2 * c;
    ctx.fillStyle = th.far;
    // A chimney.
    const ch = (6 + hash(i + 4) * 4) * c;
    ctx.fillRect(x + c * 3.6, ground - ch, c * 0.8, ch);
    // The furnace: a body with a domed top.
    const w = 3.2 * c;
    const h = 4 * c;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground - h);
    ctx.quadraticCurveTo(x + w / 2, ground - h - c * 1.6, x + w, ground - h);
    ctx.lineTo(x + w, ground);
    ctx.closePath();
    ctx.fill();
    const beat = clock.reduced ? 0.8 : 0.6 + 0.4 * Math.sin(clock.time * 2 + i);
    ctx.fillStyle = `rgba(255, 140, 40, ${0.55 * beat})`;
    ctx.fillRect(x + w * 0.3, ground - h * 0.45, w * 0.4, h * 0.25);
  }
}

/**
 * Ladles hanging on chains from a gantry, tipping a stream of molten metal down (the
 * stream flows unless motion is reduced).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawLadles(ctx, v, th, camX, clock) {
  const c = v.cell;
  const r = repeats(v, camX, 0.12, 7);
  const rail = screenY(v, 2.5);
  ctx.fillStyle = th.mid;
  ctx.fillRect(0, rail - c * 0.2, v.width, c * 0.4);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i) + c * 2;
    const drop = (0.6 + hash(i + 50) * 0.8) * c;
    // The chain: links in turn.
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = Math.max(1, c * 0.07);
    for (let y = rail; y < rail + drop; y += c * 0.32) {
      ctx.beginPath();
      ctx.ellipse(x, y + c * 0.16, c * 0.08, c * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The ladle, tilted, with molten metal inside.
    const top = rail + drop;
    ctx.save();
    ctx.translate(x, top + c * 0.6);
    ctx.rotate(0.35);
    ctx.fillStyle = '#3a2620';
    ctx.beginPath();
    ctx.moveTo(-c * 0.75, -c * 0.45);
    ctx.lineTo(c * 0.75, -c * 0.45);
    ctx.quadraticCurveTo(c * 0.7, c * 0.55, 0, c * 0.6);
    ctx.quadraticCurveTo(-c * 0.7, c * 0.55, -c * 0.75, -c * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 130, 60, 0.55)';
    ctx.lineWidth = Math.max(1, c * 0.05);
    ctx.stroke();
    // The bail it hangs by, and the molten metal glowing at the rim.
    ctx.strokeStyle = '#3a2620';
    ctx.lineWidth = Math.max(1, c * 0.08);
    ctx.beginPath();
    ctx.arc(0, -c * 0.45, c * 0.75, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 160, 70, 0.75)';
    ctx.fillRect(-c * 0.7, -c * 0.5, c * 1.4, c * 0.12);
    ctx.restore();
    // The pour: a glowing stream from the lip down out of sight, beads running down it.
    const lx = x + c * 0.85;
    const ly = top + c * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const stream = ctx.createLinearGradient(lx, ly, lx, v.height);
    stream.addColorStop(0, 'rgba(255, 190, 90, 0.45)');
    stream.addColorStop(1, 'rgba(255, 90, 20, 0.08)');
    ctx.fillStyle = stream;
    ctx.fillRect(lx - c * 0.06, ly, c * 0.12, v.height - ly);
    if (!clock.reduced) {
      ctx.fillStyle = 'rgba(255, 220, 150, 0.4)';
      for (let k = 0; k < 4; k++) {
        const t = (clock.time * 0.9 + k / 4 + hash(i + 60)) % 1;
        ctx.beginPath();
        ctx.arc(lx, ly + t * (v.height - ly), c * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/**
 * Heavy chains hanging close in front, swinging slowly.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawChains(ctx, v, th, camX, clock) {
  const c = v.cell;
  const r = repeats(v, camX, 0.36, 11);
  ctx.strokeStyle = th.near;
  ctx.lineWidth = Math.max(1, c * 0.12);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i) + hash(i + 80) * 4 * c;
    const len = (2 + hash(i + 81) * 2.5) * c;
    const swing = clock.reduced ? 0 : Math.sin(clock.time * 0.9 + i) * 0.05;
    const top = screenY(v, -1.5);
    for (let d = 0; d < len; d += c * 0.42) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(swing) * d, top + d, c * 0.13, c * 0.22, swing, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    const hx = x + Math.sin(swing) * len;
    ctx.arc(hx, top + len + c * 0.25, c * 0.3, 0, Math.PI);
    ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawFoundry(ctx, v, th, camX, clock) {
  drawFurnaces(ctx, v, th, camX, clock);
  drawLadles(ctx, v, th, camX, clock);
  drawChains(ctx, v, th, camX, clock);
}

// ── The reactor's turbine hall (sector 4) ───────────────────────────────────

/**
 * A gear (or a turbine's rotor when `blades`) at (x, y) device px.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} teeth @param {number} angle @param {string} color @param {boolean} [blades]
 */
function drawGear(ctx, x, y, r, teeth, angle, color, blades = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (blades) {
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a, a + (Math.PI / teeth) * 0.9);
      ctx.closePath();
    }
  } else {
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.84;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.lineTo(Math.cos(a + Math.PI / (teeth * 2)) * rr, Math.sin(a + Math.PI / (teeth * 2)) * rr);
    }
    ctx.closePath();
    ctx.moveTo(r * 0.35, 0);
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2, true);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * A circular saw (a toothed disc with a hub) at (x, y), turning.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} angle @param {string} color @param {string} edge
 */
function drawBackSaw(ctx, x, y, r, angle, color, edge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  const teeth = 14;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + 0.18) * r * 0.82, Math.sin(a + 0.18) * r * 0.82);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Turbines far behind (rotors turning in their housings), pipes along the wall with valves
 * and warning lights that blink.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawReactor(ctx, v, th, camX, clock) {
  const c = v.cell;
  const t = clock.reduced ? 0 : clock.time;
  const turb = repeats(v, camX, 0.06, 9);
  for (let i = turb.first; i < turb.first + turb.count; i++) {
    const x = turb.at(i) + 3 * c;
    const y = screenY(v, 6);
    const r = 2.6 * c;
    ctx.strokeStyle = th.far;
    ctx.lineWidth = c * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
    ctx.stroke();
    drawGear(ctx, x, y, r, 7, t * 0.8 + i, th.far, true);
  }
  const pipes = [3.2, 8.8];
  for (const [k, py] of pipes.entries()) {
    const y = screenY(v, py);
    ctx.fillStyle = th.mid;
    ctx.fillRect(0, y - c * 0.22, v.width, c * 0.44);
    const valves = repeats(v, camX, 0.18, 6);
    for (let i = valves.first; i < valves.first + valves.count; i++) {
      const x = valves.at(i) + (k * 3 + 1) * c;
      ctx.fillStyle = th.mid;
      ctx.fillRect(x - c * 0.3, y - c * 0.4, c * 0.6, c * 0.8);
      const on = clock.reduced ? 0.6 : Math.sin(t * 3 + i * 1.7 + k) > 0.2 ? 1 : 0.25;
      ctx.globalAlpha = on;
      ctx.fillStyle = th.light;
      ctx.beginPath();
      ctx.arc(x, y - c * 0.55, c * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ── The reactor's core (sector 5) ───────────────────────────────────────────

/**
 * Fuel rods glowing in blue light, containment rings around the core, the core pulsing.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawCore(ctx, v, th, camX, clock) {
  const c = v.cell;
  const beat = clock.reduced ? 0.5 : clock.pulse;
  const cx = v.width / 2;
  const cy = screenY(v, 13);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(v.width, v.height) * 0.8);
  glow.addColorStop(0, `rgba(120, 200, 255, ${0.35 + 0.2 * beat})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, v.width, v.height);
  ctx.strokeStyle = th.far;
  ctx.lineWidth = c * 0.18;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, k * 5 * c, k * 1.6 * c, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  const rods = repeats(v, camX, 0.14, 2.5);
  for (let i = rods.first; i < rods.first + rods.count; i++) {
    const x = rods.at(i);
    const top = screenY(v, 2 + hash(i + 31) * 2);
    const g = ctx.createLinearGradient(0, top, 0, v.height);
    g.addColorStop(0, th.mid);
    g.addColorStop(1, `rgba(120, 200, 255, ${0.35 + 0.25 * beat})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, top, c * 0.5, v.height - top);
  }
}

// ── The Demon: circuits, gears, saws (sector 6) ─────────────────────────────

/**
 * Circuit traces: right-angled lines with pads at their ends and pulses running along.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock @param {number} depth
 */
function drawCircuits(ctx, v, th, camX, clock, depth) {
  const c = v.cell;
  const r = repeats(v, camX, depth, 3);
  ctx.lineWidth = Math.max(1, c * 0.08);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i);
    for (let k = 0; k < 3; k++) {
      const seed = i * 7 + k;
      const y0 = screenY(v, 1 + hash(seed) * 11);
      const y1 = screenY(v, 1 + hash(seed + 3) * 11);
      const run = (1 + hash(seed + 5) * 2) * c;
      ctx.strokeStyle = th.far;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + run, y0);
      ctx.lineTo(x + run + Math.abs(y1 - y0) * 0.3, y1);
      ctx.lineTo(x + r.step, y1);
      ctx.stroke();
      ctx.fillStyle = th.far;
      ctx.fillRect(x - c * 0.1, y0 - c * 0.1, c * 0.2, c * 0.2);
      if (!clock.reduced) {
        // A pulse running along the first leg.
        const p = (clock.time * 0.6 + hash(seed + 9)) % 1;
        ctx.fillStyle = th.light;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x + run * p, y0, c * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

/**
 * Big gears turning behind, in meshing pairs (each turns the other way).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock @param {number} depth @param {string} color
 */
function drawGears(ctx, v, camX, clock, depth, color) {
  const c = v.cell;
  const t = clock.reduced ? 0 : clock.time;
  const r = repeats(v, camX, depth, 8);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i) + 2 * c;
    const y = screenY(v, 3 + hash(i + 50) * 6);
    const big = 1.8 * c;
    drawGear(ctx, x, y, big, 12, t * 0.5 + i, color);
    drawGear(ctx, x + big * 1.55, y + big * 0.9, big * 0.6, 8, -t * 0.5 * (12 / 8) + i, color);
  }
}

/**
 * Saws on swinging arms and chains hanging between them.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock @param {number} depth
 */
function drawSawArms(ctx, v, th, camX, clock, depth) {
  const c = v.cell;
  const t = clock.reduced ? 0 : clock.time;
  const r = repeats(v, camX, depth, 7);
  for (let i = r.first; i < r.first + r.count; i++) {
    const x = r.at(i) + 1.5 * c;
    const top = screenY(v, 0.5);
    const swing = Math.sin(t * 1.1 + i) * 0.35;
    const len = (3.5 + hash(i + 70) * 3) * c;
    const sx = x + Math.sin(swing) * len;
    const sy = top + Math.cos(swing) * len;
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = c * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    drawBackSaw(ctx, sx, sy, c * 1.1, t * 4 + i, th.mid, th.far);
    // A chain to the next arm.
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.strokeStyle = th.far;
    for (let k = 0; k < 7; k++) {
      const u = k / 7;
      const cx = x + u * r.step;
      const cy = top + c * 0.4 + Math.sin(u * Math.PI) * c * 1.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, c * 0.16, c * 0.1, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/**
 * White sparks flashing here and there (the Extreme's), not with reduced motion.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Clock} clock
 */
function drawSparks(ctx, v, clock) {
  if (clock.reduced) return;
  const c = v.cell;
  const beat = Math.floor(clock.time * 4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(1, c * 0.05);
  for (let k = 0; k < 4; k++) {
    const x = hash(beat * 13 + k) * v.width;
    const y = hash(beat * 17 + k) * v.height;
    for (let j = 0; j < 4; j++) {
      const a = hash(beat + k * 5 + j) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * c * 0.6, y + Math.sin(a) * c * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawDemon(ctx, v, th, camX, clock) {
  const b = th.backdrop;
  drawCircuits(ctx, v, th, camX, clock, 0.05);
  if (b === 'gears' || b === 'saws' || b === 'overdrive') drawGears(ctx, v, camX, clock, 0.1, th.far);
  if (b === 'circuits' || b === 'overdrive') drawCircuits(ctx, v, th, camX, clock, 0.16);
  if (b === 'saws' || b === 'overdrive') drawSawArms(ctx, v, th, camX, clock, 0.24);
  if (b === 'overdrive') {
    drawGears(ctx, v, camX, clock, 0.3, th.mid);
    drawSparks(ctx, v, clock);
  }
}

/**
 * The whole background of a theme.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
export function drawBackground(ctx, v, th, camX, clock) {
  drawWall(ctx, v, th);
  if (th.backdrop === 'hall') drawHall(ctx, v, th, camX, clock);
  else if (th.backdrop === 'mine') drawMine(ctx, v, th, camX, clock);
  else if (th.backdrop === 'foundry') drawFoundry(ctx, v, th, camX, clock);
  else if (th.backdrop === 'reactor') drawReactor(ctx, v, th, camX, clock);
  else if (th.backdrop === 'core') drawCore(ctx, v, th, camX, clock);
  else drawDemon(ctx, v, th, camX, clock);
  if (th.motes && !clock.reduced) drawMotes(ctx, v, th.motes, camX, clock.time);
}
