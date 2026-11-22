import '@fontsource-variable/manrope';
import '@/ui/tokens.css';
import '@/ui/base.css';
import '@/app/shell.css';
import { effect } from '@preact/signals';
import { render } from 'preact';
import { App } from '@/app/App';
import { startLanguageSync } from '@/app/language';
import { afterFirstScreen, registerServiceWorker, reloadOnStaleChunk, watchForNewBuild } from '@/app/pwa';
import { preloadRoute, preloadTabs } from '@/app/registry';
import { currentPath, startRouter } from '@/app/router';
import { startThemeSync } from '@/app/theme';
import { GlassFilters } from '@/ui/glass/GlassFilters';
import { initI18n, pickLanguage, V1_LANG_STORAGE_KEY } from '@/i18n';
import { account, session, startSession } from '@/stores/session';

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(V1_LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

// This device's language first; the profile's replaces it once it loads.
const languageReady = initI18n(pickLanguage(storedLanguage()));
startLanguageSync();
startThemeSync();
startRouter();
reloadOnStaleChunk();
void startSession();
// The first screen's code downloads while the profile loads, not after it (and not
// alongside Firebase, which the profile needs first); the tab bar's screens once the
// start is over, so the first tap on them does not wait for the network.
const stopPreload = effect(() => {
  if (session.value.status !== 'signedIn') return;
  preloadRoute(currentPath.peek());
  queueMicrotask(() => stopPreload());
});
afterFirstScreen(() => {
  const signedIn = account.peek();
  if (signedIn) preloadTabs(signedIn.profile);
});

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');
// Polish at once; English after its chunk (i18n), so the first screen is never in the wrong language.
void languageReady.then(() =>
  render(
    <>
      <App />
      <GlassFilters />
    </>,
    root,
  ),
);
registerServiceWorker();
watchForNewBuild();
