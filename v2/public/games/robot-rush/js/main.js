// @ts-check
// Robot Rush, LifeXP's own game (docs/v2/PLAN.md 9.1, stage rr-b): Rush's fourth mode, the
// robot through a neon city at night. The Rush engine's page (../../_engine/app.js) with
// this game's rules, sectors, records, skins, texts and look. Finishing the whole run (the
// Demon included) is the achievement that unlocks the last skin and the finale.
import { runApp } from '../../_engine/app.js';
import { paintSkin } from './preview.js';
import { SECTORS } from './config.js';
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
  // The robot runs level: its icon does not turn with a slope.
  slopeOf: () => 0,
  // The level editor: its button on the menu, and its test play.
  palette: PALETTE,
  buildCustom,
  loadAutopilot: () => import('./autopilot.js').then((m) => m.createAutopilot()),
  demon: true,
  finale: true,
  paintSkin,
});
