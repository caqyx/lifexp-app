// The SVG filters behind liquid glass (iOS theme, refract mode), in one hidden <svg>
// mounted once next to the app. Each filter: the element's displacement map
// (feImage) bends the backdrop near the rim; with a chromatic edge, red bends a bit
// more and blue a bit less, as in a real lens. CSS adds blur, saturation and the
// specular rim after it (glass.css): backdrop-filter: url(#id) blur() saturate().
import { glassFilters, glassModeSignal, type GlassFilter } from './registry';
import './glass.css';

const ONLY_RED = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0';
const ONLY_GREEN = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0';
const ONLY_BLUE = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';

function GlassFilterDef({ filter }: { filter: GlassFilter }) {
  const { id, width, height, map, scale, chroma } = filter;
  const displace = (s: number, result: string) => (
    <feDisplacementMap in="SourceGraphic" in2="map" scale={s} xChannelSelector="R" yChannelSelector="G" result={result} />
  );
  return (
    <filter
      id={id}
      x="0"
      y="0"
      width={width}
      height={height}
      filterUnits="userSpaceOnUse"
      primitiveUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB"
    >
      <feImage href={map} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="map" />
      {chroma > 0 ? (
        <>
          {displace(scale + chroma, 'red')}
          <feColorMatrix in="red" type="matrix" values={ONLY_RED} result="r" />
          {displace(scale, 'green')}
          <feColorMatrix in="green" type="matrix" values={ONLY_GREEN} result="g" />
          {displace(Math.max(0, scale - chroma), 'blue')}
          <feColorMatrix in="blue" type="matrix" values={ONLY_BLUE} result="b" />
          <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
        </>
      ) : (
        displace(scale, 'lens')
      )}
    </filter>
  );
}

export function GlassFilters() {
  if (glassModeSignal.value !== 'refract') return null;
  return (
    <svg class="ui-glass-defs" aria-hidden="true" focusable="false" width="0" height="0" data-testid="glass-filters">
      <defs>
        {glassFilters.value.map((filter) => (
          <GlassFilterDef key={filter.id} filter={filter} />
        ))}
      </defs>
    </svg>
  );
}
