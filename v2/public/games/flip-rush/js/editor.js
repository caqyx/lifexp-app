// @ts-check
// Flip Rush's level editor (docs/v2/PLAN.md 9.1, stages r-3 and r-4): the shared editor
// (../../_engine/editor/editor.js) with this game's palette, look, orbs and pads.
import { runEditor } from '../../_engine/editor/editor.js';
import { FINALE, SECTORS } from './config.js';
import { PALETTE, TOOLS } from './palette.js';
import { drawPad, drawRing } from './render/boosters.js';
import { themeOf } from './render/themes.js';
import { SECTION_LIBRARY } from './sections/index.js';

runEditor({
  palette: PALETTE,
  title: 'Flip Rush',
  prefix: 'lifexp-fliprush-',
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
