// @ts-check
// Robot Rush's level editor (docs/v2/PLAN.md 9.1, stage rr-b): the shared editor
// (../../_engine/editor/editor.js) with this game's palette and look, and Flip Rush's orbs
// and pads (the robot uses them too).
import { runEditor } from '../../_engine/editor/editor.js';
import { FINALE, SECTORS } from './config.js';
import { PALETTE, TOOLS } from './palette.js';
import { drawPad, drawRing } from '../../flip-rush/js/render/boosters.js';
import { themeOf } from './render/themes.js';
import { SECTION_LIBRARY } from './sections/index.js';

runEditor({
  palette: PALETTE,
  title: 'Robot Rush',
  prefix: 'lifexp-robotrush-',
  sectors: SECTORS,
  finale: FINALE,
  library: SECTION_LIBRARY,
  themeOf,
  tools: TOOLS,
  drawBooster(ctx, b, x, y, cell) {
    if (b.type === 'ring') drawRing(ctx, b.kind, x, y, cell * (b.scale ?? 1), 0, false);
    else drawPad(ctx, b.kind, x, y, b.dir === 'up' ? 1 : -1, cell, 0, false);
  },
});
