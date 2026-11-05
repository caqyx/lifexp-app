// @ts-check
// Wave Rush, LifeXP's own game (docs/v2/PLAN.md 9.1, stage w-1): the shared page
// (../../_engine/app.js) with this game's rules, sectors, records, skins, texts and look.
import { runApp } from '../../_engine/app.js';
import { paintSkin } from './preview.js';
import { SECTORS, WAVE } from './config.js';
import { RULES } from './game.js';
import { pickLang, translator } from './i18n.js';
import { records } from './records.js';
import { createRenderer, renderFrame } from './render/index.js';
import { SKINS } from './skins.js';
import { PALETTE } from './palette.js';
import { buildCustom } from './run.js';

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
  // The level editor (stage r-3): its button on the menu, and its test play.
  palette: PALETTE,
  buildCustom,
  loadAutopilot: () => import('./autopilot.js').then((m) => m.createAutopilot()),
  demon: true,
  finale: true,
  paintSkin,
});
