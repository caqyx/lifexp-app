// The SVG filters behind liquid glass (iOS theme, refract mode), in one hidden <svg>
// mounted once next to the app. Their content comes from lens.ts, which loads only in
// refract mode; until then (and in every other mode) this renders nothing.
import { glassFilters, glassModeSignal, lensModule } from './registry';

export function GlassFilters() {
  const lens = lensModule.value;
  if (glassModeSignal.value !== 'refract' || !lens) return null;
  return (
    <svg class="ui-glass-defs" aria-hidden="true" focusable="false" width="0" height="0" data-testid="glass-filters">
      <defs>{glassFilters.value.map((f) => lens.filterDef(f.spec, f.map))}</defs>
    </svg>
  );
}
