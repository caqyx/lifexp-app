// Liquid glass, the refracting part (loaded on demand, only when the browser draws
// SVG filters in backdrop-filter and the theme is iOS): builds the displacement map
// of a filter bucket and describes its <filter>. Not in the start-up bundle
// (tools/bundle-budget.ts).
import type { VNode } from 'preact';
import type { GlassSpec } from './bucket';
import { displacementMap, mapStep } from './map';

/** PNG data URL of the map for this bucket (pure work + one canvas encode). */
export function encodeMap(spec: GlassSpec): string {
  const { shape } = spec;
  const step = mapStep(shape.width, shape.height);
  const { width, height, data } = displacementMap(shape, step);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

const ONLY_RED = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0';
const ONLY_GREEN = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0';
const ONLY_BLUE = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';

/**
 * One <filter> in the element's own box (objectBoundingBox): the map is stretched over
 * whatever element of the bucket uses it. In those units Chromium takes the
 * displacement scale as a share of the box WIDTH for both axes, so the px strength
 * is divided by the bucket width. With a chromatic edge, red bends a little more and
 * blue a little less (three passes, so only where it is worth it).
 */
export function filterDef(spec: GlassSpec, map: string): VNode {
  const fraction = (px: number) => Math.max(0, px) / spec.shape.width;
  const displace = (px: number, result: string) => (
    <feDisplacementMap in="SourceGraphic" in2="map" scale={fraction(px)} xChannelSelector="R" yChannelSelector="G" result={result} />
  );
  return (
    <filter
      key={spec.id}
      id={spec.id}
      x="0"
      y="0"
      width="1"
      height="1"
      filterUnits="objectBoundingBox"
      primitiveUnits="objectBoundingBox"
      color-interpolation-filters="sRGB"
    >
      <feImage href={map} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
      {spec.chroma > 0 ? (
        <>
          {displace(spec.scale + spec.chroma, 'red')}
          <feColorMatrix in="red" type="matrix" values={ONLY_RED} result="r" />
          {displace(spec.scale, 'green')}
          <feColorMatrix in="green" type="matrix" values={ONLY_GREEN} result="g" />
          {displace(spec.scale - spec.chroma, 'blue')}
          <feColorMatrix in="blue" type="matrix" values={ONLY_BLUE} result="b" />
          <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
        </>
      ) : (
        displace(spec.scale, 'lens')
      )}
    </filter>
  );
}
