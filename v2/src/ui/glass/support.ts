// Which liquid glass this browser gets (iOS theme). Pure decision + one DOM probe.
//
// - 'refract': Chromium (Chrome, Edge, Samsung Internet, Android WebView) renders an
//   SVG filter in backdrop-filter: url(#…), so the rim bends what is behind it.
// - 'blur':   the same shape, tint and specular rim over a blurred backdrop, no lens.
//   Safari/iOS and Firefox parse url() in backdrop-filter but do not draw it, so the
//   engine is checked too, not only CSS.supports. Also low-end or measured-slow
//   Chromium devices.
// - 'solid':  "Reduce transparency" or "Increase contrast" is on: opaque surfaces.
// - 'off':    the theme has no glass.

export type GlassMode = 'refract' | 'blur' | 'solid' | 'off';

export interface GlassEnvironment {
  /** CSS.supports('backdrop-filter', 'url(#x)') */
  urlBackdrop: boolean;
  /** CSS.supports for a plain blur (prefixed or not). */
  blurBackdrop: boolean;
  /** The engine is Chromium (navigator.userAgentData lists a "Chromium" brand). */
  chromium: boolean;
  /** prefers-reduced-transparency: reduce, or prefers-contrast: more */
  reduceTransparency: boolean;
  /** Little memory or few cores (navigator.deviceMemory ≤ 2 GB, hardwareConcurrency < 4). */
  lowEnd: boolean;
  /** Measured: an idle page under ~45 fps (registry.ts probeFrames). */
  slowDevice: boolean;
}

export function glassMode(themeHasGlass: boolean, env: GlassEnvironment): GlassMode {
  if (!themeHasGlass) return 'off';
  if (env.reduceTransparency || !env.blurBackdrop) return 'solid';
  // The lens costs GPU time on every frame something moves behind it: weak or
  // measured-slow devices keep the same material over a plain blur.
  if (env.urlBackdrop && env.chromium && !env.lowEnd && !env.slowDevice) return 'refract';
  return 'blur';
}

interface Brand {
  brand: string;
}

/** Media queries that turn the glass solid; also watched for changes. */
export const SOLID_GLASS_QUERIES = ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)'] as const;

/** Reads the environment from this browser. */
export function probeGlass(): Omit<GlassEnvironment, 'slowDevice'> {
  const supports = (property: string, value: string) => {
    try {
      return typeof CSS !== 'undefined' && CSS.supports(property, value);
    } catch {
      return false;
    }
  };
  const nav = navigator as Navigator & { userAgentData?: { brands?: Brand[] }; deviceMemory?: number };
  const brands = nav.userAgentData?.brands ?? [];
  const cores = nav.hardwareConcurrency;
  return {
    urlBackdrop: supports('backdrop-filter', 'url(#ui-glass-probe)'),
    blurBackdrop: supports('backdrop-filter', 'blur(1px)') || supports('-webkit-backdrop-filter', 'blur(1px)'),
    chromium: brands.some((b) => b.brand === 'Chromium'),
    reduceTransparency: SOLID_GLASS_QUERIES.some((q) => typeof matchMedia === 'function' && matchMedia(q).matches),
    lowEnd: (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (cores !== undefined && cores > 0 && cores < 4),
  };
}
