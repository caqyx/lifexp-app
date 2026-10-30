// @ts-check
// Wave Rush, LifeXP's own game (docs/v2/PLAN.md 9.1, stage w-1): the shared page
// (../../_engine/app.js) with this game's rules, sectors, records, skins, texts and look.
import { runApp } from '../../_engine/app.js';
import { SECTORS, WAVE } from './config.js';
import { RULES } from './game.js';
import { pickLang, translator } from './i18n.js';
import { records } from './records.js';
import { createRenderer, renderFrame } from './render/index.js';
import { drawWave } from './render/sprites.js';
import { SKINS } from './skins.js';

const lang = pickLang(location.search);

runApp({
  lang,
  t: /** @type {import('../../_engine/app.js').Translate} */ (translator(lang)),
  sectors: SECTORS,
  rules: RULES,
  records,
  skins: SKINS,
  createRenderer,
  renderFrame,
  slopeOf: (w) => (w.mini ? WAVE.miniSlope : WAVE.slope),
  loadAutopilot: () => import('./autopilot.js').then((m) => m.createAutopilot()),
  demon: true,
  finale: true,
  /** The wave's zig-zag trail and the icon. @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
  paintSkin(ctx, skin) {
    ctx.strokeStyle = skin.trail;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'miter';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(4, 44);
    ctx.lineTo(24, 24);
    ctx.lineTo(44, 44);
    ctx.lineTo(62, 26);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawWave(ctx, skin, 66, 22, 30, -Math.PI / 4);
  },
});
