// Pasek „Nowa wersja LifeXP (beta)” na dole app.html (docs/v2/PLAN.md 9.1, beta-1).
// Pokazuje go core.js każdemu zalogowanemu kontu po starcie aplikacji — bez listy
// dostępu, bez odczytu i zapisu w Firestore, bez analityki. „Wypróbuj” prowadzi do
// v2 (v2/ względem strony, więc działa też pod /lifexp-app/), „Nie teraz” chowa
// pasek na 7 dni (tylko localStorage tego urządzenia).
//
// Moduł nie importuje Firebase, więc testy (bez sieci) ładują go wprost.
// Układ: pasek siedzi NAD dolnym paskiem nawigacji i przesuwa w górę FAB-y oraz
// dolny odstęp .main o własną wysokość (zmienne CSS ustawiane niżej, style w app.html).

export const DISMISS_KEY = 'lifexp-beta-banner-dismissed-until';
export const DISMISS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const TEXT = {
  pl: { region: 'Nowa wersja LifeXP', message: 'Nowa wersja LifeXP (beta) jest gotowa do testów.', tryIt: 'Wypróbuj', later: 'Nie teraz' },
  en: { region: 'New LifeXP version', message: 'The new LifeXP (beta) is ready to test.', tryIt: 'Try it', later: 'Not now' },
};

function currentLang() {
  let lang = window.i18next && window.i18next.language;
  if (!lang) {
    try { lang = localStorage.getItem('lifexp-lang'); } catch { lang = null; }
  }
  return lang === 'pl' ? 'pl' : 'en';
}

function isDismissed(now = Date.now()) {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

function dismissFor7Days() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * DAY_MS));
  } catch { /* prywatne okno albo zablokowane dane — pasek zniknie tylko do odświeżenia */ }
}

let banner = null;
let observer = null;

// Wysokość paska i widocznego dolnego menu → zmienne CSS, z których korzystają
// .beta-banner (bottom), .main (padding-bottom) i .fab (bottom).
function syncLayout() {
  if (!banner) return;
  const nav = document.getElementById('bottom-nav');
  const navH = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
  const root = document.documentElement.style;
  root.setProperty('--beta-nav-h', `${navH}px`);
  root.setProperty('--beta-banner-h', `${banner.getBoundingClientRect().height}px`);
}

function applyText() {
  if (!banner) return;
  const t = TEXT[currentLang()];
  banner.setAttribute('aria-label', t.region);
  banner.querySelector('.beta-banner__text').textContent = t.message;
  banner.querySelector('.beta-banner__try').textContent = t.tryIt;
  banner.querySelector('.beta-banner__later').textContent = t.later;
  syncLayout();
}

function removeBanner() {
  if (!banner) return;
  observer?.disconnect();
  observer = null;
  window.removeEventListener('resize', syncLayout);
  window.i18next?.off?.('languageChanged', applyText);
  document.body.classList.remove('has-beta-banner');
  document.documentElement.style.removeProperty('--beta-banner-h');
  document.documentElement.style.removeProperty('--beta-nav-h');
  banner.remove();
  banner = null;
}

function button(className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

/** Pokazuje pasek, chyba że jest schowany „Nie teraz” albo to nie jest app.html. */
export function showBetaBanner() {
  if (banner || isDismissed()) return;
  // Tylko aplikacja (app.html ma .app-layout); parent/verify/index/fps nie.
  if (!document.querySelector('.app-layout')) return;

  banner = document.createElement('div');
  banner.className = 'beta-banner';
  banner.id = 'beta-banner';
  banner.setAttribute('role', 'region');

  const text = document.createElement('p');
  text.className = 'beta-banner__text';
  const actions = document.createElement('div');
  actions.className = 'beta-banner__actions';
  actions.append(
    button('beta-banner__later btn-secondary', () => { dismissFor7Days(); removeBanner(); }),
    button('beta-banner__try btn-primary', () => { window.location.assign(new URL('v2/', window.location.href).href); }),
  );
  banner.append(text, actions);
  document.body.append(banner);
  document.body.classList.add('has-beta-banner');

  applyText();
  window.i18next?.on?.('languageChanged', applyText);
  window.addEventListener('resize', syncLayout);
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(syncLayout);
    observer.observe(banner);
    const nav = document.getElementById('bottom-nav');
    if (nav) observer.observe(nav);
  }
}
