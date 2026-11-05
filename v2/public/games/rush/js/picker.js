// @ts-check
// Rush's first screen (docs/v2/PLAN.md 9.1, stage rr-a): pick a mode — its vehicle in the
// player's skin, its name, what it is, how far the player got. A mode is its own page; it
// has a way back here. ?mode=<id> (an old link to a mode's game) goes straight to it.
import { MODES, modeById, modeHref, progressOf } from './modes.js';
import { pickLang, pickerTranslator } from './i18n.js';

const lang = pickLang(location.search);
const t = pickerTranslator(lang);

/** @returns {Storage | null} */
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const direct = modeById(new URLSearchParams(location.search).get('mode'));
if (direct) location.replace(modeHref(direct, location.search));
else render();

function render() {
  document.documentElement.lang = lang;
  const storage = deviceStorage();
  const lead = document.getElementById('picker-lead');
  if (lead) lead.textContent = t('lead');
  const list = document.getElementById('modes');
  if (!list) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  for (const mode of MODES) {
    const texts = mode.texts(lang);
    const name = texts('title');
    const p = progressOf(mode, storage);
    const progress = [p.best === null ? t('bestNone') : t('best', { percent: p.best })];
    progress.push(p.finale === 'done' ? t('finaleDone') : p.finale === 'open' ? (p.finaleBest === null ? t('finaleOpen') : t('finaleBest', { percent: p.finaleBest })) : t('finaleLocked'));

    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode';
    button.dataset.mode = mode.id;
    button.setAttribute('aria-label', `${t('open', { name })}. ${texts('tagline')} ${progress.join(' · ')}.`);
    const art = document.createElement('canvas');
    art.className = 'mode__art';
    art.width = 96 * ratio;
    art.height = 64 * ratio;
    art.setAttribute('aria-hidden', 'true');
    const ctx = art.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      const record = mode.records.readProgress(storage);
      mode.paint(ctx, mode.skin(mode.records.readSkin(storage), record));
    }
    const text = document.createElement('span');
    const title = document.createElement('span');
    title.className = 'mode__name';
    title.textContent = name;
    const desc = document.createElement('span');
    desc.className = 'mode__desc';
    desc.textContent = texts('tagline');
    const line = document.createElement('span');
    line.className = 'mode__progress';
    line.dataset.progress = mode.id;
    line.textContent = progress.join(' · ');
    text.append(title, desc, line);
    button.append(art, text);
    button.addEventListener('click', () => (location.href = modeHref(mode, location.search)));
    item.append(button);
    list.append(item);
  }
}
