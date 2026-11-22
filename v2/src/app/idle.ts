// Work that can wait until the first screen is up (docs/v2/PERF.md): it runs when the
// browser has nothing else to do, so it never competes with the start.

/**
 * Runs `task` once the page has loaded, `afterMs` have passed and the browser is idle
 * (or `timeoutMs` later at the latest). The pause matters on a slow phone network: the
 * main thread is idle while the first screen's data is still on its way, and a download
 * started then would share the line with it.
 */
export function whenIdle(task: () => void, { afterMs = 0, timeoutMs = 4000 } = {}): void {
  const idle = () => {
    // Safari has no requestIdleCallback.
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => task(), { timeout: timeoutMs });
    else setTimeout(task, 1000);
  };
  const start = () => setTimeout(idle, afterMs);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}
