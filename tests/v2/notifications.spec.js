// In-app notifications (docs/v2/PLAN.md 9.1, row c-3) on the Firebase emulators, on a
// Pixel 7, with a fake clock: reminders of calendar entries (by importance) and task due
// dates slide in from the top while the app is open, once per device; several waiting
// after the app was away show as one banner; the bell lists them with their read state.
const { devices } = require('@playwright/test');
const { createUser, db } = require('../support/emulator');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
test.use({ ...pixel7 });

/** Today on this machine at hh:mm (the browser runs in the same time zone). */
function todayAt(hh, mm = 0) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const hhmm = (hh, mm = 0) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

function seedEvent(uid, patch) {
  return db.collection(`users/${uid}/calendarEvents`).add({
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

function seedTask(uid, patch) {
  return db.collection(`users/${uid}/todos`).add({
    text: 'Zadanie',
    dueDate: localDay(0),
    size: 'S',
    done: false,
    createdAt: new Date().toISOString(),
    penaltyApplied: false,
    ...patch,
  });
}

const calendarUser = (tag, profile = {}) => createUser({ tag, profile: { optInModules: ['calendar'], ...profile } });
const banner = (page) => page.getByTestId('notification-banner');
const bell = (page) => page.locator('.notice-bell');

/** Lets `ms` of fake time pass in steps, checking no banner shows (one hides itself after 8 s). */
async function expectNoBannerFor(page, ms) {
  for (let t = 0; t < ms; t += 5_000) {
    await page.clock.runFor(5_000);
    await expect(banner(page)).toHaveCount(0);
  }
}

function useTheme(page, family, mode) {
  return page.addInitScript(([f, m]) => localStorage.setItem('lifexp-v2-theme', JSON.stringify({ family: f, mode: m })), [family, mode]);
}

test('a due reminder slides in once; tapping it opens the day; the bell keeps it', async ({ page }) => {
  const account = await calendarUser('notify-once');
  // Low importance, 12:50 → reminded at 11:50, found at 12:00 (within the window).
  await seedEvent(account.uid, { title: 'Dentysta', startTime: '12:50' });
  // Already past and long ago: not shown.
  await seedEvent(account.uid, { title: 'Rano', startTime: '09:00' });
  await page.clock.install({ time: todayAt(12) });
  await openSignedIn(page, account, '#/today');

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('Kalendarz');
  await expect(banner(page)).toContainText('Dentysta');
  await expect(banner(page)).toContainText('Dziś · 12:50');
  await expect(bell(page)).toHaveAccessibleName('Powiadomienia, 1 nowe');
  await expect(bell(page).locator('.notice-bell__count')).toHaveText('1');

  await banner(page).getByRole('button', { name: /Dentysta/ }).click();
  await expect(page).toHaveURL(/#\/calendar\/day$/);
  await expect(banner(page)).toHaveCount(0);
  await expect(bell(page)).toHaveAccessibleName('Powiadomienia');

  // Remembered on this device: a reload shows nothing again.
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('.cal-period__title')).toBeVisible();
  await expectNoBannerFor(page, 35_000);
  const stored = await page.evaluate((uid) => JSON.parse(localStorage.getItem(`lifexp-v2-notices:${uid}`)), account.uid);
  expect(Object.keys(stored.delivered).sort()).toEqual(
    expect.arrayContaining([expect.stringMatching(/:hourBefore$/)]),
  );
  expect(stored.list.map((n) => [n.title, n.read])).toEqual([['Dentysta', true]]);

  await bell(page).click();
  const sheet = page.getByRole('dialog', { name: 'Powiadomienia' });
  await expect(sheet.getByRole('listitem')).toHaveCount(1);
  await expect(sheet.getByRole('listitem')).toContainText(/Dentysta.*Dziś · 12:50/);
});

test('a reminder fires when its time comes, while the app is open', async ({ page }) => {
  const account = await calendarUser('notify-later');
  // Medium: morning and an hour before 13:20 → 12:20.
  await seedEvent(account.uid, { title: 'Trening', startTime: '13:20', endTime: '14:00', extraImportance: 2 });
  await page.clock.install({ time: todayAt(12) });
  await openSignedIn(page, account, '#/calendar');
  await screenSettled(page);
  // The morning one (08:00) is 4 h old: only remembered, not shown.
  await page.clock.runFor(2_000);
  await expect(banner(page)).toHaveCount(0);

  // 12:20:30: the next check (every 30 s) finds it. Small steps, so the banner's own
  // timer (8 s) does not hide it before it is seen.
  await page.clock.fastForward('20:30');
  for (let i = 0; i < 8 && !(await banner(page).isVisible()); i += 1) await page.clock.runFor(5_000);
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('Trening');
  await expect(banner(page)).toContainText('Dziś · 13:20–14:00');
  // "Zamknij" puts it away; it stays in the list.
  await banner(page).getByRole('button', { name: 'Zamknij' }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(bell(page).locator('.notice-bell__count')).toHaveText('1');
});

test('back from the background: several waiting become one banner, not a flood', async ({ page }) => {
  const account = await calendarUser('notify-flood');
  await seedEvent(account.uid, { title: 'Pierwsze', startTime: '12:10' }); // 11:10
  await seedEvent(account.uid, { title: 'Ważne spotkanie', startTime: '12:30', extraImportance: 5 }); // high: 11:30 (+ morning, stale)
  await seedEvent(account.uid, { title: 'Trzecie', startTime: '12:40' }); // 11:40
  await page.clock.install({ time: todayAt(12) });
  await openSignedIn(page, account, '#/today');

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('Ważne spotkanie');
  await expect(banner(page)).toContainText('Dziś · 12:30 · Ważne · i jeszcze 2 przypomnienia');
  await expect(bell(page).locator('.notice-bell__count')).toHaveText('3');
  // Swipe up to put it away.
  const box = await banner(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 10, { steps: 6 });
  await page.mouse.up();
  await expect(banner(page)).toHaveCount(0);
  // No second banner follows: they were shown together.
  await expectNoBannerFor(page, 35_000);

  await bell(page).click();
  const sheet = page.getByRole('dialog', { name: 'Powiadomienia' });
  const rows = sheet.getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Ważne spotkanie');
  await expect(sheet.getByText('nieprzeczytane')).toHaveCount(3);
  await sheet.getByRole('button', { name: 'Oznacz wszystkie jako przeczytane' }).click();
  await expect(sheet.getByText('nieprzeczytane')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Zamknij' }).click();
  await expect(bell(page).locator('.notice-bell__count')).toHaveCount(0);
});

test('tasks remind on the due morning and the morning after; tapping opens Tasks', async ({ page }) => {
  const account = await calendarUser('notify-tasks');
  await seedTask(account.uid, { text: 'Lektura' }); // S, due today: 08:00
  await seedTask(account.uid, { text: 'Zaległe ćwiczenia', size: 'M', dueDate: localDay(-1) }); // overdue: 08:00, high
  await seedTask(account.uid, { text: 'Gotowe', done: true }); // nothing
  await page.clock.install({ time: todayAt(8, 5) });
  await openSignedIn(page, account, '#/today');

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('Zadania');
  await expect(banner(page)).toContainText('Zaległe ćwiczenia');
  await expect(banner(page)).toContainText(/Zadanie po terminie \(.+\) · Ważne · i jeszcze 1 przypomnienie/);
  await banner(page).getByRole('button', { name: /Zaległe/ }).click();
  await expect(page).toHaveURL(/#\/tasks$/);

  await bell(page).click();
  const rows = page.getByRole('dialog', { name: 'Powiadomienia' }).getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText(/Lektura.*Termin zadania: dziś/);
});

test('with the calendar off there is no bell and no reminder', async ({ page }) => {
  const account = await createUser({ tag: 'notify-off' });
  await seedEvent(account.uid, { title: 'Dentysta', startTime: '12:50' });
  await seedTask(account.uid, { text: 'Lektura' });
  await page.clock.install({ time: todayAt(12) });
  await openSignedIn(page, account, '#/today');
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible();
  await expectNoBannerFor(page, 35_000);
  await expect(bell(page)).toHaveCount(0);
});

test('reduced motion: the banner appears and leaves without moving', async ({ page }) => {
  const account = await calendarUser('notify-reduced');
  await seedEvent(account.uid, { title: 'Dentysta', startTime: '12:50' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: todayAt(12) });
  await openSignedIn(page, account, '#/today');
  await expect(banner(page)).toBeVisible();
  const motion = await banner(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.animationDuration, s.transitionDuration];
  });
  expect(motion).toEqual(['0s', '0s']);
});

const THEMES = [
  ['lifexp', 'dark'],
  ['lifexp', 'light'],
  ['ios', 'light'],
  ['ios', 'dark'],
  ['gold', 'dark'],
];

for (const [family, mode] of THEMES) {
  test(`screenshots: ${family} ${mode} (banner, list)`, async ({ page }, testInfo) => {
    const account = await calendarUser(`notify-shots-${family}-${mode}`);
    await seedEvent(account.uid, { title: 'Sprawdzian z matematyki', startTime: '12:45', endTime: '13:30', extraImportance: 5 });
    await seedEvent(account.uid, { title: 'Spacer', startTime: '12:30' });
    await seedTask(account.uid, { text: 'Zaległa lektura', size: 'M', dueDate: localDay(-1) });
    await useTheme(page, family, mode);
    await page.clock.install({ time: todayAt(12) });
    await openSignedIn(page, account, '#/today');
    await expect(banner(page)).toBeVisible();
    await screenSettled(page);
    await banner(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await page.screenshot({ path: testInfo.outputPath(`${family}-${mode}-banner.png`) });
    await banner(page).getByRole('button', { name: 'Zamknij' }).click();
    await expect(banner(page)).toHaveCount(0);
    await bell(page).click();
    const sheet = page.getByRole('dialog', { name: 'Powiadomienia' });
    // The overdue task's reminder (08:00) is too old at noon: only the two entries.
    await expect(sheet.getByRole('listitem')).toHaveCount(2);
    await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    await page.screenshot({ path: testInfo.outputPath(`${family}-${mode}-list.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  });
}

test('the bell fits the top bar next to a long title', async ({ page }) => {
  const account = await calendarUser('notify-topbar');
  await openSignedIn(page, account, '#/reports');
  const bar = await page.locator('.topbar').boundingBox();
  const b = await bell(page).boundingBox();
  expect(b.x + b.width).toBeLessThanOrEqual(bar.x + bar.width);
  await expect(bell(page)).toContainText('Powiadomienia');
});
