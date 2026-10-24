// Ex-us slash commands (docs/v2/PLAN.md 6, stage 5a) on the Firebase emulators:
// read and run locally, through the same services as the screens, no backend call.
const { createUser, db } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

const rower = { id: 'g1', name: 'Rower', type: 'money', amount: 150.5, celebrated: false, saved: 0 };
const poziom = { id: 'g2', name: 'Poziom', type: 'points', amount: 500, celebrated: false };

/** 50 zł in Money, 120 points, and the given goals (the shapes v1 writes). */
async function goalsAccount(tag, goals = []) {
  const account = await createUser({
    tag,
    profile: { points: { total: 120, earnedAllTime: 300, spentAllTime: 0 }, ...(goals.length ? { goals } : {}) },
  });
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 50 });
  return account;
}
const goalsOf = async (uid) => ((await db.doc(`users/${uid}`).get()).data().goals ?? []).map(({ id, ...rest }) => rest);
const balanceOf = async (uid) => (await db.doc(`users/${uid}/money/balance`).get()).data().current;

const tasksOf = async (uid) => (await db.collection(`users/${uid}/todos`).get()).docs.map((d) => d.data());

async function send(page, text) {
  await page.getByLabel('Wiadomość do Ex-us').fill(text);
  await page.getByRole('button', { name: 'Wyślij' }).click();
}

const log = (page) => page.getByRole('log', { name: 'Rozmowa z Ex-us' });

test('the menu opens Ex-us; /pomoc lists the commands, other text and unknown commands say what to do', async ({ page }) => {
  const account = await createUser({ tag: 'exus-help' });
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Zapytaj Ex-us' }).click();
  await expect(page).toHaveURL(/#\/exus$/);
  await expect(log(page)).toContainText('Wpisz /pomoc');

  await send(page, '/pomoc');
  await expect(log(page)).toContainText('/zadanie <treść> <termin> [S/M/L] — Nowe zadanie');
  await expect(log(page)).toContainText('/dzis — Podsumowanie dnia');
  await expect(log(page)).toContainText('/cofnij — Cofnij ostatni zapis z tej rozmowy');
  await expect(log(page)).toContainText('/cel <nazwa> <kwota zł|pkt> — Nowy cel');
  await expect(log(page)).toContainText('/wplac <cel> <kwota> — Wpłać z salda na cel pieniężny');
  await expect(log(page)).toContainText('/cele — Cele i postęp');
  await expect(log(page)).toContainText('/edytuj-cel <cel> [nazwa=…] [kwota=…] — Zmień nazwę albo kwotę celu');
  await expect(log(page)).toContainText('/usun-cel <cel> — Usuń cel');
  await expect(log(page)).toContainText('/wplyw <kwota> [kategoria] [notatka] [data] — Zapisz wpływ');
  await expect(log(page)).toContainText('/wydatek <kwota> [kategoria] [notatka] [data] — Zapisz wydatek');
  await expect(log(page)).toContainText('/saldo — Saldo, wydatki w tym miesiącu i pieniądze w celach');
  await expect(log(page)).toContainText('/kategoria <nazwa> — Nowa kategoria transakcji');
  await expect(log(page)).toContainText('/usun-transakcje [ostatnia|tekst] — Usuń transakcję');
  await send(page, 'odłóż 50 zł na rower');
  await expect(log(page)).toContainText('Rozmowa z AI dojdzie w następnym kroku.');
  await send(page, '/latanie');
  await expect(log(page)).toContainText('Nie znam komendy /latanie.');
});

test('/zadanie creates the task in any argument order; "Cofnij" takes it back', async ({ page }) => {
  const account = await createUser({ tag: 'exus-task' });
  await openSignedIn(page, account, '#/exus');
  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await send(page, '/zadanie Kupić mleko');
  await expect(log(page)).toContainText('Brakuje: termin.');
  expect(await tasksOf(account.uid)).toEqual([]);

  await send(page, '/zadanie L jutro Kupić mleko');
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko”');
  await expect.poll(() => tasksOf(account.uid)).toEqual([
    expect.objectContaining({ text: 'Kupić mleko', dueDate: tomorrow, size: 'L', done: false }),
  ]);
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(log(page)).toContainText('Cofnięto: zadanie „Kupić mleko”.');
  await expect.poll(() => tasksOf(account.uid)).toEqual([]);
});

test('/cofnij takes back the last writes one by one; the toast and /cofnij never undo the same one twice', async ({ page }) => {
  const account = await createUser({ tag: 'exus-undo' });
  await openSignedIn(page, account, '#/exus');
  const texts = async () => (await tasksOf(account.uid)).map((task) => task.text).sort();
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/zadanie Pierwsze jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Pierwsze”');
  await send(page, '/zadanie Drugie jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Drugie”');
  await expect.poll(texts).toEqual(['Drugie', 'Pierwsze']);

  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: zadanie „Drugie”.');
  await expect.poll(texts).toEqual(['Pierwsze']);
  await send(page, '/COFNIJ');
  await expect(replies.last()).toHaveText('Cofnięto: zadanie „Pierwsze”.');
  await expect.poll(texts).toEqual([]);
  // The toasts of the writes undone go with them.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');

  // "Cofnij" on the toast takes the entry off the stack: /cofnij then has nothing left.
  await send(page, '/zadanie Trzecie jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Trzecie”');
  await expect.poll(texts).toEqual(['Trzecie']);
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(replies.last()).toHaveText('Cofnięto: zadanie „Trzecie”.');
  await expect.poll(texts).toEqual([]);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
  await expect(replies.filter({ hasText: 'Cofnięto: zadanie „Trzecie”.' })).toHaveCount(1);
});

test('/dzis sums the day up from the account', async ({ page }) => {
  const account = await createUser({
    tag: 'exus-today',
    profile: { points: { total: 1240, earnedAllTime: 1300, spentAllTime: 60 }, dailyLimit: 200 },
  });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/dziś');
  await expect(log(page)).toContainText('dziś 0 z limitu 200');
  await expect(log(page)).toContainText('Zadania na dziś i zaległe: 0.');
});

test('with Ex-us off, the menu has no Ex-us and its address leads to Today', async ({ page }) => {
  const account = await createUser({ tag: 'exus-off', profile: { enabledModules: ['chores', 'money', 'stats', 'notes'] } });
  await openSignedIn(page, account, '#/exus');
  await expect(page).toHaveURL(/#\/today$/);
  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Zapytaj Ex-us' })).toHaveCount(0);
});

test('typing "/" opens the command palette; a tap puts the command in the field and shows its syntax', async ({ page }) => {
  const account = await createUser({ tag: 'exus-palette' });
  await openSignedIn(page, account, '#/exus');
  const field = page.getByLabel('Wiadomość do Ex-us');
  const list = page.getByRole('list', { name: 'Komendy pasujące do wpisu' });
  await field.fill('/');
  await expect(list.getByRole('button')).toHaveCount(14);
  await field.fill('/za');
  await expect(list.getByRole('button')).toHaveCount(1);
  await list.getByRole('button', { name: /Nowe zadanie/ }).click();
  await expect(field).toHaveValue('/zadanie ');
  await expect(field).toBeFocused();
  await expect(list).toHaveCount(0);
  await expect(page.getByText('/zadanie <treść> <termin> [S/M/L]', { exact: true })).toBeVisible();
  await field.fill('zwykły tekst');
  await expect(list).toHaveCount(0);
});

test('/cel makes a money or a points goal by its unit, asks for a unit, keeps the limit of three; /cofnij deletes the new goal', async ({ page }) => {
  const account = await goalsAccount('exus-create-goal');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/cele');
  await expect(replies.last()).toContainText('Nie masz jeszcze celów.');
  await send(page, '/cel Rower 1500');
  await expect(replies.last()).toContainText('Dopisz jednostkę kwoty');
  await send(page, '/cel Rower');
  await expect(replies.last()).toContainText('Brakuje: kwota (zł albo pkt).');
  expect(await goalsOf(account.uid)).toEqual([]);

  await send(page, '/cel Rower 150,5 zł');
  await expect(replies.last()).toContainText('Dodano cel „Rower”: 150,50 zł (celów: 1 z 3).');
  await expect.poll(() => goalsOf(account.uid)).toEqual([{ name: 'Rower', type: 'money', amount: 150.5, celebrated: false, saved: 0 }]);
  await send(page, '/cel "Nowy poziom" 5 000 pkt');
  await expect(replies.last()).toContainText('Dodano cel „Nowy poziom”: 5000 pkt (celów: 2 z 3).');
  await expect.poll(() => goalsOf(account.uid)).toEqual([
    { name: 'Rower', type: 'money', amount: 150.5, celebrated: false, saved: 0 },
    { name: 'Nowy poziom', type: 'points', amount: 5000, celebrated: false, saved: 0 },
  ]);

  // /cofnij deletes the goal just made (it had put nothing aside).
  await send(page, '/cofnij');
  await expect(replies.last()).toContainText('Cofnięto: cel „Nowy poziom”.');
  await expect.poll(async () => (await goalsOf(account.uid)).map((g) => g.name)).toEqual(['Rower']);

  await send(page, '/cel Drugi 10 zł');
  await send(page, '/cel Trzeci 20 zł');
  await expect.poll(async () => (await goalsOf(account.uid)).length).toBe(3);
  await send(page, '/cel Czwarty 30 zł');
  await expect(replies.last()).toContainText('Możesz mieć najwyżej 3 cele.');
  expect(await goalsOf(account.uid)).toHaveLength(3);
  expect(await balanceOf(account.uid)).toBe(50);
});

test('/wplac moves money from the balance to a money goal; more than the balance, a points goal and "pkt" are refused', async ({ page }) => {
  const account = await goalsAccount('exus-deposit-goal', [rower, poziom]);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/wpłać rower 60');
  await expect(replies.last()).toHaveText('Za mało środków na saldzie.');
  await send(page, '/wplac Poziom 10');
  await expect(replies.last()).toContainText('Cel „Poziom” jest punktowy. Wpłacać można tylko na cele pieniężne.');
  await send(page, '/wplac Rower 10 pkt');
  await expect(replies.last()).toHaveText('Wpłata jest w złotych, bez „pkt”.');
  await send(page, '/wplac 10');
  await expect(replies.last()).toContainText('Brakuje: cel.');
  await send(page, '/wplac statek 10');
  await expect(replies.last()).toContainText('Nie ma celu „statek”.');
  expect(await goalsOf(account.uid)).toEqual([
    { name: 'Rower', type: 'money', amount: 150.5, celebrated: false, saved: 0 },
    { name: 'Poziom', type: 'points', amount: 500, celebrated: false },
  ]);
  expect(await balanceOf(account.uid)).toBe(50);

  await send(page, '/wplac rowr 20,25 zł');
  await expect(replies.last()).toHaveText('Wpłacono 20,25 zł na: Rower');
  await expect.poll(() => balanceOf(account.uid)).toBe(29.75);
  expect((await goalsOf(account.uid))[0]).toMatchObject({ name: 'Rower', saved: 20.25 });
  // A deposit has no undo here: the toast has no "Cofnij", /cofnij has nothing.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
});

test('/cele lists the goals with their progress', async ({ page }) => {
  const account = await goalsAccount('exus-goals-list', [{ ...rower, saved: 30 }, poziom, { id: 'g3', name: 'Mały', type: 'points', amount: 100, celebrated: true }]);
  await openSignedIn(page, account, '#/exus');
  await send(page, '/cele');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('Celów: 3 z 3');
  await expect(reply).toContainText('Rower — Cel pieniężny: 30,00 zł z 150,50 zł · 19%');
  await expect(reply).toContainText('Poziom — Cel punktowy: 120 pkt z 500 pkt · 24%');
  await expect(reply).toContainText('Mały — Cel punktowy: 120 pkt z 100 pkt · 100% (Osiągnięty)');
});

test('/edytuj-cel changes the name and the amount of a goal that keeps its kind', async ({ page }) => {
  const account = await goalsAccount('exus-edit-goal', [{ ...rower, saved: 20 }, poziom]);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/edytuj-cel rower');
  await expect(replies.last()).toContainText('Podaj, co zmienić');
  await send(page, '/edytuj-cel rower kwota=dużo');
  await expect(replies.last()).toContainText('Nie rozumiem: kwota (zł albo pkt).');
  await send(page, '/edytuj-cel rower kwota=500pkt');
  await expect(replies.last()).toContainText('Cel „Rower” jest pieniężny: podaj kwotę w zł.');
  await send(page, '/edytuj-cel poziom kwota=500zł');
  await expect(replies.last()).toContainText('Cel „Poziom” jest punktowy: podaj punkty (pkt).');
  expect((await goalsOf(account.uid))[0]).toMatchObject({ name: 'Rower', amount: 150.5 });

  await send(page, '/edytuj-cel rowr nazwa="Nowy rower" kwota=2000');
  await expect(replies.last()).toHaveText('Zapisano cel „Nowy rower”: 2000,00 zł.');
  await expect.poll(async () => (await goalsOf(account.uid))[0]).toEqual({ name: 'Nowy rower', type: 'money', amount: 2000, celebrated: false, saved: 20 });
  await send(page, '/edytuj-cel poziom kwota=800');
  await expect(replies.last()).toHaveText('Zapisano cel „Poziom”: 800 pkt.');
  await expect.poll(async () => (await goalsOf(account.uid))[1]).toMatchObject({ name: 'Poziom', type: 'points', amount: 800 });
});

test('a goal is found by a part of its name or a typo; several fits are listed, none is said', async ({ page }) => {
  const account = await goalsAccount('exus-goal-names', [
    { ...rower, name: 'Rower górski' },
    { id: 'g2', name: 'Rower szosowy', type: 'money', amount: 900, celebrated: false, saved: 0 },
    { id: 'g3', name: 'Żaglówka', type: 'money', amount: 5000, celebrated: false, saved: 0 },
  ]);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/wplac rower 10');
  await expect(replies.last()).toContainText('Pasuje kilka celów: „Rower górski”, „Rower szosowy”. Napisz dokładniej.');
  await send(page, '/wplac "rower szosowy" 10');
  await expect(replies.last()).toHaveText('Wpłacono 10,00 zł na: Rower szosowy');
  await send(page, '/wplac ZAGLOWKA 5');
  await expect(replies.last()).toHaveText('Wpłacono 5,00 zł na: Żaglówka');
  await send(page, '/wplac zaglowca 5');
  await expect(replies.last()).toHaveText('Wpłacono 5,00 zł na: Żaglówka');
  await send(page, '/wplac samochód 5');
  await expect(replies.last()).toContainText('Nie ma celu „samochód”.');
  await send(page, '/usun-cel rower');
  await expect(replies.last()).toContainText('Pasuje kilka celów');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect.poll(() => balanceOf(account.uid)).toBe(30);
});

test('/usun-cel asks first; Anuluj changes nothing, Wykonaj deletes the goal and gives the money back', async ({ page }) => {
  const account = await goalsAccount('exus-delete-goal', [{ ...rower, saved: 20 }, poziom]);
  await openSignedIn(page, account, '#/exus');
  const dialog = page.getByRole('alertdialog');

  await send(page, '/usuń-cel rowr');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Wykonać /usun-cel?');
  await expect(dialog).toContainText('Cel „Rower” zniknie z listy, a odłożone 20,00 zł wróci na saldo w Pieniądzach.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(log(page)).toContainText('Anulowano, nic się nie zmieniło.');
  await expect(dialog).toBeHidden();
  expect(await goalsOf(account.uid)).toHaveLength(2);
  expect(await balanceOf(account.uid)).toBe(50);

  await send(page, '/usun-cel "rower"');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Usunięto cel „Rower”. Odłożone 20,00 zł wróciło na saldo.');
  await expect.poll(() => goalsOf(account.uid)).toEqual([{ name: 'Poziom', type: 'points', amount: 500, celebrated: false }]);
  expect(await balanceOf(account.uid)).toBe(70);

  // A points goal gives nothing back; a name no goal has asks nothing.
  await send(page, '/usun-cel statek');
  await expect(log(page)).toContainText('Nie ma celu „statek”.');
  await expect(dialog).toBeHidden();
  await send(page, '/usun-cel poz');
  await expect(dialog).toContainText('Cel „Poziom” zniknie z listy. Na saldo nic nie wraca.');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect.poll(() => goalsOf(account.uid)).toEqual([]);
  expect(await balanceOf(account.uid)).toBe(70);
});

test('a message sent while the confirmation is still closing is not lost', async ({ page }) => {
  const account = await goalsAccount('exus-dialog-closing', [rower]);
  await openSignedIn(page, account, '#/exus');
  // A slow machine: rendering and effects lag behind the test's next command.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  const replies = page.locator('.exus-msg--exus');
  const mine = page.locator('.exus-msg--me');

  for (const [i, button] of ['Anuluj', 'Wykonaj'].entries()) {
    await send(page, '/usun-cel Rower');
    await page.getByRole('alertdialog').getByRole('button', { name: button }).click();
    // No waiting for the dialog to go: the next command is typed at once.
    await page.getByLabel('Wiadomość do Ex-us').fill('/cele');
    await page.getByRole('button', { name: 'Wyślij' }).click();
    await expect(mine.last()).toHaveText('/cele');
    // The answer to /cele (the deletion may or may not be through yet) comes after the message.
    await expect(replies.filter({ hasText: /Rower — Cel pieniężny|Nie masz jeszcze celów/ })).toHaveCount(i + 1);
    await expect(page.getByLabel('Wiadomość do Ex-us')).toHaveValue('');
  }
  await expect.poll(() => goalsOf(account.uid)).toEqual([]);
});

// ── Money commands (stage 5a-6): the same services and rules as the Money screen ──

const utcToday = () => new Date().toISOString().slice(0, 10);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const MONEY_CATEGORIES = [
  ['cat-pocket', 'kieszonkowe', '#6c63ff'],
  ['cat-games', 'gry', '#6c63ff'],
  ['cat-food', 'jedzenie', '#4ecca3'],
];

/** As the Money tests: 50 zł on the balance, 120 points, three categories, the income counter at 0 (no M2). */
async function moneyAccount(tag, { profile = {}, limit = 200 } = {}) {
  const account = await createUser({
    tag,
    profile: { points: { total: 120, earnedAllTime: 300, spentAllTime: 10 }, moneyIncomeAllTime: 0, ...profile },
  });
  const user = db.doc(`users/${account.uid}`);
  await user.collection('money').doc('balance').set({ current: 50 });
  await user.collection('money').doc('settings').set({ monthlyLimit: limit, currency: 'PLN' });
  for (const [id, name, color] of MONEY_CATEGORIES) await user.collection('moneyCategories').doc(id).set({ name, color, icon: '' });
  return account;
}

/** Everything a transaction touches, ids and creation times aside. */
async function moneyState(uid) {
  const user = db.doc(`users/${uid}`);
  const profile = (await user.get()).data();
  const strip = (docs) =>
    docs
      .map((d) => {
        const { createdAt, ...rest } = d.data();
        return rest;
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    balance: (await user.collection('money').doc('balance').get()).data(),
    points: profile.points,
    moneyIncomeAllTime: profile.moneyIncomeAllTime ?? null,
    transactions: strip((await user.collection('moneyTransactions').get()).docs),
    categories: strip((await user.collection('moneyCategories').get()).docs).map((c) => c.name).sort(),
  };
}

const lunch = () => ({ type: 'expense', amount: 5, category: 'jedzenie', note: 'obiad', date: utcToday(), source: 'manual', pointsCost: 50 });
const afterLunch = (before) => ({
  ...before,
  balance: { current: 45 },
  points: { total: 70, earnedAllTime: 300, spentAllTime: 60 },
  transactions: [lunch()],
});

test('/wydatek 5 jedzenie obiad leaves what the Money screen leaves (G5.1); /cofnij reverses it exactly', async ({ page }) => {
  const account = await moneyAccount('exus-expense');
  const before = await moneyState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  // Typed at once, before anything has loaded: the command waits for the categories.
  await send(page, '/wydatek obiad 5 jedzenie');
  await expect(replies.last()).toContainText('Zapisano wydatek 5,00 zł w kategorii „jedzenie”');
  await expect(replies.last()).toContainText('notatka: „obiad”');
  await expect(replies.last()).toContainText('−50 pkt');
  await expect(page.getByText('Transakcja zapisana. −50 pkt')).toBeVisible();
  expect(await moneyState(account.uid)).toEqual(afterLunch(before));

  await send(page, '/cofnij');
  await expect(log(page)).toContainText('Cofnięto: wydatek 5,00 zł (jedzenie).');
  await expect.poll(() => moneyState(account.uid)).toEqual(before);
});

test('/wydatek: above the balance is refused; the category is asked for; a new one is written kategoria=nazwa', async ({ page }) => {
  const account = await moneyAccount('exus-expense-rules');
  const before = await moneyState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/wydatek 60 gry');
  await expect(replies.last()).toHaveText('Za mało środków na saldzie.');
  expect(await moneyState(account.uid)).toEqual(before);

  await send(page, '/wydatek obiad w szkole');
  await expect(replies.last()).toContainText('Brakuje: kwota.');
  await send(page, '/wydatek 5 obiad w szkole');
  await expect(replies.last()).toContainText('Podaj kategorię: ');
  await expect(replies.last()).toContainText('kategoria=nazwa');
  await send(page, '/wydatek 0 gry');
  await expect(replies.last()).toHaveText('Podaj kwotę większą od zera.');
  expect(await moneyState(account.uid)).toEqual(before);

  // A word that names no category is never turned into one; an explicit name is.
  await send(page, '/wydatek 12,50 kategoria=Sport piłka wczoraj');
  await expect(replies.last()).toContainText('Zapisano wydatek 12,50 zł w kategorii „Sport”');
  await expect(replies.last()).toContainText('Utworzono nową kategorię „Sport”.');
  await expect(replies.last()).toContainText('−120 pkt');
  await expect.poll(async () => (await moneyState(account.uid)).categories).toEqual(['Sport', 'gry', 'jedzenie', 'kieszonkowe'].sort());
  const state = await moneyState(account.uid);
  expect(state.balance).toEqual({ current: 37.5 });
  expect(state.transactions).toEqual([{ type: 'expense', amount: 12.5, category: 'Sport', note: 'piłka', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), source: 'manual', pointsCost: 120 }]);
});

test('/wplyw adds an income and the income counter; /cofnij takes it back', async ({ page }) => {
  const account = await moneyAccount('exus-income');
  const before = await moneyState(account.uid);
  await openSignedIn(page, account, '#/exus');

  await send(page, '/wplyw 20 kieszonkowe');
  await expect(log(page)).toContainText('Zapisano wpływ 20,00 zł w kategorii „kieszonkowe”');
  await expect.poll(() => moneyState(account.uid)).toEqual({
    ...before,
    balance: { current: 70 },
    moneyIncomeAllTime: 20,
    transactions: [{ type: 'income', amount: 20, category: 'kieszonkowe', note: '', date: utcToday(), source: 'manual', pointsCost: 0 }],
  });

  await send(page, '/cofnij');
  await expect(log(page)).toContainText('Cofnięto: wpływ 20,00 zł (kieszonkowe).');
  await expect.poll(() => moneyState(account.uid)).toEqual(before);
});

test('/wydatek under a CPU 6 times slower, from a cold start, still waits for the data', async ({ page }) => {
  const account = await moneyAccount('exus-expense-slow');
  const before = await moneyState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await send(page, '/wydatek 5 jedzenie obiad');
  await expect(page.getByText('Transakcja zapisana. −50 pkt')).toBeVisible();
  await expect.poll(() => moneyState(account.uid)).toEqual(afterLunch(before));
});

test('/saldo gives the balance, this month against the limit, and what is put aside in goals', async ({ page }) => {
  const account = await moneyAccount('exus-balance', { profile: { goals: [{ ...rower, saved: 20 }] }, limit: 20 });
  await db.collection(`users/${account.uid}/moneyTransactions`).add({ ...lunch(), amount: 30, date: localToday(), createdAt: new Date() });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/saldo');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('Saldo: 50,00 zł.');
  await expect(reply).toContainText('Wydatki w tym miesiącu: 30,00 zł z limitu 20,00 zł. Limit przekroczony.');
  await expect(reply).toContainText('W celach: 20,00 zł');
});

test('/kategoria adds a category through the service, refuses a duplicate, and /cofnij removes it', async ({ page }) => {
  const account = await moneyAccount('exus-category');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/kategoria Sport');
  await expect(replies.last()).toHaveText('Kategoria dodana: Sport');
  await expect.poll(async () => (await moneyState(account.uid)).categories).toEqual(['Sport', 'gry', 'jedzenie', 'kieszonkowe'].sort());
  await send(page, '/kategoria sport');
  await expect(replies.last()).toHaveText('Taka kategoria już istnieje.');
  await send(page, '/kategoria');
  await expect(replies.last()).toContainText('Brakuje: nazwa.');
  expect((await moneyState(account.uid)).categories).toHaveLength(4);

  await send(page, '/cofnij');
  await expect(log(page)).toContainText('Cofnięto: kategoria „Sport”.');
  await expect.poll(async () => (await moneyState(account.uid)).categories).toEqual(['gry', 'jedzenie', 'kieszonkowe']);
});

test('/usun-transakcje asks first; Anuluj changes nothing, Wykonaj deletes the newest and reverses it', async ({ page }) => {
  const account = await moneyAccount('exus-delete-tx');
  const user = db.doc(`users/${account.uid}`);
  const before = await moneyState(account.uid);
  // The state after a lunch of 5 zł that cost 50 points, as the screen leaves it.
  await user.collection('moneyTransactions').add({ ...lunch(), createdAt: new Date() });
  await user.collection('money').doc('balance').set({ current: 45 });
  await user.update({ 'points.total': 70, 'points.spentAllTime': 60 });
  await openSignedIn(page, account, '#/exus');
  const dialog = page.getByRole('alertdialog');

  await send(page, '/usun-transakcje');
  await expect(dialog).toContainText('Wykonać /usun-transakcje?');
  await expect(dialog).toContainText('Usuniesz: wydatek 5,00 zł (jedzenie, obiad)');
  await expect(dialog).toContainText('Saldo wzrośnie o 5,00 zł. 50 pkt wróci na konto.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(log(page)).toContainText('Anulowano, nic się nie zmieniło.');
  expect(await moneyState(account.uid)).toEqual(afterLunch(before));

  await send(page, '/usun-transakcje ostatnia');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Usunięto: wydatek 5,00 zł (jedzenie, obiad)');
  await expect.poll(() => moneyState(account.uid)).toEqual(before);
});

test('/usun-transakcje with no transactions says so at once, without a question', async ({ page }) => {
  const account = await moneyAccount('exus-delete-none');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/usun-transakcje');
  await expect(log(page)).toContainText('Nie ma żadnych transakcji.');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await send(page, '/cofnij');
  await expect(log(page)).toContainText('Nie ma nic do cofnięcia.');
});

test('/usun-transakcje takes a text for the transaction; an income that the balance no longer covers stays', async ({ page }) => {
  const account = await moneyAccount('exus-delete-income');
  const user = db.doc(`users/${account.uid}`);
  await user.collection('moneyTransactions').add({ type: 'income', amount: 80, category: 'kieszonkowe', note: 'babcia', date: utcToday(), source: 'manual', pointsCost: 0, createdAt: new Date(1000) });
  await user.collection('moneyTransactions').add({ ...lunch(), createdAt: new Date(2000) });
  await user.update({ moneyIncomeAllTime: 80 });
  await openSignedIn(page, account, '#/exus');
  const dialog = page.getByRole('alertdialog');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/usun-transakcje czwartek');
  await expect(replies.last()).toContainText('Nie ma transakcji „czwartek”.');
  await send(page, '/usun-transakcje babcia');
  await expect(dialog).toContainText('Usuniesz: wpływ 80,00 zł (kieszonkowe, babcia)');
  await expect(dialog).toContainText('Saldo zmaleje o 80,00 zł.');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  // The balance is 50 zł: the income cannot be taken back, as on the screen.
  await expect(replies.last()).toHaveText('Nie można usunąć tego wpływu: saldo spadłoby poniżej zera.');
  expect((await moneyState(account.uid)).transactions).toHaveLength(2);
});

test('with Money off, the money commands are gone from the palette and unknown to Ex-us', async ({ page }) => {
  const account = await createUser({ tag: 'exus-no-money', profile: { enabledModules: ['chores', 'stats', 'notes', 'aichat'] } });
  await openSignedIn(page, account, '#/exus');
  const field = page.getByLabel('Wiadomość do Ex-us');
  const list = page.getByRole('list', { name: 'Komendy pasujące do wpisu' });
  await field.fill('/');
  await expect(list.getByRole('button')).toHaveCount(9);
  await field.fill('/wyd');
  await expect(list).toHaveCount(0);
  for (const command of ['/wydatek 5 gry', '/wplyw 5 gry', '/saldo', '/kategoria Sport', '/usun-transakcje']) {
    await send(page, command);
    await expect(page.locator('.exus-msg--exus').last()).toContainText(`Nie znam komendy ${command.split(' ')[0]}.`);
  }
  await send(page, '/pomoc');
  await expect(log(page)).toContainText('/cele — Cele i postęp');
  await expect(log(page)).not.toContainText('Saldo, wydatki');
});
