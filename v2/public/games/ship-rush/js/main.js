// @ts-check
// Ship Rush, LifeXP's own game (docs/v2/PLAN.md 9.1, stage s-1): Wave Rush's sibling for
// the ship. The Rush engine's page (../../_engine/app.js) with this game's rules,
// sectors, records, skins, texts and look. Stage s-1 has sectors 1–3; the Demon and the
// finale (stage s-2) are not there yet, so their achievement and the finale's box are off.
import { runApp } from '../../_engine/app.js';
import { SECTORS } from './config.js';
import { RULES } from './game.js';
import { pickLang, translator } from './i18n.js';
import { records } from './records.js';
import { createRenderer, renderFrame } from './render/index.js';
import { drawShip } from './render/ship.js';
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
  slopeOf: () => 1,
  loadAutopilot: () => import('./autopilot.js').then((m) => m.createAutopilot()),
  demon: false,
  finale: false,
  /** The ship's curving trail and the hull. @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
  paintSkin(ctx, skin) {
    ctx.strokeStyle = skin.trail;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(4, 46);
    ctx.bezierCurveTo(20, 50, 28, 22, 44, 26);
    ctx.quadraticCurveTo(52, 28, 56, 32);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawShip(ctx, skin, 70, 33, 40, -0.12, true, false, 0);
  },
});
