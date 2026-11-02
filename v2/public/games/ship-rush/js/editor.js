// @ts-check
// Ship Rush's level editor (docs/v2/PLAN.md 9.1, stages r-3 and r-4): the shared editor
// (../../_engine/editor/editor.js) with this game's palette and look.
import { runEditor } from '../../_engine/editor/editor.js';
import { FINALE, SECTORS } from './config.js';
import { PALETTE, TOOLS } from './palette.js';
import { themeOf } from './render/themes.js';
import { SECTION_LIBRARY } from './sections/index.js';

runEditor({
  palette: PALETTE,
  title: 'Ship Rush',
  prefix: 'lifexp-shiprush-',
  sectors: SECTORS,
  finale: FINALE,
  library: SECTION_LIBRARY,
  themeOf,
  tools: TOOLS,
});
