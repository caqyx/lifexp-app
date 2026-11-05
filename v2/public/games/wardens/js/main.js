// @ts-check
// Strażnicy Doliny (Valley Wardens), LifeXP's own tower defense (docs/v2/PLAN.md 9.1,
// stage td-1). This module wires the pure parts — the rules (sim.js), the waves, the
// layout and the records — to the page: the three screens, the HUD, the build and
// tower panels, the pads as real buttons over the canvas, the clock and the keys.
//
// It runs in GameHost's frame on LifeXP's origin, with a CSP that allows only this
// origin. It touches only its own localStorage keys (lifexp-wardens-*).
// Query: ?lang=pl|en (from GameHost); ?test=1 with speed=, waves=, lives=, gold= for
// the browser test only (js/i18n.js).

import { DT, ENEMIES, LEVELS, MAX_STEPS_PER_FRAME, PRIORITIES, TOWERS, TOWER_TYPES } from './config.js';
import { MAPS } from './maps.js';
import { computeLayout, toScreen } from './layout.js';
import { describeWave } from './waves.js';
import {
  buildCost,
  buildTower,
  callWave,
  createGame,
  earlyBonus,
  sellTower,
  sellValue,
  setPaused,
  setPriority,
  starsFor,
  updateGame,
  upgradeCost,
  upgradeTower,
} from './sim.js';
import { clearEffects, createEffects, updateEffects } from './effects.js';
import { consumeEvents, createRenderer, drawEnemy, drawTower, renderFrame, resetRenderer, resizeRenderer } from './render.js';
import { isUnlocked, readProgress, readSettings, saveEndless, saveSettings, saveWin } from './records.js';
import { pickLang, testParams, translator } from './i18n.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {import('./config.js').TowerType} TowerType */
/** @typedef {import('./config.js').Priority} Priority */
/** @typedef {import('./i18n.js').TextKey} TextKey */
/** @typedef {import('./layout.js').Layout} Layout */

/** A frame longer than this (a stalled tab) counts as this much. */
const MAX_FRAME = 0.25;
/** How long the board stays in view after the last enemy before the end screen (ms). */
const END_DELAY = 900;
/** Lives at or under this are shown as a warning. */
const LOW_LIVES = 5;

// ── Setup ────────────────────────────────────────────────────────────────────

/** @template {HTMLElement} T @param {string} id @returns {T} */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return /** @type {T} */ (el);
}

function findElements() {
  return {
    app: byId('app'),
    mapList: byId('map-list'),
    playMap: byId('play-map'),
    gold: byId('gold'),
    lives: byId('lives'),
    hudLives: byId('hud-lives'),
    wave: byId('wave'),
    pause: byId('pause'),
    speed: byId('speed'),
    speedText: byId('speed-text'),
    stage: byId('stage'),
    board: /** @type {HTMLCanvasElement} */ (byId('board')),
    pads: byId('pads'),
    hint: byId('hint'),
    banner: byId('banner'),
    waveStatus: byId('wave-status'),
    wavePreview: byId('wave-preview'),
    callWave: /** @type {HTMLButtonElement} */ (byId('call-wave')),
    panel: byId('panel'),
    panelTitle: byId('panel-title'),
    panelClose: byId('panel-close'),
    buildMenu: byId('build-menu'),
    towerOptions: byId('tower-options'),
    optionRole: byId('option-role'),
    optionStats: byId('option-stats'),
    build: /** @type {HTMLButtonElement} */ (byId('build')),
    towerMenu: byId('tower-menu'),
    towerLevel: byId('tower-level'),
    towerStats: byId('tower-stats'),
    priority: byId('priority'),
    upgrade: /** @type {HTMLButtonElement} */ (byId('upgrade')),
    sell: /** @type {HTMLButtonElement} */ (byId('sell')),
    pauseOverlay: byId('pause-overlay'),
    resume: byId('resume'),
    restart: byId('restart'),
    toMaps: byId('to-maps'),
    endTitle: byId('end-title'),
    endMap: byId('end-map'),
    endStars: byId('end-stars'),
    endBadge: byId('end-badge'),
    endLives: byId('end-lives'),
    endWaves: byId('end-waves'),
    endKills: byId('end-kills'),
    nextMap: byId('next-map'),
    again: byId('again'),
    endMaps: byId('end-maps'),
  };
}

function storage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const lang = pickLang(location.search);
const t = translator(lang);
const test = testParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dom = findElements();
const renderer = createRenderer(dom.board);
const fx = createEffects();
const progress = readProgress(storage());
const settings = readSettings(storage());

const ui = {
  mapIndex: 0,
  endless: false,
  game: /** @type {Game | null} */ (null),
  layout: /** @type {Layout | null} */ (null),
  selectedPad: -1,
  previewType: /** @type {TowerType | null} */ (null),
  padButtons: /** @type {HTMLButtonElement[]} */ ([]),
  optionButtons: /** @type {Map<TowerType, HTMLButtonElement>} */ (new Map()),
  ended: false,
  endTimer: 0,
  bannerTimer: 0,
  /** What the HUD shows now, so text is only written when it changes. */
  shown: { gold: -1, lives: -1, wave: '', status: '', call: '', previewWave: -1, phase: '' },
};
const clock = { last: /** @type {number | null} */ (null), acc: 0, frame: 0, time: 0 };
const view = { selectedPad: -1, previewType: /** @type {TowerType | null} */ (null), clock: 0, reduced: false };
const pt = { x: 0, y: 0 };

/** @param {string} key */
const tk = (key) => t(/** @type {TextKey} */ (key));

function applyTexts() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = tk(el.getAttribute('data-t') ?? '');
}

// ── Screens ──────────────────────────────────────────────────────────────────

/** @param {'start' | 'play' | 'end'} screen @param {HTMLElement | null} [focus] */
function showScreen(screen, focus = null) {
  dom.app.dataset.screen = screen;
  focus?.focus({ preventScroll: true });
}

/** "★★☆" for the eye (hidden from readers) and "Gwiazdki: 2/3" in words. @param {number} n */
function createStars(n) {
  const wrap = document.createElement('span');
  wrap.className = 'stars';
  const glyphs = document.createElement('span');
  glyphs.className = 'stars__glyphs';
  glyphs.setAttribute('aria-hidden', 'true');
  glyphs.textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
  const words = document.createElement('span');
  words.textContent = t('stars', { n });
  wrap.append(glyphs, ' ', words);
  return wrap;
}

/**
 * @param {string} name @param {string} desc @param {string} badge @param {(HTMLElement | string)[]} meta
 * @param {boolean} locked @param {() => void} onPick
 */
function createMapButton(name, desc, badge, meta, locked, onPick) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-card';
  button.disabled = locked;
  const badgeEl = document.createElement('span');
  badgeEl.className = 'map-card__badge';
  badgeEl.setAttribute('aria-hidden', 'true');
  badgeEl.textContent = badge;
  const text = document.createElement('span');
  text.className = 'map-card__text';
  const nameEl = document.createElement('span');
  nameEl.className = 'map-card__name';
  nameEl.textContent = name;
  const descEl = document.createElement('span');
  descEl.className = 'map-card__desc';
  descEl.textContent = desc;
  const metaEl = document.createElement('span');
  metaEl.className = 'map-card__meta';
  metaEl.append(...meta);
  text.append(nameEl, descEl, metaEl);
  button.append(badgeEl, text);
  button.addEventListener('click', onPick);
  item.append(button);
  return item;
}

function renderMapList() {
  const items = MAPS.map((map, i) => {
    const locked = !isUnlocked(progress, MAPS, i);
    const meta = locked
      ? [t('locked', { map: tk(`map.${MAPS[i - 1]?.id}`) })]
      : [t('waves', { n: map.waves }), ' · ', createStars(progress.stars[map.id] ?? 0)];
    return createMapButton(tk(`map.${map.id}`), tk(`mapDesc.${map.id}`), String(i + 1), meta, locked, () => startGame(i, false));
  });
  const last = MAPS.length - 1;
  const endlessLocked = (progress.stars[MAPS[last]?.id ?? ''] ?? 0) === 0;
  const endlessMeta = endlessLocked
    ? [t('locked', { map: tk(`map.${MAPS[last]?.id}`) })]
    : [progress.endlessBest > 0 ? t('bestWave', { n: progress.endlessBest }) : t('noBest')];
  items.push(createMapButton(t('endless'), t('endlessDesc'), '∞', endlessMeta, endlessLocked, () => startGame(last, true)));
  dom.mapList.replaceChildren(...items);
}

// ── A game ───────────────────────────────────────────────────────────────────

/** @param {number} mapIndex @param {boolean} endless */
function startGame(mapIndex, endless) {
  const map = MAPS[mapIndex];
  if (!map) return;
  ui.mapIndex = mapIndex;
  ui.endless = endless;
  ui.game = createGame(map, {
    endless,
    waves: test.waves ?? undefined,
    lives: test.lives ?? undefined,
    gold: test.gold ?? undefined,
  });
  ui.ended = false;
  window.clearTimeout(ui.endTimer);
  ui.shown = { gold: -1, lives: -1, wave: '', status: '', call: '', previewWave: -1, phase: '' };
  clearEffects(fx);
  resetRenderer(renderer, ui.game);
  dom.playMap.textContent = endless ? `${tk(`map.${map.id}`)} · ${t('endless')}` : tk(`map.${map.id}`);
  dom.app.dataset.map = map.id;
  dom.hint.hidden = false;
  createPadButtons(ui.game);
  closePanel(false);
  showPause(false);
  showScreen('play', dom.callWave);
  handleResize();
  updateHud(ui.game);
}

/** One real button per build pad, over the canvas (touch, keyboard and readers). @param {Game} game */
function createPadButtons(game) {
  ui.padButtons = game.pads.map((_, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pad';
    button.dataset.pad = String(i);
    button.addEventListener('click', () => handlePadTap(i));
    return button;
  });
  dom.pads.replaceChildren(...ui.padButtons);
  renderPadLabels(game);
}

/** @param {Game} game */
function renderPadLabels(game) {
  ui.padButtons.forEach((button, i) => {
    const tower = game.towers[i];
    button.setAttribute(
      'aria-label',
      tower ? `${t('towerAt', { name: tk(`tower.${tower.type}`), level: tower.level })} · ${t('pad', { n: i + 1 })}` : t('pad', { n: i + 1 }),
    );
    button.dataset.tower = tower ? tower.type : '';
    button.setAttribute('aria-pressed', String(ui.selectedPad === i));
  });
}

function handleResize() {
  const game = ui.game;
  if (!game || dom.app.dataset.screen !== 'play') return;
  const box = dom.stage.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const layout = computeLayout(box.width, box.height);
  ui.layout = layout;
  dom.app.dataset.rotated = String(layout.rotated);
  resizeRenderer(renderer, layout, Math.min(2, window.devicePixelRatio || 1), game);
  positionPads(game, layout);
  renderBoard();
}

/** @param {Game} game @param {Layout} layout */
function positionPads(game, layout) {
  const size = layout.tile;
  game.pads.forEach((pad, i) => {
    const button = ui.padButtons[i];
    if (!button) return;
    toScreen(layout, pad.x, pad.y, pt);
    button.style.left = `${pt.x - size / 2}px`;
    button.style.top = `${pt.y - size / 2}px`;
    button.style.width = `${size}px`;
    button.style.height = `${size}px`;
  });
}

// ── The panel: build on a pad, or upgrade / sell / aim a tower ───────────────

/** @param {number} pad */
function handlePadTap(pad) {
  const game = ui.game;
  if (!game || game.phase === 'won' || game.phase === 'lost') return;
  if (ui.selectedPad === pad) {
    closePanel(true);
    return;
  }
  ui.selectedPad = pad;
  ui.previewType = null;
  openPanel();
}

function openPanel() {
  const game = ui.game;
  if (!game) return;
  dom.panel.hidden = false;
  placePanel(game);
  renderPanel(game);
  renderPadLabels(game);
  const first = game.towers[ui.selectedPad] ? dom.upgrade : dom.towerOptions.querySelector('button');
  /** @type {HTMLElement | null} */ (first)?.focus({ preventScroll: true });
}

/** @param {boolean} refocus */
function closePanel(refocus) {
  const pad = ui.selectedPad;
  ui.selectedPad = -1;
  ui.previewType = null;
  dom.panel.hidden = true;
  if (ui.game) renderPadLabels(ui.game);
  if (refocus) ui.padButtons[pad]?.focus({ preventScroll: true });
}

/** Held upright, the sheet opens on the half of the board away from the pad. @param {Game} game */
function placePanel(game) {
  const pad = game.pads[ui.selectedPad];
  if (!pad || !ui.layout) return;
  toScreen(ui.layout, pad.x, pad.y, pt);
  dom.panel.dataset.side = pt.y > ui.layout.height / 2 ? 'top' : 'bottom';
}

/** @param {Game} game */
function renderPanel(game) {
  const tower = game.towers[ui.selectedPad];
  dom.buildMenu.hidden = Boolean(tower);
  dom.towerMenu.hidden = !tower;
  if (tower) renderTowerMenu(game, tower);
  else renderBuildMenu(game);
}

/** The five tower choices, each with its icon, name and price. */
function createTowerOptions() {
  for (const type of TOWER_TYPES) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.setAttribute('role', 'radio');
    button.dataset.type = type;
    const icon = document.createElement('canvas');
    icon.className = 'option__icon';
    icon.setAttribute('aria-hidden', 'true');
    drawIcon(icon, 44, (ctx, s) => drawTower(ctx, type, 1, s / 2, s / 2, s * 0.95, -Math.PI / 2, 0, 0, 1));
    const name = document.createElement('span');
    name.className = 'option__name';
    name.textContent = tk(`tower.${type}`);
    const cost = document.createElement('span');
    cost.className = 'option__cost numeric';
    button.append(icon, name, cost);
    button.addEventListener('click', () => handleOptionPick(type));
    item.append(button);
    dom.towerOptions.append(item);
    ui.optionButtons.set(type, button);
  }
}

/** @param {HTMLCanvasElement} canvas @param {number} size @param {(ctx: CanvasRenderingContext2D, size: number) => void} draw */
function drawIcon(canvas, size, draw) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(ctx, size);
}

/** @param {TowerType} type */
function handleOptionPick(type) {
  if (!ui.game) return;
  ui.previewType = type;
  renderBuildMenu(ui.game);
  renderBoard();
}

/** @param {TowerType} type @param {number} level */
function statsText(type, level) {
  const def = TOWERS[type];
  const i = level - 1;
  const range = (def.range[i] ?? 0).toLocaleString(lang, { maximumFractionDigits: 1 });
  if (def.attack === 'aura') return `${t('statBuff', { n: Math.round((def.buff?.[i] ?? 0) * 100) })} · ${t('statRange', { n: range })}`;
  const parts = [t('statDamage', { n: def.damage[i] ?? 0 }), t('statRange', { n: range })];
  parts.push(t('statRate', { n: (1 / (def.interval[i] ?? 1)).toLocaleString(lang, { maximumFractionDigits: 1 }) }));
  if (def.slow) parts.push(t('statSlow', { n: Math.round((def.slow[i] ?? 0) * 100) }));
  return parts.join(' · ');
}

/** @param {TowerType} type */
function roleText(type) {
  return tk(`role.${type}`).replace('{p}', String(Math.round((TOWERS.banner.buff?.[0] ?? 0) * 100)));
}

/** @param {Game} game */
function renderBuildMenu(game) {
  dom.panelTitle.textContent = `${t('build')} · ${t('pad', { n: ui.selectedPad + 1 })}`;
  for (const [type, button] of ui.optionButtons) {
    const cost = buildCost(type);
    button.setAttribute('aria-checked', String(ui.previewType === type));
    button.classList.toggle('is-short', game.gold < cost);
    const costEl = button.querySelector('.option__cost');
    if (costEl) costEl.textContent = t('cost', { n: cost });
  }
  const type = ui.previewType;
  dom.optionRole.textContent = type ? roleText(type) : t('hint');
  dom.optionStats.textContent = type ? statsText(type, 1) : '';
  dom.build.hidden = !type;
  if (!type) return;
  const cost = buildCost(type);
  const short = cost - game.gold;
  dom.build.disabled = short > 0;
  dom.build.textContent = short > 0 ? `${tk(`tower.${type}`)} · ${t('missing', { n: short })}` : `${t('build')} · ${t('cost', { n: cost })}`;
}

/** @param {Game} game @param {import('./sim.js').Tower} tower */
function renderTowerMenu(game, tower) {
  dom.panelTitle.textContent = `${tk(`tower.${tower.type}`)} · ${t('pad', { n: ui.selectedPad + 1 })}`;
  dom.towerLevel.textContent = `${t('level', { n: tower.level })} · ${roleText(tower.type)}`;
  dom.towerStats.textContent = statsText(tower.type, tower.level) + (tower.buff > 0 ? ` · ${t('statBuff', { n: Math.round(tower.buff * 100) })}` : '');
  const aims = TOWERS[tower.type].attack !== 'pulse' && TOWERS[tower.type].attack !== 'aura';
  dom.priority.hidden = !aims;
  for (const el of dom.priority.querySelectorAll('[data-priority]')) {
    el.setAttribute('aria-checked', String(el.getAttribute('data-priority') === tower.priority));
  }
  const cost = upgradeCost(tower);
  if (cost === null || tower.level >= LEVELS) {
    dom.upgrade.disabled = true;
    dom.upgrade.textContent = t('maxed');
  } else {
    dom.upgrade.disabled = game.gold < cost;
    dom.upgrade.textContent = game.gold < cost ? `${t('upgrade', { n: cost })} · ${t('missing', { n: cost - game.gold })}` : t('upgrade', { n: cost });
  }
  dom.sell.textContent = t('sell', { n: sellValue(tower) });
}

function handleBuild() {
  const game = ui.game;
  if (!game || !ui.previewType) return;
  if (!buildTower(game, ui.selectedPad, ui.previewType)) return;
  dom.hint.hidden = true;
  // Built: the sheet closes so the board is free for the next tap (tap the tower to upgrade it).
  closePanel(true);
}

function handleUpgrade() {
  const game = ui.game;
  if (!game || !upgradeTower(game, ui.selectedPad)) return;
  renderPanel(game);
  renderPadLabels(game);
}

function handleSell() {
  const game = ui.game;
  if (!game || sellTower(game, ui.selectedPad) <= 0) return;
  renderPadLabels(game);
  closePanel(true);
}

/** @param {Priority} priority */
function handlePriority(priority) {
  const game = ui.game;
  if (!game) return;
  setPriority(game, ui.selectedPad, priority);
  renderPanel(game);
}

// ── HUD and waves ────────────────────────────────────────────────────────────

/** @param {Game} game */
function waveText(game) {
  if (game.endless) return String(Math.max(1, game.wave));
  return t('waveOf', { n: Math.max(1, game.wave), total: game.totalWaves });
}

/** @param {Game} game */
function remainingEnemies(game) {
  return game.aliveCount + (game.spawns.length - game.spawnCursor);
}

/** @param {Game} game */
function updateHud(game) {
  const s = ui.shown;
  if (s.gold !== game.gold) {
    s.gold = game.gold;
    dom.gold.textContent = String(game.gold);
    if (!dom.panel.hidden) renderPanel(game);
  }
  if (s.lives !== game.lives) {
    if (s.lives > game.lives) shakeLives();
    s.lives = game.lives;
    dom.lives.textContent = String(game.lives);
    dom.hudLives.classList.toggle('is-low', game.lives <= LOW_LIVES);
  }
  const wave = waveText(game);
  if (s.wave !== wave) dom.wave.textContent = s.wave = wave;
  const status = statusText(game);
  if (s.status !== status) dom.waveStatus.textContent = s.status = status;
  const call = callText(game);
  if (s.call !== call) dom.callWave.textContent = s.call = call;
  dom.callWave.disabled = game.phase !== 'build';
  const next = game.nextWave;
  const previewWave = game.phase === 'wave' ? -1 : next?.number ?? -1;
  if (s.previewWave !== previewWave) {
    s.previewWave = previewWave;
    renderPreview(game.phase === 'wave' ? null : next);
  }
  if (s.phase !== game.phase) {
    s.phase = game.phase;
    dom.app.dataset.phase = game.phase;
  }
  if (test.on) writeDebug(game);
}

/** @param {Game} game */
function statusText(game) {
  if (game.phase === 'wave') return t('inProgress', { n: game.wave, k: remainingEnemies(game) });
  if (game.phase === 'build' && game.countdown > 0) return t('autoIn', { s: Math.ceil(game.countdown) });
  return '';
}

/** @param {Game} game */
function callText(game) {
  const n = Math.min(game.wave + 1, game.totalWaves);
  const bonus = earlyBonus(game);
  if (game.phase === 'build' && bonus > 0) return t('callEarly', { n, gold: bonus });
  return t('startWave', { n: game.phase === 'wave' ? Math.min(game.wave + 1, game.totalWaves) : n });
}

/** The next wave's enemies: an icon, the count and the name of each type. @param {import('./waves.js').Wave | null} wave */
function renderPreview(wave) {
  if (!wave) {
    dom.wavePreview.replaceChildren();
    return;
  }
  const head = document.createElement('li');
  head.className = 'preview__head';
  head.textContent = wave.boss ? `${t('nextWave', { n: wave.number })} ${t('bossWave')}` : t('nextWave', { n: wave.number });
  const rows = describeWave(wave).map(({ type, count }) => {
    const item = document.createElement('li');
    item.className = 'preview__item';
    item.dataset.enemy = type;
    const icon = document.createElement('canvas');
    icon.className = 'preview__icon';
    icon.setAttribute('aria-hidden', 'true');
    drawIcon(icon, 22, (ctx, s) => drawEnemy(ctx, type, s / 2, s / 2 + (ENEMIES[type].flying ? 2 : 0), s * 1.25, 0, 0, 0, false));
    const text = document.createElement('span');
    const trait = ['runner', 'shellback', 'moth', 'splitter', 'colossus'].includes(type) ? ` (${tk(`trait.${type}`)})` : '';
    text.textContent = `${count}× ${tk(`enemy.${type}`)}${trait}`;
    item.append(icon, text);
    return item;
  });
  dom.wavePreview.replaceChildren(head, ...rows);
}

function handleCallWave() {
  const game = ui.game;
  if (!game) return;
  const bonus = callWave(game);
  if (bonus < 0) return;
  dom.hint.hidden = true;
  const boss = game.spawns.some((s) => s.type === 'colossus');
  showBanner(bonus > 0 ? `${t('wave')} ${game.wave} · +${bonus} ${t('gold').toLowerCase()}` : boss ? `${t('wave')} ${game.wave} · ${t('bossWave')}` : `${t('wave')} ${game.wave}`);
  updateHud(game);
}

/** @param {string} text */
function showBanner(text) {
  dom.banner.textContent = text;
  dom.banner.classList.remove('is-shown');
  void dom.banner.offsetWidth;
  dom.banner.classList.add('is-shown');
  window.clearTimeout(ui.bannerTimer);
  ui.bannerTimer = window.setTimeout(() => dom.banner.classList.remove('is-shown'), 1600);
}

function shakeLives() {
  if (reducedMotion.matches) return;
  dom.hudLives.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
    { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  );
}

/** @param {Game} game */
function writeDebug(game) {
  const d = dom.stage.dataset;
  d.phase = game.phase;
  d.wave = String(game.wave);
  d.cleared = String(game.cleared);
  d.gold = String(game.gold);
  d.lives = String(game.lives);
  d.enemies = String(remainingEnemies(game));
  d.towers = String(game.towers.filter(Boolean).length);
}

// ── Pause and speed ──────────────────────────────────────────────────────────

/** @param {boolean} paused */
function showPause(paused) {
  if (ui.game) setPaused(ui.game, paused);
  const on = ui.game?.paused === true;
  dom.pause.setAttribute('aria-pressed', String(on));
  dom.pauseOverlay.hidden = !on;
  if (on) dom.resume.focus({ preventScroll: true });
}

function toggleSpeed() {
  settings.speed = settings.speed === 2 ? 1 : 2;
  saveSettings(storage(), settings);
  renderSpeed();
}

function renderSpeed() {
  // "Tempo" is read out but not shown: held upright the bar has room for "2×" only.
  const label = document.createElement('span');
  label.className = 'visually-hidden';
  label.textContent = `${t('speedLabel')} `;
  dom.speedText.replaceChildren(label, t('speed', { n: settings.speed }));
  dom.speed.setAttribute('aria-pressed', String(settings.speed === 2));
}

// ── The end ──────────────────────────────────────────────────────────────────

/** @param {Game} game */
function checkEnd(game) {
  if (ui.ended || (game.phase !== 'won' && game.phase !== 'lost')) return;
  ui.ended = true;
  closePanel(false);
  const result = saveResult(game);
  ui.endTimer = window.setTimeout(() => showEnd(game, result), END_DELAY);
}

/** @param {Game} game @returns {{ stars: number, isNew: boolean, unlocked: string | null }} */
function saveResult(game) {
  const map = game.map;
  if (game.endless) return { stars: 0, isNew: saveEndless(storage(), progress, game.cleared), unlocked: null };
  if (game.phase !== 'won') return { stars: 0, isNew: false, unlocked: null };
  const stars = starsFor(game.lives, game.startLives);
  const wasLocked = !isUnlocked(progress, MAPS, ui.mapIndex + 1);
  const isNew = saveWin(storage(), progress, map.id, stars);
  const next = MAPS[ui.mapIndex + 1];
  return { stars, isNew, unlocked: wasLocked && next ? tk(`map.${next.id}`) : null };
}

/** @param {Game} game @param {{ stars: number, isNew: boolean, unlocked: string | null }} result */
function showEnd(game, result) {
  const won = game.phase === 'won';
  dom.endTitle.textContent = game.endless ? t('endlessOver', { n: game.wave }) : won ? t('won') : t('lost');
  dom.endMap.textContent = dom.playMap.textContent;
  dom.endStars.replaceChildren(...(won ? [createStars(result.stars)] : []));
  dom.endBadge.hidden = !result.isNew && !result.unlocked;
  dom.endBadge.textContent = result.unlocked ? `${result.isNew ? `${t('newBest')} ` : ''}${t('unlocked', { map: result.unlocked })}` : t('newBest');
  dom.endLives.textContent = t('livesLeft', { n: game.lives });
  dom.endWaves.textContent = t('wavesCleared', { n: game.cleared });
  dom.endKills.textContent = t('kills', { n: game.stats.kills });
  const hasNext = won && !game.endless && MAPS[ui.mapIndex + 1] !== undefined;
  dom.nextMap.hidden = !hasNext;
  dom.app.dataset.result = won ? 'won' : 'lost';
  renderMapList();
  showScreen('end', hasNext ? dom.nextMap : dom.again);
}

// ── The loop ─────────────────────────────────────────────────────────────────

function speedFactor() {
  return settings.speed * (test.speed ?? 1);
}

/** @param {number} now */
function loop(now) {
  window.requestAnimationFrame(loop);
  const game = ui.game;
  const elapsed = clock.last === null ? 0 : Math.min(MAX_FRAME, (now - clock.last) / 1000);
  clock.last = now;
  if (!game || dom.app.dataset.screen !== 'play') return;
  const running = !game.paused && game.phase !== 'won' && game.phase !== 'lost';
  if (running || game.phase === 'won' || game.phase === 'lost') stepGame(game, elapsed * speedFactor());
  clock.time += running ? elapsed : 0;
  renderBoard();
  updateHud(game);
  checkEnd(game);
}

/** @param {Game} game @param {number} seconds */
function stepGame(game, seconds) {
  clock.acc += seconds;
  let steps = 0;
  while (clock.acc >= DT && steps < MAX_STEPS_PER_FRAME * Math.max(1, test.speed ?? 1)) {
    updateGame(game, DT);
    clock.acc -= DT;
    steps += 1;
  }
  if (clock.acc >= DT) clock.acc = 0;
  updateEffects(fx, seconds);
}

function renderBoard() {
  const game = ui.game;
  if (!game || !ui.layout) return;
  view.reduced = reducedMotion.matches;
  view.selectedPad = ui.selectedPad;
  view.previewType = ui.previewType;
  view.clock = clock.time;
  consumeEvents(renderer, game, fx, view.reduced);
  renderFrame(renderer, game, fx, view);
}

// ── Input ────────────────────────────────────────────────────────────────────

/** @param {KeyboardEvent} event */
function handleKey(event) {
  if (dom.app.dataset.screen !== 'play' || !ui.game || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (!dom.panel.hidden) closePanel(true);
    else showPause(!ui.game.paused);
  } else if (key === ' ' && !(event.target instanceof HTMLButtonElement)) {
    showPause(!ui.game.paused);
  } else if (key === 'f') {
    toggleSpeed();
  } else if (key === 'n') {
    handleCallWave();
  } else return;
  event.preventDefault();
}

function bindControls() {
  dom.callWave.addEventListener('click', handleCallWave);
  dom.pause.addEventListener('click', () => showPause(!ui.game?.paused));
  dom.resume.addEventListener('click', () => showPause(false));
  dom.speed.addEventListener('click', toggleSpeed);
  dom.restart.addEventListener('click', () => startGame(ui.mapIndex, ui.endless));
  dom.toMaps.addEventListener('click', backToMaps);
  dom.endMaps.addEventListener('click', backToMaps);
  dom.again.addEventListener('click', () => startGame(ui.mapIndex, ui.endless));
  dom.nextMap.addEventListener('click', () => startGame(ui.mapIndex + 1, false));
  dom.panelClose.addEventListener('click', () => closePanel(true));
  dom.build.addEventListener('click', handleBuild);
  dom.upgrade.addEventListener('click', handleUpgrade);
  dom.sell.addEventListener('click', handleSell);
  for (const el of dom.priority.querySelectorAll('[data-priority]')) {
    const priority = /** @type {Priority} */ (el.getAttribute('data-priority'));
    if (PRIORITIES.includes(priority)) el.addEventListener('click', () => handlePriority(priority));
  }
  document.addEventListener('keydown', handleKey);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ui.game && dom.app.dataset.screen === 'play') showPause(true);
  });
  new ResizeObserver(handleResize).observe(dom.stage);
}

function backToMaps() {
  ui.game = null;
  window.clearTimeout(ui.endTimer);
  renderMapList();
  showScreen('start', /** @type {HTMLElement | null} */ (dom.mapList.querySelector('button:not(:disabled)')));
}

applyTexts();
createTowerOptions();
renderSpeed();
renderMapList();
bindControls();
window.requestAnimationFrame(loop);
