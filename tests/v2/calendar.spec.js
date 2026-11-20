// Calendar (docs/v2/PLAN.md 9.1, row c-1) on the Firebase emulators, on a Pixel 7:
// an opt-in module (optInModules, v1's enabledModules untouched), entries with a
// category and importance, repetition with single days ticked or skipped (no points),
// the month, week and day views, categories, and the four themes.
const { devices } = require('@playwright/test');
const { createUser, db } = require('../support/emulator');
const { test, expect, appUrl, openSignedIn, screenSettled } = require('../support/v2');

const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
test.use({ ...pixel7 });

/** The device's calendar day, `offset` days from today (calendar entries use local days). */
function localDay(offset = 0, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday … Sunday of this week, as local day keys. */
function thisWeek() {
  const now = new Date();
  const monday = -((now.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => localDay(monday + i, now));
}

const eventsOf = (uid) => db.collection(`users/${uid}/calendarEvents`);
const categoriesOf = (uid) => db.collection(`users/${uid}/calendarCategories`);

function seedEvent(uid, patch) {
  return eventsOf(uid).add({
    title: 'Wydarzenie',
    categoryId: '',
    extraImportance: 0,
    date: localDay(0),
    startTime: '',
    endTime: '',
    repeat: 'none',
    weekdays: [],
    repeatUntil: '',
    marks: {},
    createdAt: new Date().toISOString(),
    ...patch,
  });
}

const calendarUser = (tag, profile = {}) => createUser({ tag, profile: { optInModules: ['calendar'], ...profile } });

function useTheme(page, family, mode) {
  return page.addInitScript(([f, m]) => localStorage.setItem('lifexp-v2-theme', JSON.stringify({ family: f, mode: m })), [family, mode]);
}

/** A toast is on screen; a tap dismisses it so the next one shows. */
async function seeToast(page, message) {
  const toast = page.getByText(message);
  await expect(toast).toBeVisible();
  await toast.click();
}

async function sheetSettled(sheet) {
  await expect(sheet).toBeVisible();
  await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
}

test('the calendar is off until turned on in Settings, and only optInModules records it', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  const tabbar = page.locator('.tabbar');
  const menu = page.getByRole('dialog', { name: 'Nawigacja' });
  await tabbar.getByRole('button', { name: 'Menu' }).click();
  await expect(menu.getByRole('link', { name: 'Zadania' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Kalendarz' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await tabbar.getByRole('button', { name: 'Dodaj' }).click();
  await expect(page.getByRole('dialog', { name: 'Dodaj' }).getByRole('button', { name: 'Wydarzenie' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // A link leads to Today while it is off.
  await page.goto(appUrl('#/calendar/week'));
  await expect(page).toHaveURL(/#\/today$/);

  await page.goto(appUrl('#/settings/modules'));
  const sw = page.getByRole('switch', { name: 'Kalendarz' });
  await expect(sw).not.toBeChecked();
  await sw.check();
  await expect(page.getByText('Moduł zaktualizowany.')).toBeVisible();
  await expect
    .poll(async () => {
      const { enabledModules, disabledModules, optInModules } = (await db.doc(`users/${account.uid}`).get()).data();
      return { enabledModules, disabledModules, optInModules };
    })
    .toEqual({
      enabledModules: ['chores', 'money', 'games', 'stats', 'notes', 'aichat'],
      disabledModules: [],
      optInModules: ['calendar'],
    });

  // In the menu next to Tasks and Goals.
  await tabbar.getByRole('button', { name: 'Menu' }).click();
  const links = await menu.getByRole('link').allTextContents();
  const at = links.findIndex((l) => l.includes('Kalendarz'));
  expect(links[at - 1]).toContain('Zadania');
  expect(links[at + 1]).toContain('Cele');
  await menu.getByRole('link', { name: 'Kalendarz' }).click();
  await expect(page).toHaveURL(/#\/calendar$/);
  await expect(page.getByRole('heading', { name: 'Kalendarz' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Widoki kalendarza' }).getByRole('link', { name: 'Miesiąc', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Spacer Mon/Wed/Fri 18:00 with a new category: the documents, the week, ticking one day gives no points', async ({ page }) => {
  const account = await calendarUser('calendar-weekly');
  const week = thisWeek();
  await openSignedIn(page, account, '#/calendar');
  await page.getByRole('button', { name: 'Nowe wydarzenie' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nowe wydarzenie' });
  await sheetSettled(sheet);

  // Nothing typed: the sheet says what is missing.
  await sheet.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await expect(sheet.getByText('Wpisz nazwę wydarzenia.')).toBeVisible();

  await sheet.getByLabel('Nazwa', { exact: true }).fill('Spacer');
  await sheet.getByRole('radio', { name: 'Nowa kategoria' }).check();
  await sheet.getByLabel('Nazwa kategorii').fill('Aktywność fizyczna');
  await sheet.getByRole('radio', { name: 'zielony' }).check();
  const base = sheet.getByRole('group', { name: 'Ważność kategorii' });
  await base.getByRole('button', { name: 'Więcej: Ważność kategorii' }).click();
  await expect(base.locator('output')).toHaveText('2 pkt');
  const extra = sheet.getByRole('group', { name: 'Dodatkowe punkty ważności' });
  for (let i = 0; i < 3; i += 1) await extra.getByRole('button', { name: 'Więcej: Dodatkowe punkty ważności' }).click();
  await expect(sheet.getByTestId('calendar-importance')).toHaveText('Ważność: 2 + 3 = 5 (Ważne).');

  await sheet.getByLabel('Dzień', { exact: true }).fill(week[0]);
  await sheet.getByRole('switch', { name: 'Cały dzień' }).uncheck();
  await sheet.getByLabel('Od', { exact: true }).fill('18:00');
  await sheet.getByLabel('Do (opcjonalnie)', { exact: true }).fill('17:00');
  await sheet.getByLabel('Powtarzanie').selectOption('weekly');
  await sheet.getByRole('button', { name: 'śr.' }).click();
  await sheet.getByRole('button', { name: 'pt.' }).click();
  await expect(sheet.getByText(/Przypomnienia: dzień wcześniej wieczorem, rano tego dnia, godzinę przed\./)).toBeVisible();
  await sheet.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await expect(sheet.getByText('Koniec musi być po początku (tego samego dnia).')).toBeVisible();
  await sheet.getByLabel('Do (opcjonalnie)', { exact: true }).fill('19:00');
  await sheet.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await seeToast(page, 'Wydarzenie zapisane.');

  // The documents: a category and an entry pointing at it.
  await expect.poll(async () => (await eventsOf(account.uid).get()).size).toBe(1);
  const categories = await categoriesOf(account.uid).get();
  expect(categories.size).toBe(1);
  const { createdAt: catCreated, ...category } = categories.docs[0].data();
  expect(category).toEqual({ name: 'Aktywność fizyczna', color: 'green', importance: 2 });
  expect(Number.isNaN(Date.parse(catCreated))).toBe(false);
  const eventDoc = (await eventsOf(account.uid).get()).docs[0];
  const { createdAt, ...event } = eventDoc.data();
  expect(event).toEqual({
    title: 'Spacer',
    categoryId: categories.docs[0].id,
    extraImportance: 3,
    date: week[0],
    startTime: '18:00',
    endTime: '19:00',
    repeat: 'weekly',
    weekdays: [1, 3, 5],
    repeatUntil: '',
    marks: {},
  });
  expect(Number.isNaN(Date.parse(createdAt))).toBe(false);

  // The week: Monday, Wednesday and Friday, each "Ważne".
  await page.getByRole('link', { name: 'Tydzień', exact: true }).click();
  await expect(page).toHaveURL(/#\/calendar\/week$/);
  const rows = page.locator('.cal-week .cal-row');
  await expect(rows).toHaveCount(3);
  for (const day of [0, 2, 4]) {
    const section = page.locator('.cal-week__day').nth(day);
    await expect(section.locator('.cal-row')).toContainText('Spacer');
    await expect(section.locator('.cal-row')).toContainText('18:00–19:00 · Aktywność fizyczna · Co tydzień: pon., śr., pt.');
    await expect(section.locator('.cal-tag--high')).toHaveText('Ważne');
  }
  await expect(page.locator('.cal-week__day').nth(1)).toContainText('Wolne.');

  // Ticking Wednesday: only that day's mark, no points, nothing else written.
  const before = (await db.doc(`users/${account.uid}`).get()).data();
  await page.locator('.cal-week__day').nth(2).getByRole('button', { name: 'Oznacz jako zrobione: Spacer' }).click();
  await seeToast(page, 'Zrobione: Spacer.');
  await expect.poll(async () => (await eventDoc.ref.get()).data().marks).toEqual({ [week[2]]: 'done' });
  await expect(page.locator('.cal-week__day').nth(2).locator('.cal-row--done')).toHaveCount(1);
  const after = (await db.doc(`users/${account.uid}`).get()).data();
  expect(after.points).toEqual(before.points);
  expect((await db.collection(`users/${account.uid}/activities`).get()).size).toBe(0);
  expect((await db.collection(`users/${account.uid}/dailyLog`).get()).size).toBe(0);

  // Undone again.
  await page.locator('.cal-week__day').nth(2).getByRole('button', { name: 'Cofnij „zrobione”: Spacer' }).click();
  await expect.poll(async () => (await eventDoc.ref.get()).data().marks).toEqual({});
});

test('a day: the all-day row, the timeline, skipping one occurrence and deleting with undo', async ({ page }) => {
  const account = await calendarUser('calendar-day');
  const today = localDay(0);
  const walk = await seedEvent(account.uid, { title: 'Spacer', startTime: '18:00', endTime: '19:30', repeat: 'daily' });
  await seedEvent(account.uid, { title: 'Urodziny Ani', extraImportance: 5 });
  await seedEvent(account.uid, { title: 'Trening', startTime: '18:30', endTime: '19:00', date: today });
  await openSignedIn(page, account, '#/calendar/day');
  await screenSettled(page);

  await expect(page.locator('.cal-period__title')).toContainText('Dziś');
  const allDay = page.getByRole('list', { name: /^Wydarzenia \d/ });
  await expect(allDay.getByRole('listitem')).toHaveCount(1);
  await expect(allDay).toContainText('Urodziny Ani');
  const blocks = page.getByRole('list', { name: 'Wydarzenia o określonej godzinie' }).getByRole('listitem');
  await expect(blocks).toHaveCount(2);
  // Overlapping: side by side, the longer one first.
  const [a, b] = [await blocks.nth(0).boundingBox(), await blocks.nth(1).boundingBox()];
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width - 4);
  expect(b.y).toBeGreaterThan(a.y);
  await expect(blocks.nth(0)).toContainText('Spacer');

  // Skip today's walk from its sheet: the series stays, only today is skipped.
  await blocks.nth(0).getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: 'Wydarzenie' });
  await sheetSettled(sheet);
  await expect(sheet.getByLabel('Nazwa', { exact: true })).toHaveValue('Spacer');
  await sheet.getByRole('button', { name: 'Pomiń ten dzień' }).click();
  await seeToast(page, 'Pominięto ten dzień: Spacer.');
  await expect.poll(async () => (await walk.get()).data().marks).toEqual({ [today]: 'skipped' });
  await expect(blocks.nth(0)).toContainText('pominięte');

  // Tomorrow it is there again, open.
  await page.getByRole('button', { name: 'Następny dzień' }).click();
  await expect(page.getByRole('list', { name: 'Wydarzenia o określonej godzinie' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.locator('.cal-block--skipped')).toHaveCount(0);

  // Deleting the series, then undo: the same document is back.
  await page.locator('.cal-block').first().getByRole('button').click();
  await sheetSettled(sheet);
  await sheet.getByRole('button', { name: 'Usuń wydarzenie ze wszystkimi powtórzeniami' }).click();
  await expect(page.getByText('Wydarzenie usunięte.')).toBeVisible();
  await expect.poll(async () => (await walk.get()).exists).toBe(false);
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(async () => (await walk.get()).data()?.marks).toEqual({ [today]: 'skipped' });
});

test('more important first, and stronger: the month and the chosen day', async ({ page }) => {
  const account = await calendarUser('calendar-order');
  const today = localDay(0);
  const cat = await categoriesOf(account.uid).add({ name: 'Szkoła', color: 'red', importance: 5, createdAt: new Date().toISOString() });
  await seedEvent(account.uid, { title: 'Podlać kwiaty' });
  await seedEvent(account.uid, { title: 'Sprawdzian', categoryId: cat.id, extraImportance: 4 });
  await seedEvent(account.uid, { title: 'Zakupy', extraImportance: 3, startTime: '10:00' });
  await openSignedIn(page, account, '#/calendar');
  await screenSettled(page);

  const day = page.getByRole('list', { name: /^Wydarzenia \d/ }).getByRole('listitem');
  await expect(day).toHaveCount(3);
  await expect(day.nth(0)).toContainText('Sprawdzian');
  await expect(day.nth(0).locator('.cal-tag')).toHaveText('Bardzo ważne');
  await expect(day.nth(1)).toContainText('Zakupy');
  await expect(day.nth(2)).toContainText('Podlać kwiaty');
  await expect(day.nth(0)).toHaveClass(/cal-imp--critical/);
  await expect(day.nth(2)).toHaveClass(/cal-imp--low/);
  // Today's cell: three marks, the critical one first and largest; the cell is tinted.
  const cell = page.getByRole('list', { name: /^Dni miesiąca/ }).getByRole('button', { pressed: true });
  await expect(cell).toHaveAccessibleName(/3 wydarzenia$/);
  await expect(cell).toHaveClass(/cal-top--critical/);
  await expect(cell.locator('.cal-mark').first()).toHaveClass(/cal-mark--critical/);

  // Another day of the month; back with "Dziś".
  const other = today.endsWith('-15') ? 16 : 15;
  await page.getByRole('list', { name: /^Dni miesiąca/ }).getByRole('button', { name: new RegExp(`^${other} `) }).first().click();
  await expect(page.getByText('Nic zaplanowanego na ten dzień.')).toBeVisible();
  await page.getByRole('button', { name: 'Dziś', exact: true }).click();
  await expect(day).toHaveCount(3);
});

test('categories: add, change and delete with undo; entries keep working without one', async ({ page }) => {
  const account = await calendarUser('calendar-categories');
  await openSignedIn(page, account, '#/calendar/categories');
  await expect(page.getByText('Nie masz jeszcze kategorii. Dodaj pierwszą, np. „Aktywność fizyczna”.')).toBeVisible();
  await page.getByRole('button', { name: 'Nowa kategoria' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nowa kategoria' });
  await sheetSettled(sheet);
  await sheet.getByLabel('Nazwa kategorii').fill('Szkoła');
  await sheet.getByRole('button', { name: 'Dodaj kategorię' }).click();
  await seeToast(page, 'Kategoria zapisana.');
  await expect(page.getByRole('list', { name: 'Kategorie' })).toContainText('Szkoła');
  await expect(page.getByRole('list', { name: 'Kategorie' })).toContainText('Ważność 1 · 0 wydarzeń');

  // A second one with the same name is refused.
  await page.getByRole('button', { name: 'Nowa kategoria' }).click();
  await sheetSettled(sheet);
  await sheet.getByLabel('Nazwa kategorii').fill(' szkoła ');
  await sheet.getByRole('button', { name: 'Dodaj kategorię' }).click();
  await expect(sheet.getByText('Masz już kategorię o tej nazwie.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Zamknij' }).click();

  const [catDoc] = (await categoriesOf(account.uid).get()).docs;
  await seedEvent(account.uid, { title: 'Sprawdzian', categoryId: catDoc.id });
  await expect(page.getByRole('list', { name: 'Kategorie' })).toContainText('Ważność 1 · 1 wydarzenie');

  await page.getByRole('list', { name: 'Kategorie' }).getByRole('button', { name: /Szkoła/ }).click();
  const edit = page.getByRole('dialog', { name: 'Kategoria' });
  await sheetSettled(edit);
  await edit.getByRole('button', { name: 'Więcej: Ważność kategorii' }).click();
  await edit.getByRole('button', { name: 'Zapisz kategorię' }).click();
  await expect.poll(async () => (await catDoc.ref.get()).data().importance).toBe(2);

  await page.getByRole('list', { name: 'Kategorie' }).getByRole('button', { name: /Szkoła/ }).click();
  await sheetSettled(edit);
  await edit.getByRole('button', { name: 'Usuń kategorię' }).click();
  await expect(page.getByText('Usunięto kategorię „Szkoła”. Jej wydarzenia zostały, bez kategorii.')).toBeVisible();
  await expect.poll(async () => (await catDoc.ref.get()).exists).toBe(false);
  await expect(page.getByText('Nie masz jeszcze kategorii. Dodaj pierwszą, np. „Aktywność fizyczna”.')).toBeVisible();
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(page.getByRole('list', { name: 'Kategorie' })).toContainText('Szkoła');
  await expect.poll(async () => (await catDoc.ref.get()).data()?.importance).toBe(2);

  // Gone for good: its entry stays, without a category.
  await catDoc.ref.delete();
  await page.getByRole('link', { name: 'Miesiąc', exact: true }).click();
  const row = page.getByRole('list', { name: /^Wydarzenia \d/ }).getByRole('listitem');
  await expect(row).toContainText('Sprawdzian');
  await expect(row).not.toContainText('Szkoła');
});

test('"+" adds an event on the chosen day', async ({ page }) => {
  const account = await calendarUser('calendar-plus');
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Dodaj' }).click();
  await page.getByRole('dialog', { name: 'Dodaj' }).getByRole('button', { name: 'Wydarzenie' }).click();
  await expect(page).toHaveURL(/#\/calendar$/);
  const sheet = page.getByRole('dialog', { name: 'Nowe wydarzenie' });
  await sheetSettled(sheet);
  await expect(sheet.getByLabel('Dzień', { exact: true })).toHaveValue(localDay(0));
  await sheet.getByLabel('Nazwa', { exact: true }).fill('Dentysta');
  await sheet.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await seeToast(page, 'Wydarzenie zapisane.');
  await expect(page.getByRole('list', { name: /^Wydarzenia \d/ })).toContainText('Dentysta');
  await expect.poll(async () => (await eventsOf(account.uid).get()).docs.map((d) => d.data().title)).toEqual(['Dentysta']);
});

const THEMES = [
  ['lifexp', 'dark'],
  ['lifexp', 'light'],
  ['ios', 'light'],
  ['ios', 'dark'],
  ['gold', 'dark'],
];

for (const [family, mode] of THEMES) {
  test(`screenshots: ${family} ${mode} (month, week, day, sheet)`, async ({ page }, testInfo) => {
    const account = await calendarUser(`calendar-shots-${family}-${mode}`);
    const week = thisWeek();
    const cat = await categoriesOf(account.uid).add({ name: 'Aktywność fizyczna', color: 'green', importance: 2, createdAt: new Date().toISOString() });
    const school = await categoriesOf(account.uid).add({ name: 'Szkoła', color: 'violet', importance: 4, createdAt: new Date().toISOString() });
    await seedEvent(account.uid, { title: 'Spacer', categoryId: cat.id, extraImportance: 1, date: week[0], startTime: '18:00', endTime: '19:00', repeat: 'weekly', weekdays: [1, 3, 5] });
    await seedEvent(account.uid, { title: 'Sprawdzian z matematyki', categoryId: school.id, extraImportance: 5, startTime: '08:00', endTime: '08:45' });
    await seedEvent(account.uid, { title: 'Urodziny Ani', extraImportance: 3 });
    await seedEvent(account.uid, { title: 'Podlać kwiaty', date: localDay(2), repeat: 'weekly', weekdays: [2, 6] });
    await seedEvent(account.uid, { title: 'Trening', categoryId: cat.id, startTime: '18:30', endTime: '19:30' });
    await useTheme(page, family, mode);
    const shot = async (name) => {
      await screenSettled(page);
      await page.screenshot({ path: testInfo.outputPath(`${family}-${mode}-${name}.png`) });
      // The screen scrolls inside the shell: the rest of it too.
      await page.locator('.shell__content').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.screenshot({ path: testInfo.outputPath(`${family}-${mode}-${name}-end.png`) });
      await page.locator('.shell__content').evaluate((el) => el.scrollTo(0, 0));
    };

    await openSignedIn(page, account, '#/calendar');
    await expect(page.getByRole('list', { name: /^Wydarzenia \d/ }).getByRole('listitem').first()).toBeVisible();
    await shot('month');
    await page.getByRole('link', { name: 'Tydzień', exact: true }).click();
    await expect(page.locator('.cal-week .cal-row').first()).toBeVisible();
    await shot('week');
    await page.getByRole('link', { name: 'Dzień', exact: true }).click();
    await expect(page.locator('.cal-block').first()).toBeVisible();
    await shot('day');
    // Nothing on the page is wider than the phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
    await page.getByRole('button', { name: 'Nowe wydarzenie' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nowe wydarzenie' });
    await sheetSettled(sheet);
    await sheet.getByRole('radio', { name: 'Nowa kategoria' }).check();
    await sheet.getByRole('switch', { name: 'Cały dzień' }).uncheck();
    await sheet.getByLabel('Powtarzanie').selectOption('weekly');
    await sheetSettled(sheet);
    await page.screenshot({ path: testInfo.outputPath(`${family}-${mode}-sheet.png`) });
  });
}
