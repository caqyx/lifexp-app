// @ts-check
// Wave Rush's level editor (docs/v2/PLAN.md 9.1, stage r-3): the shared editor
// (../../_engine/editor/editor.js) with this game's palette, look and validator.
import { runEditor } from '../../_engine/editor/editor.js';
import { FINALE_ID, SECTORS } from './config.js';
import { PALETTE, TOOLS } from './palette.js';
import { sectionProblems } from './prove.js';
import { themeOf } from './render/themes.js';
import { FINALE, SECTION_LIBRARY } from './sections/index.js';

runEditor({
  palette: PALETTE,
  title: 'Wave Rush',
  prefix: 'lifexp-waverush-',
  sectors: SECTORS,
  finale: { ...FINALE, id: FINALE_ID },
  library: SECTION_LIBRARY,
  themeOf,
  tools: TOOLS,
  problems: (data, tier) => sectionProblems({ ...data, tier }, { id: 1, key: 'custom', tier, theme: '', groups: [[1]], portals: [] }, 1),
});
