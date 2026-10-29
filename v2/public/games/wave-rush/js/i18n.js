// @ts-check
// The game's own texts: the frame cannot use the app's i18n, so GameHost passes the
// app's language as ?lang=pl|en (Polish when missing or unknown).

const TEXTS = {
  pl: {
    title: 'Wave Rush',
    tagline: 'Przytrzymaj — w górę. Puść — w dół.',
    play: 'Graj',
    practice: 'Praktyka',
    skins: 'Skórki',
    done: 'Gotowe',
    menu: 'Menu',
    best: 'Rekord',
    bestNone: 'jeszcze brak',
    bestValue: 'sektor {sector}, sekcja {section} · {percent}%',
    attempts: 'Próby',
    attempt: 'Próba {n}',
    checkpoints: 'Punkty kontrolne w praktyce',
    cpSector: 'Co sektor',
    cpSection: 'Co sekcję',
    hint: 'Przytrzymaj ekran, przycisk myszy albo spację (lub ↑): fala leci w górę. Puść: w dół.',
    ready: 'Przytrzymaj, żeby ruszyć',
    sector1: 'Łatwy',
    sector2: 'Normalny',
    sector3: 'Trudny',
    sectorLabel: 'Sektor {n}: {name}',
    sectionLabel: 'sekcja {section}/{count}',
    practiceBadge: 'Praktyka',
    crashed: 'Rozbity!',
    result: 'Sektor {sector}, sekcja {section} · {percent}% trasy',
    newBest: 'Nowy rekord!',
    tapRestart: 'Stuknij, żeby zacząć od nowa',
    tapRespawn: 'Stuknij, żeby wrócić do punktu kontrolnego',
    finishedTitle: 'Ciąg dalszy wkrótce',
    finishedBody: 'To wszystkie gotowe sektory. Trudniejszy, Insane i Demon są w drodze.',
    again: 'Jeszcze raz',
    paused: 'Pauza',
    resume: 'Stuknij, żeby grać dalej',
    skinsTitle: 'Skórki',
    skinsHint: 'Wybierz wygląd fali i kolor śladu.',
    locked: 'Zablokowana: ukończ cały sektor Demon',
    selected: 'Wybrana',
    portrait: 'Wygodniej w poziomie, ale można grać i tak.',
    gravityFlip: 'Grawitacja odwrócona',
    gravityBack: 'Grawitacja z powrotem',
    canvas: 'Plansza gry: fala leci przez korytarz z przeszkodami',
  },
  en: {
    title: 'Wave Rush',
    tagline: 'Hold to go up. Let go to go down.',
    play: 'Play',
    practice: 'Practice',
    skins: 'Skins',
    done: 'Done',
    menu: 'Menu',
    best: 'Best',
    bestNone: 'none yet',
    bestValue: 'sector {sector}, section {section} · {percent}%',
    attempts: 'Attempts',
    attempt: 'Attempt {n}',
    checkpoints: 'Practice checkpoints',
    cpSector: 'Every sector',
    cpSection: 'Every section',
    hint: 'Hold the screen, the mouse button or Space (or ↑): the wave flies up. Let go: down.',
    ready: 'Hold to start',
    sector1: 'Easy',
    sector2: 'Normal',
    sector3: 'Hard',
    sectorLabel: 'Sector {n}: {name}',
    sectionLabel: 'section {section}/{count}',
    practiceBadge: 'Practice',
    crashed: 'Crashed!',
    result: 'Sector {sector}, section {section} · {percent}% of the run',
    newBest: 'New best!',
    tapRestart: 'Tap to start again',
    tapRespawn: 'Tap to go back to the checkpoint',
    finishedTitle: 'To be continued',
    finishedBody: 'That is every sector built so far. Harder, Insane and Demon are on the way.',
    again: 'Play again',
    paused: 'Paused',
    resume: 'Tap to keep playing',
    skinsTitle: 'Skins',
    skinsHint: 'Pick the wave’s look and its trail colour.',
    locked: 'Locked: finish the whole Demon sector',
    selected: 'Selected',
    portrait: 'Better sideways, but it works this way too.',
    gravityFlip: 'Gravity flipped',
    gravityBack: 'Gravity back',
    canvas: 'Game board: a wave flies through a corridor of obstacles',
  },
};

/** @typedef {'pl' | 'en'} Lang */
/** @typedef {keyof typeof TEXTS.pl} TextKey */

/** @param {string} search @returns {Lang} */
export function pickLang(search) {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'pl';
}

/**
 * @param {Lang} lang
 * @returns {(key: TextKey, values?: Record<string, string | number>) => string}
 */
export function translator(lang) {
  const texts = TEXTS[lang];
  return (key, values) => texts[key].replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
}

/** Every key of both languages (for the tests). */
export const TEXT_KEYS = /** @type {TextKey[]} */ (Object.keys(TEXTS.pl));
/** @param {Lang} lang */
export const textsOf = (lang) => TEXTS[lang];
