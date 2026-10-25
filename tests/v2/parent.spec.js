// The parent's view #/parent (docs/v2/PLAN.md 9.1, row 6-2) on the emulators, with the
// production firestore.rules: a parent is the e-mail a child entered as parentEmail.
const { Timestamp } = require('firebase-admin/firestore');
const { auth, createUser, db, serveCdnFromNpm, todayUtcKey } = require('../support/emulator');
const { test, expect, appUrl, openSignedIn, screenSettled, signIn } = require('../support/v2');

test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });

const dayKey = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

/** A child linked to `parentEmail`, with the data of every card (the shapes v1 writes). */
async function seedChild(parentEmail, { name = 'Ala', total = 120 } = {}) {
  const child = await createUser({
    tag: 'child',
    profile: {
      name,
      parentEmail,
      parentEmailVerifiedAt: new Date().toISOString(),
      points: { total, earnedAllTime: 620, spentAllTime: 50 },
      // 1 zł = 5 pkt and 1 zł = 2 pkt of chores: v1's parent.html ignores both (B10).
      pointsRateGeneralZl: 1,
      pointsRateGeneralPts: 5,
      pointsRateChoresZl: 1,
      pointsRateChoresPts: 2,
      goals: [
        { id: 'g1', name: 'Rower', type: 'money', amount: 100, celebrated: false, saved: 25 },
        { id: 'g2', name: 'Klocki', type: 'points', amount: 200, celebrated: false },
      ],
    },
  });
  const user = db.doc(`users/${child.uid}`);
  await user.collection('dailyLog').doc(todayUtcKey()).set({ pointsEarned: 12, gamingMinutes: 45 });
  await user.collection('dailyLog').doc(dayKey(2)).set({ pointsEarned: 30, gamingMinutes: 60 });
  await user.collection('activityDefs').doc('learning').set({ name: 'Nauka', points: 40, icon: '', color: '#6c63ff', order: 0 });
  await user.collection('activities').add({ type: 'learning', duration: 30, points: 12, desc: '', timestamp: Timestamp.now() });
  await user.collection('purchases').add({ description: 'Gra na konsolę', amount: 8.5, pointsCost: 85, timestamp: Timestamp.now() });
  for (const points of [10, 30]) {
    await user.collection('chores').add({
      choreId: 'x', choreName: 'Zmywanie', choreEmoji: '🍽️', points, dateISO: todayUtcKey(), monthKey: todayUtcKey().slice(0, 7), createdAt: new Date(),
    });
  }
  await user.collection('money').doc('balance').set({ current: 90 });
  // Owner-only in the rules: never on the parent's screen.
  await user.collection('moneyTransactions').add({ type: 'expense', amount: 5, category: 'TAJNA-KATEGORIA', note: 'TAJNA-NOTATKA', date: todayUtcKey() });
  return child;
}

async function snapshotAccount(uid) {
  const user = db.doc(`users/${uid}`);
  const state = { [user.path]: (await user.get()).updateTime.toMillis() };
  for (const collection of await user.listCollections()) {
    for (const d of (await collection.get()).docs) state[d.ref.path] = d.updateTime.toMillis();
  }
  return state;
}

const openMenu = (page) => page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();

test('a parent sees each child with the numbers of the shared domain, and nothing is written', async ({ page }) => {
  const parent = await createUser({ tag: 'parent', profile: { name: 'Mama' } });
  const ala = await seedChild(parent.email);
  const bartek = await createUser({
    tag: 'child2',
    profile: { name: 'Bartek', parentEmail: parent.email, points: { total: 7, earnedAllTime: 7, spentAllTime: 0 } },
  });
  const before = [await snapshotAccount(parent.uid), await snapshotAccount(ala.uid), await snapshotAccount(bartek.uid)];

  await openSignedIn(page, parent, '#/today');
  await openMenu(page);
  await page.locator('.shell__nav').getByRole('link', { name: 'Rodzic' }).click();
  await expect(page).toHaveURL(/#\/parent$/);

  await page.getByRole('radio', { name: 'Ala' }).check();
  await expect(page.getByText('Punkty: Ala')).toBeVisible();
  await expect(page.getByText('120 pkt', { exact: true })).toBeVisible();
  // At the child's rate (1 zł = 5 pkt), not v1's fixed 10 pkt = 1 zł.
  await expect(page.getByText('≈ 24,00 zł po kursie z konta dziecka')).toBeVisible();
  await expect(page.getByText(/· 120 \/ 500 XP$/)).toBeVisible();

  const points = page.getByRole('list', { name: 'Punkty w ostatnich 7 dniach' });
  await expect(points.getByRole('listitem')).toHaveCount(7);
  await expect(points).toContainText(': 12 pkt');
  await expect(points).toContainText(': 30 pkt');
  const gaming = page.getByRole('list', { name: 'Granie w ostatnich 7 dniach' });
  await expect(gaming.getByRole('listitem')).toHaveCount(7);
  await expect(gaming).toContainText(': 45 min');
  await expect(gaming).toContainText(': 1 h');
  await expect(page.getByText('Granie dziś').locator('..')).toContainText('45 min');
  await expect(page.getByText('Granie w 7 dni').locator('..')).toContainText('1 h 45 min');

  // Money goals from `saved` (25 of 100 zł), not the Money balance of 90 zł (B10).
  await expect(page.getByRole('list', { name: 'Cele' })).toContainText('Brakuje 75,00 zł');
  await expect(page.getByRole('list', { name: 'Cele' })).toContainText('Brakuje 80 pkt');
  // 40 chore points at 1 zł = 2 pkt.
  await expect(page.getByText('20,00 zł', { exact: true })).toBeVisible();
  await expect(page.getByText('40 pkt nierozliczone, po kursie z konta dziecka')).toBeVisible();
  await expect(page.getByText('Saldo w Pieniądzach').locator('..')).toContainText('90,00 zł');
  await expect(page.getByRole('list', { name: 'Ostatnie zakupy' })).toContainText('Gra na konsolę');
  await expect(page.getByRole('list', { name: 'Ostatnie zakupy' })).toContainText('8,50 zł');
  await expect(page.getByRole('list', { name: 'Najczęstsze w 7 dniach' })).toContainText('Nauka');
  await expect(page.getByRole('list', { name: 'Ostatnie aktywności' })).toContainText('+12 pkt');
  await expect(page.locator('body')).not.toContainText('TAJNA');

  await page.getByRole('radio', { name: 'Bartek' }).check();
  await expect(page.getByText('Punkty: Bartek')).toBeVisible();
  await expect(page.getByText('7 pkt', { exact: true })).toBeVisible();
  await expect(page.getByText('Brak zakupów.')).toBeVisible();

  await screenSettled(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  expect([await snapshotAccount(parent.uid), await snapshotAccount(ala.uid), await snapshotAccount(bartek.uid)]).toEqual(before);
});

test('an account that is nobody\'s parent has no "Rodzic" in the menu; #/parent says how to link', async ({ page }) => {
  const someone = await createUser({ tag: 'not-parent' });
  await openSignedIn(page, someone, '#/today');
  await openMenu(page);
  await expect(page.locator('.shell__nav').getByRole('link', { name: 'Ustawienia' })).toBeVisible();
  await expect(page.locator('.shell__nav').getByRole('link', { name: 'Rodzic' })).toHaveCount(0);

  await page.goto(appUrl('#/parent'));
  await expect(page.getByText('Brak powiązanych kont')).toBeVisible();
  await expect(page.getByText(`Żadne konto nie ma adresu ${someone.email} jako e-maila rodzica.`, { exact: false })).toBeVisible();
});

test('a child account never sees "Rodzic"', async ({ page }) => {
  const parent = await createUser({ tag: 'parent-of' });
  const child = await seedChild(parent.email);
  await openSignedIn(page, child, '#/today');
  await openMenu(page);
  await expect(page.locator('.shell__nav').getByRole('link', { name: 'Ustawienia' })).toBeVisible();
  await expect(page.locator('.shell__nav').getByRole('link', { name: 'Rodzic' })).toHaveCount(0);
});

test('a parent without a LifeXP account of their own (v1 parent.html) opens #/parent after signing in', async ({ page }) => {
  const email = `bare-parent-${process.pid}-${Date.now()}@test.lifexp`;
  const password = 'test-password-123';
  await auth.createUser({ email, password, emailVerified: true });
  await seedChild(email);
  await page.goto(appUrl('#/parent'));
  await signIn(page, { email, password });
  await expect(page.getByRole('heading', { name: 'Rodzic' })).toBeVisible();
  await expect(page.getByText('Punkty: Ala')).toBeVisible();
  await expect(page.getByText('≈ 24,00 zł po kursie z konta dziecka')).toBeVisible();
  // One child: no switch.
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible();
});

test.describe('v1 on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('v1 parent.html shows the same points total', async ({ page, context }) => {
    const parent = await createUser({ tag: 'parent-v1' });
    await seedChild(parent.email);
    await serveCdnFromNpm(context);
    await page.goto('/parent.html?emulator=1');
    await page.fill('#login-email', parent.email);
    await page.fill('#login-password', parent.password);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.locator('.balance-pts')).toHaveText('120 punktów');
  });
});
