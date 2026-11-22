// Accessibility guards over every module screen (docs/v2/QUALITY.md, q-ui-7): what
// axe found once must not come back. On a phone, each route has one h1 and a main
// landmark, headings that do not skip a level, a name on every control, 44 px touch
// targets (24 px where a timeline sizes a block by its minutes) and no sideways
// scroll; keyboard focus is always visible. Written as plain DOM checks, no axe in
// the repo.
const { db } = require('../support/emulator');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const ROUTES = [
  'today',
  'tasks',
  'calendar',
  'calendar/week',
  'calendar/day',
  'calendar/categories',
  'goals',
  'chores',
  'chores/defs',
  'money',
  'money/loans',
  'money/settings',
  'notes',
  'notes/new',
  'reader',
  'stats',
  'stats/history',
  'reports',
  'reports/updates',
  'settings',
  'settings/appearance',
  'settings/modules',
  'settings/activities',
  'settings/points',
  'settings/account',
  'parent',
];

function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A little of everything, so lists have rows: a task, an event with a time, a goal, a note. */
async function seed(uid) {
  const user = db.doc(`users/${uid}`);
  await user.set(
    {
      optInModules: ['calendar', 'reader'],
      goals: [{ id: 'g1', name: 'Rower', type: 'money', amount: 150, celebrated: false, saved: 20 }],
    },
    { merge: true },
  );
  await user.collection('todos').add({ text: 'Zadanie', dueDate: localDay(0), size: 'M', done: false, createdAt: new Date().toISOString(), penaltyApplied: false });
  await user.collection('calendarEvents').add({
    title: 'Trening', categoryId: '', extraImportance: 0, date: localDay(0), startTime: '17:00', endTime: '17:15',
    repeat: 'none', weekdays: [], repeatUntil: '', marks: {}, createdAt: new Date().toISOString(),
  });
  await user.collection('notes').add({ title: 'Pomysły', content: 'treść', icon: 'ti-bulb', color: '#ff6b6b', createdAt: new Date().toISOString(), archived: false });
  await user.collection('money').doc('balance').set({ current: 50 });
}

/**
 * Everything wrong with the current screen, as readable lines. With a modal layer open
 * the page under it is inert, so only its controls are checked (`structure: false`).
 */
function screenProblems(page, { structure = true } = {}) {
  return page.evaluate((withStructure) => {
    const problems = [];
    const visible = (el) => {
      if (el.closest('[inert], [aria-hidden="true"], .visually-hidden')) return false;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
    };
    const describe = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`;

    // Landmarks and headings.
    if (withStructure) {
      const h1 = [...document.querySelectorAll('h1')].filter(visible);
      if (h1.length !== 1) problems.push(`${h1.length} visible h1`);
      if (!document.querySelector('main')) problems.push('no main landmark');
      let last = 0;
      for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        if (!visible(h)) continue;
        const level = Number(h.tagName[1]);
        if (last && level > last + 1) problems.push(`heading jumps h${last} → h${level}: ${describe(h)}`);
        last = level;
      }
    }

    // Controls: a name, and a target big enough for a finger.
    const controls = document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [tabindex="0"]');
    for (const el of controls) {
      if (!visible(el)) continue;
      const labelled =
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') || '').split(' ').some((id) => document.getElementById(id)?.textContent.trim()) ||
        el.textContent.trim() ||
        (el.labels && el.labels.length > 0) ||
        el.getAttribute('title');
      if (!labelled) problems.push(`no name: ${describe(el)}`);
      // Radios and checkboxes are hit through their label; links in running text are exempt (WCAG 2.5.8).
      if (el.matches('input[type=radio], input[type=checkbox]') && el.closest('label')) continue;
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p')) continue;
      const r = el.getBoundingClientRect();
      const min = el.matches('.cal-block__button') ? 24 : 44;
      if (r.width < min - 0.5 || r.height < min - 0.5) problems.push(`target ${Math.round(r.width)}×${Math.round(r.height)}: ${describe(el)}`);
    }

    // Nothing scrolls sideways.
    const content = document.querySelector('.shell__content');
    if ((content && content.scrollWidth > content.clientWidth + 1) || document.documentElement.scrollWidth > innerWidth + 1) {
      problems.push('horizontal scroll');
    }
    return problems;
  }, structure);
}

test('every module screen: one h1, main, heading order, named controls, 44 px targets, no sideways scroll', async ({ page, account }) => {
  test.setTimeout(120000);
  await seed(account.uid);
  await openSignedIn(page, account, '#/today');
  const found = [];
  for (const route of ROUTES) {
    await page.evaluate((r) => {
      location.hash = `#/${r}`;
    }, route);
    await expect(page.locator('.shell__main')).toBeVisible();
    // Data in place, the screen settled: no loading placeholder left in the content.
    await expect(page.locator('.shell__main .ui-skeleton')).toHaveCount(0, { timeout: 15000 });
    await screenSettled(page);
    for (const problem of await screenProblems(page)) found.push(`#/${route}: ${problem}`);
  }
  expect(found).toEqual([]);
});

test('the open menu and the "+" sheet pass the same checks', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'open');
  expect(await screenProblems(page, { structure: false })).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'closed');
  await page.locator('.tabbar').getByRole('button', { name: 'Dodaj' }).click();
  await expect(page.getByRole('dialog', { name: 'Dodaj' })).toBeVisible();
  expect(await screenProblems(page, { structure: false })).toEqual([]);
});

test.describe('with a keyboard', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 860 } });

  test('focus is always visible: every stop on Today and in a form shows a ring', async ({ page, account }) => {
    await openSignedIn(page, account, '#/today');
    await screenSettled(page);
    const ringless = [];
    const check = async (where) => {
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // A field inside a frame (with a unit, e.g. "pkt") rings the frame instead.
        const s = getComputedStyle(el.closest('.ui-field__control') ?? el);
        const ring =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) ||
          (s.boxShadow && s.boxShadow !== 'none') ||
          // A visually hidden native control shows its ring on the drawn part (segments, switches).
          el.matches('.ui-segmented__input, .ui-check__input, .ui-switch__input');
        return ring ? null : `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`;
      });
      if (stop) ringless.push(`${where}: ${stop}`);
    };
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      await check('#/today');
    }
    await page.evaluate(() => {
      location.hash = '#/settings/points';
    });
    await expect(page.getByLabel('Limit na dzień')).toBeVisible();
    await page.getByLabel('Limit na dzień').focus();
    for (let i = 0; i < 6; i++) {
      await check('#/settings/points');
      await page.keyboard.press('Tab');
    }
    expect(ringless).toEqual([]);
  });
});
