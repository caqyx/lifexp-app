// @ts-check
// The game's own texts: the frame cannot use the app's i18n, so GameHost passes the
// app's language as ?lang=pl|en (Polish when missing or unknown).

const TEXTS = {
  pl: {
    title: 'Flappy Bird',
    hint: 'Stuknij, kliknij albo naciśnij spację, by machnąć.',
    start: 'Stuknij, żeby zacząć',
    score: 'Wynik',
    best: 'Rekord',
    newBest: 'Nowy rekord!',
    over: 'Koniec gry',
    again: 'Jeszcze raz',
    paused: 'Pauza',
    resume: 'Stuknij, żeby grać dalej',
    canvas: 'Plansza gry: ptak leci między rurami',
  },
  en: {
    title: 'Flappy Bird',
    hint: 'Tap, click or press Space to flap.',
    start: 'Tap to start',
    score: 'Score',
    best: 'Best',
    newBest: 'New best!',
    over: 'Game over',
    again: 'Play again',
    paused: 'Paused',
    resume: 'Tap to keep playing',
    canvas: 'Game board: a bird flies between pipes',
  },
};

/** @typedef {keyof typeof TEXTS.pl} TextKey */

/** @param {string} search @returns {'pl' | 'en'} */
export function pickLang(search) {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'pl';
}

/** @param {'pl' | 'en'} lang @returns {(key: TextKey) => string} */
export function translator(lang) {
  const texts = TEXTS[lang];
  return (key) => texts[key];
}
