// @ts-check
// Flip Rush's level editor (docs/v2/PLAN.md 9.1, stage r-3): the shared editor
// (../../_engine/editor/editor.js) with this game's palette, look, orbs and pads, and
// validator.
import { runEditor } from '../../_engine/editor/editor.js';
import { FINALE, SECTORS } from './config.js';
import { PALETTE, TOOLS } from './palette.js';
import { sectionProblems } from './prove.js';
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
  drawItem(ctx, item, x, y, cell) {
    /** @type {Record<string, any>} */
    const a = item;
    if (a.type === 'ring') drawRing(ctx, a.kind, x, y, cell, 0, false);
    else if (a.type === 'pad') drawPad(ctx, a.kind, x, y, a.on === 'ceil' ? -1 : 1, cell, 0, false);
    else return false;
    return true;
  },
  problems: (data, tier) => sectionProblems({ ...data, tier }, { id: 1, key: 'custom', tier, theme: '', groups: [[1]], portals: [] }, 1),
});
