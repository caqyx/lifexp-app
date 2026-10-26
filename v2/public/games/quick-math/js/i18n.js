// @ts-check
// Szybkie liczenie: the game's own texts and query (GameHost passes ?lang=pl|en; the
// frame cannot use the app's i18n). ?seed= and ?round= exist for the browser test only.

const TEXTS = {
  pl: {
    title: 'Szybkie liczenie',
    intro: 'Licz w pamięci, zanim skończy się czas.',
    mode: 'Tryb',
    timed: 'Na czas',
    practice: 'Trening',
    pickLevel: 'Wybierz poziom',
    'level.easy': 'Łatwy',
    'level.medium': 'Średni',
    'level.hard': 'Trudny',
    'levelDesc.easy': '+ i − do 20',
    'levelDesc.medium': '+ i − do 100, tabliczka mnożenia',
    'levelDesc.hard': 'Wszystkie działania, dzielenie, dwa kroki',
    best: 'Rekord',
    score: 'Punkty',
    combo: 'Seria',
    timeLeft: 'Pozostały czas',
    seconds: '{n} s',
    keypad: 'Klawiatura z cyframi',
    ok: 'OK',
    back: 'Usuń',
    minus: 'Minus',
    answer: 'Twoja odpowiedź',
    correct: 'Dobrze!',
    wrong: 'Poprawnie: {q} = {a}',
    penalty: '−{n} s',
    endPractice: 'Zakończ trening',
    timeUp: 'Koniec czasu!',
    practiceOver: 'Koniec treningu',
    accuracy: 'Trafność',
    perMinute: 'Na minutę',
    streak: 'Najdłuższa seria',
    newBest: 'Nowy rekord!',
    again: 'Jeszcze raz',
    change: 'Zmień poziom',
    records: 'Rekordy',
    keysHint: 'Na komputerze: cyfry, Enter i Backspace.',
    'op.+': 'plus',
    'op.-': 'minus',
    'op.*': 'razy',
    'op./': 'podzielić przez',
  },
  en: {
    title: 'Quick Math',
    intro: 'Count in your head before the time runs out.',
    mode: 'Mode',
    timed: 'Timed',
    practice: 'Practice',
    pickLevel: 'Pick a level',
    'level.easy': 'Easy',
    'level.medium': 'Medium',
    'level.hard': 'Hard',
    'levelDesc.easy': '+ and − up to 20',
    'levelDesc.medium': '+ and − up to 100, times tables',
    'levelDesc.hard': 'All four operations, two steps',
    best: 'Best',
    score: 'Points',
    combo: 'Streak',
    timeLeft: 'Time left',
    seconds: '{n} s',
    keypad: 'Number keypad',
    ok: 'OK',
    back: 'Delete',
    minus: 'Minus',
    answer: 'Your answer',
    correct: 'Correct!',
    wrong: 'Correct answer: {q} = {a}',
    penalty: '−{n} s',
    endPractice: 'End practice',
    timeUp: "Time's up!",
    practiceOver: 'Practice over',
    accuracy: 'Accuracy',
    perMinute: 'Per minute',
    streak: 'Longest streak',
    newBest: 'New best!',
    again: 'Play again',
    change: 'Change level',
    records: 'Best scores',
    keysHint: 'On a computer: digits, Enter and Backspace.',
    'op.+': 'plus',
    'op.-': 'minus',
    'op.*': 'times',
    'op./': 'divided by',
  },
};

/** @typedef {keyof typeof TEXTS.pl} TextKey */
/** @typedef {(key: TextKey, values?: Record<string, string | number>) => string} Translate */

/** @param {string} search @returns {'pl' | 'en'} */
export function pickLang(search) {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'pl';
}

/** @param {'pl' | 'en'} lang @returns {Translate} */
export function translator(lang) {
  const texts = TEXTS[lang];
  return (key, values = {}) => texts[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * The query's test switches: ?seed=<n> (repeatable questions, the answer on the page)
 * and, only together with it, ?round=<seconds> (a short round).
 * @param {string} search
 */
export function testParams(search) {
  const params = new URLSearchParams(search);
  const seedRaw = params.get('seed');
  const seed = seedRaw !== null && /^\d{1,9}$/.test(seedRaw) ? Number(seedRaw) : null;
  const roundRaw = params.get('round');
  const round = seed !== null && roundRaw !== null && /^\d{1,3}$/.test(roundRaw) ? Math.min(600, Math.max(3, Number(roundRaw))) : null;
  return { seed, round };
}
