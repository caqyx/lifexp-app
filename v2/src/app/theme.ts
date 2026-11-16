// Applies the theme (stores/theme.ts) to <html> and the browser UI color. The same
// rules run once before first paint in index.html.
import { effect } from '@preact/signals';
import { FAMILY_GLASS } from '@/lib/theme';
import { resolvedTheme } from '@/stores/theme';
import { setThemeGlass } from '@/ui/glass/registry';

/** Keeps data-theme/data-mode/data-glass and <meta name="theme-color"> up to date. Returns a stop function. */
export function startThemeSync(root: HTMLElement = document.documentElement): () => void {
  return effect(() => {
    const { family, mode } = resolvedTheme.value;
    root.dataset.theme = family;
    root.dataset.mode = mode;
    setThemeGlass(FAMILY_GLASS[family], root);
    const background = getComputedStyle(root).getPropertyValue('--color-bg').trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  });
}
