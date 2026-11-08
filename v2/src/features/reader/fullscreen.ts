// The reader's full screen (row r-4): only the book and its arrows. The browser's own
// full screen (Fullscreen API) is asked for too where there is one; where it is
// missing or refused (iOS Safari, some installed apps) the reader still hides its
// own controls. The choice lasts for the browser session: another book opened in the
// same tab opens full screen again, a new visit starts with the controls shown.
const KEY = 'lifexp-v2-reader-fullscreen';

export function fullscreenRemembered(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberFullscreen(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice simply is not remembered.
  }
}

/** Asks for the system full screen; resolves to whether it was granted. */
export async function requestSystemFullscreen(): Promise<boolean> {
  const el = document.documentElement;
  if (typeof el.requestFullscreen !== 'function' || document.fullscreenElement) return Boolean(document.fullscreenElement);
  try {
    await el.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    return false;
  }
}

export function leaveSystemFullscreen(): void {
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') void document.exitFullscreen().catch(() => undefined);
}
