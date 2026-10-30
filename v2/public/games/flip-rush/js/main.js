// @ts-check
// Flip Rush, LifeXP's own game (docs/v2/PLAN.md 9.1, stages f-1 and f-2): the third Rush
// game, for the ball and the spider, which take turns through portals. The Rush engine's
// page (../../_engine/app.js) with this game's rules, sectors, records, skins, texts and
// look. Stage f-1 has sectors 1–3; the Demon and the finale come in stage f-2.
import { runApp } from '../../_engine/app.js';
import { WAVE } from '../../_engine/wave.js';
import { SECTORS } from './config.js';
import { RULES } from './game.js';
import { pickLang, translator } from './i18n.js';
import { records } from './records.js';
import { createRenderer, renderFrame } from './render/index.js';
import { drawBall, drawSpider } from './render/vehicles.js';
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
  finale: false,
  holdTaps: true,
  /** The ball on the floor and the spider on the ceiling. @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
  paintSkin(ctx, skin) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(4, 59, 88, 3);
    ctx.fillRect(4, 2, 88, 3);
    drawBall(ctx, skin, 28, 42, 34, 0.5);
    drawSpider(ctx, skin, 68, 22, 34, 0.3, true, true);
  },
});
