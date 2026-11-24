// @ts-check
// Świetlik (Glimmer): the game's own texts (GameHost passes ?lang=pl|en) and the test
// switches (?test=1 with seed=, hp=, start=, speed= — for the browser tests only).

const TEXTS = {
  pl: {
    title: 'Świetlik',
    intro: 'Jesteś małym świetlikiem na nocnej polanie. Unikaj iskier, promieni i ścian — tak długo, jak dasz radę.',
    play: 'Graj',
    best: 'Rekord: {score} pkt · {time}',
    noBest: 'Jeszcze bez rekordu',
    effects: 'Efekty',
    fxFull: 'Pełne',
    fxCalm: 'Mniej',
    controlsTouch: 'Telefon: przesuwaj palcem w dowolnym miejscu — świetlik idzie za ruchem palca, nie pod nim. Przycisk „Skupienie” zwalnia i pokazuje trafialny punkt.',
    controlsKeys: 'Komputer: strzałki lub WASD, Shift — skupienie, Spacja lub P — pauza.',
    score: 'Punkty',
    time: 'Czas',
    lives: 'Życia',
    focus: 'Skupienie',
    pause: 'Pauza',
    paused: 'Pauza',
    resume: 'Wznów',
    restart: 'Od nowa',
    menu: 'Menu',
    over: 'Koniec!',
    overScore: '{score} pkt',
    overDetail: 'Czas {time} · otarcia: {grazes}',
    newBest: 'Nowy rekord!',
    again: 'Jeszcze raz',
    canvas: 'Polana: świetlik i przeszkody',
    grazeHint: 'Otarcie się o iskrę bez trafienia daje dodatkowe punkty.',
    zoneHint: 'Pomarańczowa linia to droga komety. Czerwony krąg: zostań w środku, zanim się zamknie.',
  },
  en: {
    title: 'Glimmer',
    intro: 'You are a little glimmer on a night meadow. Dodge the sparks, beams and walls — as long as you can.',
    play: 'Play',
    best: 'Best: {score} pts · {time}',
    noBest: 'No best yet',
    effects: 'Effects',
    fxFull: 'Full',
    fxCalm: 'Fewer',
    controlsTouch: 'Phone: drag anywhere — the glimmer follows your finger’s movement, not your finger. “Focus” slows it down and shows the spot that can be hit.',
    controlsKeys: 'Computer: arrows or WASD, Shift — focus, Space or P — pause.',
    score: 'Score',
    time: 'Time',
    lives: 'Lives',
    focus: 'Focus',
    pause: 'Pause',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    menu: 'Menu',
    over: 'Game over!',
    overScore: '{score} pts',
    overDetail: 'Time {time} · grazes: {grazes}',
    newBest: 'New best!',
    again: 'Play again',
    canvas: 'The meadow: the glimmer and the obstacles',
    grazeHint: 'Brushing past a spark without being hit gives extra points.',
    zoneHint: 'An orange line is a comet’s path. A red circle: stay inside before it closes.',
  },
};

/** @typedef {keyof typeof TEXTS.pl} TextKey */
/** @typedef {(key: TextKey, values?: Record<string, string | number>) => string} Translate */

export const TEXT_KEYS = { pl: Object.keys(TEXTS.pl), en: Object.keys(TEXTS.en) };

/** @param {string} search @returns {'pl' | 'en'} */
export function pickLang(search) {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'pl';
}

/** @param {'pl' | 'en'} lang @returns {Translate} */
export function translator(lang) {
  const texts = TEXTS[lang];
  return (key, values = {}) => texts[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/** "1:05" from seconds. @param {number} seconds */
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** @param {URLSearchParams} params @param {string} name @param {number} min @param {number} max */
function intParam(params, name, min, max) {
  const raw = params.get(name);
  if (raw === null || !/^\d{1,6}$/.test(raw)) return null;
  return Math.min(max, Math.max(min, Number(raw)));
}

/**
 * The test switches, all only with ?test=1: seed=<n> (the run's seed), hp=<n> (lives),
 * start=<s> (the clock starts at s seconds: the harder minutes at once, for the perf
 * check), speed=<n> (the clock runs n times faster), pattern=<id> (only that pattern comes). With ?test=1 the stage carries its
 * state in data-* for the tests to read.
 * @param {string} search
 */
export function testParams(search) {
  const params = new URLSearchParams(search);
  const on = params.get('test') === '1';
  return {
    on,
    seed: on ? intParam(params, 'seed', 1, 999999) : null,
    hp: on ? intParam(params, 'hp', 1, 99) : null,
    start: on ? intParam(params, 'start', 0, 3600) : null,
    speed: on ? intParam(params, 'speed', 1, 20) : null,
    pattern: on && /^[a-z]{3,12}$/.test(params.get('pattern') ?? '') ? params.get('pattern') : null,
  };
}
