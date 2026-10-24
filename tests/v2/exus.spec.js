// Ex-us slash commands (docs/v2/PLAN.md 6, stage 5a) on the Firebase emulators:
// read and run locally, through the same services as the screens, no backend call.
const { Timestamp } = require('firebase-admin/firestore');
const { createUser, db, todayUtcKey } = require('../support/emulator');
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
  await expect(log(page)).toContainText('/obowiazek <obowiązek> [dzis|wczoraj] — Zapisz zrobiony obowiązek');
  await expect(log(page)).toContainText('/obowiazki — Obowiązki: zrobione dziś');
  await expect(log(page)).toContainText('/rozlicz — Rozlicz wypłatę');
  await expect(log(page)).toContainText('/aktywnosc <rodzaj> <czas> [opis] — Zapisz aktywność');
  await expect(log(page)).toContainText('/seria — Seria dni z punktami');
  await expect(log(page)).toContainText('/statystyki [7d|30d] — Punkty i czas aktywności');
  await expect(log(page)).toContainText('/co-teraz <czas> — Co teraz?');
  await expect(log(page)).toContainText('/zrobione <zadanie> — Oznacz zadanie jako zrobione');
  await expect(log(page)).toContainText('/zadania [dzis|zalegle|wszystkie] — Zadania');
  await expect(log(page)).toContainText('/edytuj-zadanie <zadanie> [tresc=…] [termin=…] [rozmiar=…] — Zmień treść, termin albo rozmiar zadania');
  await expect(log(page)).toContainText('/usun-zadanie <zadanie> — Usuń zadanie');
  await expect(log(page)).toContainText('/notatka <tytuł> [treść] — Nowa notatka');
  await expect(log(page)).toContainText('/archiwizuj <notatka> — Przenieś notatkę do archiwum');
  await expect(log(page)).toContainText('/szukaj <fraza> — Szukaj w tytułach i treści notatek');
  await expect(log(page)).toContainText('/limit <pkt> — Dzienny limit punktów');
  await expect(log(page)).toContainText('/jezyk <pl|en> — Język aplikacji');
  await expect(log(page)).toContainText('/motyw [lifexp|ios|gold] [jasny|ciemny|system] — Motyw');
  await expect(log(page)).toContainText('/modul <moduł> <on|off> — Włącz albo wyłącz moduł');
  await expect(log(page)).toContainText('/idz <ekran> — Przejdź do ekranu');
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
  await expect(list.getByRole('button')).toHaveCount(33);
  await field.fill('/za');
  await expect(list.getByRole('button')).toHaveCount(4);
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
  await expect(list.getByRole('button')).toHaveCount(28);
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

// ── Stage 5a-7: /cel count, money before date, chores and XP ──

test('/cel counts the goals from the transaction: two quick commands under a CPU 6 times slower say 1 and 2', async ({ page }) => {
  const account = await goalsAccount('exus-goals-slow');
  await openSignedIn(page, account, '#/exus');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  // The second is typed before the first has answered, so both read the same profile snapshot.
  await send(page, '/cel Pierwszy 10 zł');
  await send(page, '/cel Drugi 20 zł');
  await expect(log(page)).toContainText('(celów: 1 z 3)');
  await expect(log(page)).toContainText('(celów: 2 z 3)');
  await expect(log(page)).not.toContainText('(celów: 3 z 3)');
  await expect.poll(async () => (await goalsOf(account.uid)).length).toBe(2);
});

test('/wydatek 5.10 is 5,10 zł today, not 5 October; a date is written in full (12.10.2026 or 2026-10-12)', async ({ page }) => {
  const account = await moneyAccount('exus-expense-dot');
  const before = await moneyState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/wydatek 5.10 jedzenie');
  await expect(replies.last()).toContainText('Zapisano wydatek 5,10 zł w kategorii „jedzenie”');
  await expect(replies.last()).toContainText('−51 pkt');
  const after = await expect
    .poll(async () => (await moneyState(account.uid)).transactions.length)
    .toBe(1)
    .then(() => moneyState(account.uid));
  expect(after.transactions).toEqual([{ type: 'expense', amount: 5.1, category: 'jedzenie', note: '', date: utcToday(), source: 'manual', pointsCost: 51 }]);
  expect(after.balance).toEqual({ current: 44.9 });
  expect(after.points).toEqual({ total: 69, earnedAllTime: 300, spentAllTime: 61 });

  await send(page, '/cofnij');
  await expect.poll(() => moneyState(account.uid)).toEqual(before);

  await send(page, '/wplyw 12.10 kieszonkowe 2026-10-12');
  await expect(replies.last()).toContainText('Zapisano wpływ 12,10 zł w kategorii „kieszonkowe” (12 października)');
  await expect.poll(async () => (await moneyState(account.uid)).transactions).toEqual([
    { type: 'income', amount: 12.1, category: 'kieszonkowe', note: '', date: '2026-10-12', source: 'manual', pointsCost: 0 },
  ]);
});

// ── Chores ──

/** The local calendar day (v1 dateISOLocal), moved by `offset` days. */
function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CHORE_DEFS = [
  ['dishwasher', 'Opróżnienie zmywarki', '🍽️', 15, false],
  ['vacuum_stairs', 'Odkurzanie schodów', '🧹', 5, false],
  ['vacuum_hall', 'Odkurzanie przedpokoju', '🧹', 8, false],
  ['windows_once', 'Mycie okien', '🪟', 20, true],
];
const choreEntriesOf = (uid) => db.collection(`users/${uid}/chores`);
const choreDefsOf = (uid) => db.collection(`users/${uid}/choreDefs`);

async function choresAccount(tag, profile = {}) {
  const account = await createUser({ tag, profile });
  for (const [i, [id, name, emoji, points, oneTime]] of CHORE_DEFS.entries()) {
    await choreDefsOf(account.uid).doc(id).set({ name, desc: '', emoji, points, oneTime, order: i });
  }
  return account;
}

function addChoreEntry(uid, choreId, dateISO) {
  const [, name, emoji, points] = CHORE_DEFS.find((d) => d[0] === choreId);
  return choreEntriesOf(uid).add({ choreId, choreName: name, choreEmoji: emoji, points, dateISO, monthKey: dateISO.slice(0, 7), createdAt: new Date() });
}

/** The entries as the server has them, ids and creation times aside. */
async function choreEntries(uid) {
  return (await choreEntriesOf(uid).get()).docs.map((d) => {
    const { createdAt, ...rest } = d.data();
    return rest;
  });
}

const choreEntry = (choreId, dateISO) => {
  const [, choreName, choreEmoji, points] = CHORE_DEFS.find((d) => d[0] === choreId);
  return { choreId, choreName, choreEmoji, points, dateISO, monthKey: dateISO.slice(0, 7) };
};

test('/obowiazek writes the entry the Chores screen writes, for today or yesterday; /cofnij removes it', async ({ page }) => {
  const account = await choresAccount('exus-chore');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  // Typed at once, before the chores have loaded: the command waits for them.
  await send(page, '/obowiazek zmywarki');
  await expect(replies.last()).toHaveText('Zapisano obowiązek „Opróżnienie zmywarki” na dziś (+15 pkt).');
  await expect(page.getByText('Dodano: Opróżnienie zmywarki (+15 pkt)')).toBeVisible();
  await expect.poll(() => choreEntries(account.uid)).toEqual([choreEntry('dishwasher', localDay(0))]);

  await send(page, '/obowiazek "odkurzanie schodow" wczoraj');
  await expect(replies.last()).toContainText('Zapisano obowiązek „Odkurzanie schodów” na wczoraj');
  await expect.poll(async () => (await choreEntries(account.uid)).length).toBe(2);
  expect(await choreEntries(account.uid)).toContainEqual(choreEntry('vacuum_stairs', localDay(-1)));

  // /cofnij takes the newest (yesterday's) entry back and leaves the first.
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: obowiązek „Odkurzanie schodów”.');
  await expect.poll(() => choreEntries(account.uid)).toEqual([choreEntry('dishwasher', localDay(0))]);
});

test('/obowiazek: a one-time chore leaves the list and /cofnij brings it back; unknown and several fits are said', async ({ page }) => {
  const account = await choresAccount('exus-chore-once');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/obowiazek okien');
  await expect(replies.last()).toContainText('Zapisano obowiązek „Mycie okien” na dziś (+20 pkt). Był jednorazowy, więc zniknął z listy.');
  await expect.poll(async () => (await choreDefsOf(account.uid).doc('windows_once').get()).exists).toBe(false);
  await send(page, '/cofnij');
  await expect.poll(async () => (await choreDefsOf(account.uid).doc('windows_once').get()).exists).toBe(true);
  expect(await choreEntries(account.uid)).toEqual([]);

  await send(page, '/obowiazek odkurzanie');
  await expect(replies.last()).toContainText('Pasuje kilka obowiązków: „Odkurzanie schodów”, „Odkurzanie przedpokoju”.');
  await send(page, '/obowiazek latanie');
  await expect(replies.last()).toContainText('Nie ma obowiązku „latanie”.');
  await send(page, '/obowiazek');
  await expect(replies.last()).toContainText('Brakuje: obowiązek.');
  expect(await choreEntries(account.uid)).toEqual([]);
});

test('/obowiazki tells what is done today, what is to be paid out at the rate, and the entries of the month', async ({ page }) => {
  const account = await choresAccount('exus-chores-overview');
  for (const id of ['dishwasher', 'vacuum_stairs', 'vacuum_stairs']) await addChoreEntry(account.uid, id, localDay(0));
  await openSignedIn(page, account, '#/exus');

  await send(page, '/obowiazki');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('Dziś zrobione: Opróżnienie zmywarki (+15 pkt); Odkurzanie schodów ×2 (+10 pkt).');
  await expect(reply).toContainText('Do wypłaty: 25 pkt, czyli 11,25 zł (1 pkt = 0,45 zł).');
  await expect(reply).toContainText('Wpisy w tym miesiącu: 3.');
});

test('/obowiazki on a clean account says nothing is done', async ({ page }) => {
  const account = await choresAccount('exus-chores-empty');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/obowiazki');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('Dziś nic jeszcze nie zapisano.');
  await expect(reply).toContainText('Do wypłaty: 0 pkt, czyli 0,00 zł');
  await expect(reply).toContainText('Wpisy w tym miesiącu: 0.');
});

/** The payout test of chores.spec: two unpaid entries (10 + 30 pts), a 50,00 zł balance. */
async function payoutAccount(tag) {
  const account = await choresAccount(tag);
  const user = db.doc(`users/${account.uid}`);
  await user.collection('money').doc('balance').set({ current: 50, currency: 'PLN', monthlyLimit: 0 });
  await choreEntriesOf(account.uid).add({
    choreId: 'x10', choreName: 'Dziesięć', choreEmoji: '🧹', points: 10, dateISO: localDay(0), monthKey: localDay(0).slice(0, 7), createdAt: new Date(),
  });
  await choreEntriesOf(account.uid).add({
    choreId: 'x30', choreName: 'Trzydzieści', choreEmoji: '🧽', points: 30, dateISO: localDay(-2), monthKey: localDay(-2).slice(0, 7), createdAt: new Date(),
  });
  return account;
}

async function payoutState(uid) {
  const user = db.doc(`users/${uid}`);
  const strip = (docs) => docs.map((d) => {
    const { createdAt, ...rest } = d.data();
    return rest;
  });
  return {
    payouts: strip((await user.collection('chorePayouts').get()).docs),
    entries: (await choreEntriesOf(uid).get()).size,
    balance: (await user.collection('money').doc('balance').get()).data(),
    transactions: strip((await user.collection('moneyTransactions').get()).docs),
    moneyIncomeAllTime: (await user.get()).data().moneyIncomeAllTime ?? null,
  };
}

test('/rozlicz asks first; Anuluj changes nothing, Wykonaj settles into Money in one go, with no undo', async ({ page }) => {
  const account = await payoutAccount('exus-settle');
  await openSignedIn(page, account, '#/exus');
  // Opening Ex-us prepares the Money account (the income counter starts at 0, as opening Money does).
  await expect.poll(async () => (await payoutState(account.uid)).moneyIncomeAllTime).toBe(0);
  const before = await payoutState(account.uid);
  const dialog = page.getByRole('alertdialog');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/rozlicz');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Wykonać /rozlicz?');
  await expect(dialog).toContainText('Rozliczysz 40 pkt z wpisów: 2. Kwota 18,00 zł wpłynie na saldo w Pieniądzach jako wpływ w kategorii „Obowiązki domowe”');
  await expect(dialog).toContainText('Tego nie da się cofnąć.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(replies.last()).toContainText('Anulowano, nic się nie zmieniło.');
  expect(await payoutState(account.uid)).toEqual(before);

  await send(page, '/rozlicz');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toHaveText('Rozliczono 40 pkt: 18,00 zł wpłynęło na saldo w Pieniądzach.');
  await expect(page.getByText('Rozliczono 18,00 zł')).toBeVisible();
  // The documents of chores.spec's payout test.
  expect(await payoutState(account.uid)).toEqual({
    payouts: [{ points: 40, amountPln: 18, fromISO: localDay(-2), toISO: localDay(0) }],
    entries: 0,
    balance: { current: 68, currency: 'PLN', monthlyLimit: 0 },
    transactions: [{ type: 'income', amount: 18, category: 'Obowiązki domowe', note: '', date: utcToday(), source: 'chore_payout' }],
    moneyIncomeAllTime: 18,
  });
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');

  // Nothing left: said at once, no question.
  await send(page, '/rozlicz');
  await expect(replies.last()).toHaveText('Nie ma nic do rozliczenia.');
  await expect(dialog).toBeHidden();
});

// ── XP and activities ──

/** G1.2's account: 130 of the 150 points of today already earned. */
async function cappedAccount(tag, { earnedToday = 130 } = {}) {
  const account = await createUser({ tag, profile: { points: { total: 120, earnedAllTime: 620, spentAllTime: 0 }, dailyLimit: 150 } });
  if (earnedToday > 0) await db.doc(`users/${account.uid}/dailyLog/${todayUtcKey()}`).set({ pointsEarned: earnedToday, gamingMinutes: 0 });
  return account;
}

/** What an activity changes, once it reached the server (timestamps and ids aside). */
async function activityState(uid) {
  const user = db.doc(`users/${uid}`);
  const activities = (await user.collection('activities').get()).docs.map((d) => {
    const { timestamp, ...rest } = d.data();
    expect(timestamp).toBeInstanceOf(Timestamp);
    return rest;
  });
  return {
    points: (await user.get()).data().points,
    day: (await user.collection('dailyLog').doc(todayUtcKey()).get()).data() ?? null,
    activities,
    defs: (await user.collection('activityDefs').get()).docs.map((d) => d.id).sort(),
  };
}

test('/aktywnosc nauka 60 credits what is left of the limit as G1.2 does, seeds the types, and /cofnij takes the points back', async ({ page }) => {
  const account = await cappedAccount('exus-activity-cap');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/aktywnosc nauka 60');
  await expect(replies.last()).toHaveText(
    'Zapisano aktywność „Nauka (JS, Unity, C#)” (1 h): +20 pkt. Czas był wart 40 pkt, ale do dziennego limitu 150 pkt zostało 20.',
  );
  await expect(page.getByText('+20 pkt za: Nauka (JS, Unity, C#)')).toBeVisible();
  await expect.poll(() => activityState(account.uid)).toEqual({
    points: { total: 140, earnedAllTime: 640, spentAllTime: 0 },
    day: { pointsEarned: 150, gamingMinutes: 0 },
    activities: [{ type: 'learning', duration: 60, points: 20, desc: '' }],
    defs: ['exercise', 'learning', 'project', 'reading', 'school'],
  });

  // The day is full now: nothing more is credited or written.
  await send(page, '/aktywnosc nauka 30');
  await expect(replies.last()).toHaveText('Dzienny limit 150 pkt jest już osiągnięty. Ta aktywność nie da dziś punktów. Nic nie zapisano.');
  expect((await activityState(account.uid)).activities).toHaveLength(1);

  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: aktywność „Nauka (JS, Unity, C#)” (−20 pkt).');
  await expect.poll(() => activityState(account.uid)).toEqual({
    points: { total: 120, earnedAllTime: 620, spentAllTime: 0 },
    day: { pointsEarned: 130, gamingMinutes: 0 },
    activities: [],
    defs: ['exercise', 'learning', 'project', 'reading', 'school'],
  });
});

test('/aktywnosc takes the time anywhere and the rest as the note; a type, a time and 5 minutes are asked for', async ({ page }) => {
  const account = await cappedAccount('exus-activity-note', { earnedToday: 0 });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/aktywnosc 1h30 ćwiczenia trening nóg');
  await expect(replies.last()).toHaveText('Zapisano aktywność „Ćwiczenia fizyczne” (1 h 30 min): +45 pkt.');
  await expect.poll(async () => (await activityState(account.uid)).activities).toEqual([
    { type: 'exercise', duration: 90, points: 45, desc: 'trening nóg' },
  ]);
  await expect(page.getByText('+45 pkt za: Ćwiczenia fizyczne')).toBeVisible();

  await send(page, '/aktywnosc latanie 30');
  await expect(replies.last()).toContainText('Nie ma rodzaju aktywności „latanie”. Masz: „Nauka (JS, Unity, C#)”');
  await send(page, '/aktywnosc nauka');
  await expect(replies.last()).toContainText('Brakuje: czas.');
  await send(page, '/aktywnosc 30');
  await expect(replies.last()).toContainText('Brakuje: rodzaj aktywności.');
  await send(page, '/aktywnosc nauka 4');
  await expect(replies.last()).toHaveText('Co najmniej 5 minut.');
  expect((await activityState(account.uid)).activities).toHaveLength(1);
});

function utcDaysAgo(n) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

async function logDays(uid, logs) {
  for (const [ago, [pointsEarned, gamingMinutes]] of Object.entries(logs)) {
    await db.doc(`users/${uid}/dailyLog/${utcDaysAgo(Number(ago))}`).set({ pointsEarned, gamingMinutes });
  }
}

test('/seria gives the days of the streak and the freeze, as the streak card on Today does', async ({ page }) => {
  // Three days in a row; the freeze was used three days ago, so it is still waiting.
  const account = await createUser({ tag: 'exus-streak', profile: { streakFreezeLastUsed: utcDaysAgo(3) } });
  await logDays(account.uid, { 0: [95, 0], 1: [40, 0], 2: [30, 0] });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/seria');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('3 dni z rzędu');
  await expect(reply).toContainText('Zamrożenie serii wróci po 7 dniach od ostatniego użycia.');

  await page.goto(page.url().replace('#/exus', '#/today'));
  await expect(page.getByTestId('streak')).toHaveText('3 dni z rzędu');
});

test('/seria with no points says so, and the freeze is there', async ({ page }) => {
  const account = await createUser({ tag: 'exus-streak-none' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/seria');
  const reply = page.locator('.exus-msg--exus').last();
  await expect(reply).toContainText('Zdobądź dziś punkty, żeby zacząć serię');
  await expect(reply).toContainText('Masz zamrożenie serii');
});

test('/statystyki gives the points, the activity time and the top activity of 7 or 30 days', async ({ page }) => {
  const account = await createUser({ tag: 'exus-stats', profile: { dailyLimit: 150 } });
  const user = db.doc(`users/${account.uid}`);
  await logDays(account.uid, { 0: [95, 45], 1: [40, 0], 2: [30, 0], 4: [20, 0], 10: [50, 0] });
  await user.collection('activityDefs').doc('learning').set({ name: 'Nauka', points: 40, color: '#6c63ff', icon: 'ti-book', order: 0 });
  const at = (ms) => Timestamp.fromDate(new Date(Date.now() - ms));
  await user.collection('activities').add({ type: 'learning', duration: 60, points: 40, desc: '', timestamp: at(60 * 60 * 1000) });
  await user.collection('activities').add({ type: 'custom_type', duration: 30, points: 15, desc: 'rozdział 3', timestamp: at(2 * 60 * 60 * 1000) });
  await user.collection('activities').add({ type: 'learning', duration: 45, points: 30, desc: '', timestamp: at(10 * 24 * 60 * 60 * 1000) });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/statystyki');
  await expect(replies.last()).toHaveText(
    'Punkty z ostatnich 7 dni: 185.\nCzas aktywności: 1 h 30 min.\nGranie: 45 min.\nNajczęstsza aktywność: Nauka (1×).',
  );
  await send(page, '/statystyki 30d');
  await expect(replies.last()).toHaveText(
    'Punkty z ostatnich 30 dni: 235.\nCzas aktywności: 2 h 15 min.\nGranie: 45 min.\nNajczęstsza aktywność: Nauka (2×).',
  );
});

test('/statystyki on a clean account says there is nothing yet', async ({ page }) => {
  const account = await createUser({ tag: 'exus-stats-empty' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/statystyki 7d');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText(
    'Punkty z ostatnich 7 dni: 0.\nCzas aktywności: 0 min.\nGranie: 0 min.\nBrak danych. Zaloguj kilka aktywności!',
  );
});

test('/co-teraz 30 picks an idea and what it would give, and writes nothing', async ({ page }) => {
  const account = await cappedAccount('exus-whatnow', { earnedToday: 0 });
  const before = await activityState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/co-teraz 30');
  await expect(replies.last()).toContainText(/^Wylosowano: .+ \(30 min\)\.\nDostaniesz \d+ pkt\.$/);
  await send(page, '/co-teraz 3');
  await expect(replies.last()).toHaveText('Co najmniej 5 minut.');
  await send(page, '/co-teraz');
  await expect(replies.last()).toContainText('Brakuje: czas.');
  expect(await activityState(account.uid)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
});

test('/co-teraz with the daily limit full says that nothing would be credited', async ({ page }) => {
  const account = await cappedAccount('exus-whatnow-full', { earnedToday: 150 });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/co-teraz 1h');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Dzienny limit 150 pkt jest już osiągnięty.');
});

test('with Chores or Statistics XP off, their commands are gone from the palette, the help and Ex-us', async ({ page }) => {
  const account = await createUser({ tag: 'exus-no-chores-stats', profile: { enabledModules: ['money', 'notes', 'aichat', 'games'] } });
  await openSignedIn(page, account, '#/exus');
  const field = page.getByLabel('Wiadomość do Ex-us');
  const list = page.getByRole('list', { name: 'Komendy pasujące do wpisu' });
  await field.fill('/');
  await expect(list.getByRole('button')).toHaveCount(26);
  for (const prefix of ['/obow', '/rozl', '/akty', '/ser', '/staty', '/co-']) {
    await field.fill(prefix);
    await expect(list).toHaveCount(0);
  }
  for (const command of ['/obowiazek zmywarki', '/obowiazki', '/rozlicz', '/aktywnosc nauka 60', '/seria', '/statystyki', '/co-teraz 30']) {
    await send(page, command);
    await expect(page.locator('.exus-msg--exus').last()).toContainText(`Nie znam komendy ${command.split(' ')[0]}.`);
  }
  await send(page, '/pomoc');
  const help = page.locator('.exus-msg--exus').last();
  await expect(help).toContainText('/saldo — Saldo, wydatki');
  await expect(help).not.toContainText('/obowiazek');
  await expect(help).not.toContainText('/aktywnosc');
});

test('with only Chores off, the XP commands stay', async ({ page }) => {
  const noChores = await createUser({ tag: 'exus-no-chores', profile: { enabledModules: ['money', 'notes', 'aichat', 'games', 'stats'] } });
  await openSignedIn(page, noChores, '#/exus');
  await send(page, '/seria');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Zdobądź dziś punkty');
  await send(page, '/obowiazki');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Nie znam komendy /obowiazki.');
});

test('with only Statistics XP off, the chore commands stay', async ({ page }) => {
  const noStats = await createUser({ tag: 'exus-no-stats', profile: { enabledModules: ['money', 'notes', 'aichat', 'games', 'chores'] } });
  await openSignedIn(page, noStats, '#/exus');
  await send(page, '/obowiazki');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Dziś nic jeszcze nie zapisano.');
  await send(page, '/seria');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Nie znam komendy /seria.');
});

// ── Stage 5a-8: tasks, notes, settings and navigation ──

const ORDER = ['case', 'motherboard', 'gpu', 'cpu', 'psu', 'ram'];
const build = (pieces, current) => ({
  componentOrder: ORDER,
  progress: Object.fromEntries(ORDER.map((c, i) => [c, pieces[i] ?? 0])),
  currentComponentIndex: current,
});
const userDoc = (uid) => db.doc(`users/${uid}`);
const pcBuildOf = async (uid) => (await userDoc(uid).get()).data().pcBuild;

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

const replies = (page) => page.locator('.exus-msg--exus');

test('/zrobione writes what the Tasks screen writes: done, and the pieces of the PC build', async ({ page }) => {
  const account = await createUser({ tag: 'exus-complete', profile: { pcBuild: build([2], 0) } });
  const task = await seedTask(account.uid, { text: 'Duże zadanie', size: 'L' });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/zrobione duże');
  await expect(replies(page).last()).toHaveText('Zrobione: „Duże zadanie”. Nieźle — +3 kawałki do budowy.');
  await expect.poll(async () => (await task.get()).data().done).toBe(true);
  expect(await pcBuildOf(account.uid)).toEqual(build([3, 0], 1));
  // Done is final: there is nothing to take it back with.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies(page).last()).toHaveText('Nie ma nic do cofnięcia.');

  // A done task is no longer there to be done again; a name no task has is said.
  await send(page, '/zrobione duże');
  await expect(replies(page).last()).toContainText('Nie ma otwartego zadania „duże”.');
  await send(page, '/zrobione statek');
  await expect(replies(page).last()).toContainText('Nie ma otwartego zadania „statek”.');
  await send(page, '/zrobione');
  await expect(replies(page).last()).toContainText('Brakuje: zadanie.');
});

test('/zrobione after the due day gives no pieces (G9.3); several fits are listed', async ({ page }) => {
  const account = await createUser({ tag: 'exus-complete-late', profile: { pcBuild: build([3, 1], 1) } });
  const late = await seedTask(account.uid, { text: 'Kupić mleko', dueDate: localDay(-2), penaltyApplied: true });
  await seedTask(account.uid, { text: 'Kupić chleb' });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/zrobione kupić');
  await expect(replies(page).last()).toContainText('Pasuje kilka zadań: ');
  await expect(replies(page).last()).toContainText('„Kupić mleko”');
  await expect(replies(page).last()).toContainText('„Kupić chleb”');
  await send(page, '/zrobione mleko');
  await expect(replies(page).last()).toHaveText('Zrobione: „Kupić mleko”. Zrobione, ale po terminie — tym razem bez kawałków.');
  await expect.poll(async () => (await late.get()).data().done).toBe(true);
  expect(await pcBuildOf(account.uid)).toEqual(build([3, 1], 1));
});

test('/zadania lists the open tasks of today and overdue by default, or by word, with due dates and sizes', async ({ page }) => {
  const account = await createUser({ tag: 'exus-tasks-list' });
  await seedTask(account.uid, { text: 'Zaległe', dueDate: localDay(-2) });
  await seedTask(account.uid, { text: 'Na dziś', size: 'L' });
  await seedTask(account.uid, { text: 'Za trzy dni', dueDate: localDay(3), size: 'M' });
  await seedTask(account.uid, { text: 'Skończone', dueDate: localDay(-5), done: true });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/zadania');
  const reply = replies(page).last();
  await expect(reply).toContainText('Na dziś i zaległe (2):');
  await expect(reply).toContainText('• Zaległe — zaległe od');
  await expect(reply).toContainText('• Na dziś — na dziś, L');
  await expect(reply).not.toContainText('Za trzy dni');
  await expect(reply).not.toContainText('Skończone');

  await send(page, '/zadania wszystkie');
  await expect(replies(page).last()).toContainText('Otwarte zadania (3):');
  await expect(replies(page).last()).toContainText('• Za trzy dni — do');
  await expect(replies(page).last()).not.toContainText('Skończone');
  await send(page, '/zadania zalegle');
  await expect(replies(page).last()).toContainText('Zaległe (1):');
  await send(page, '/zadania dzis');
  await expect(replies(page).last()).toContainText('Na dziś (1):');
  await expect(replies(page).last()).not.toContainText('Zaległe —');
});

test('/zadania on a clean account says there is nothing', async ({ page }) => {
  const account = await createUser({ tag: 'exus-tasks-none' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/zadania');
  await expect(replies(page).last()).toHaveText('Nic na dziś ani zaległego.');
  await send(page, '/zadania wszystkie');
  await expect(replies(page).last()).toHaveText('Nie ma otwartych zadań.');
});

test('/edytuj-zadanie changes what is named through the same checks; "Cofnij" restores the old values', async ({ page }) => {
  const account = await createUser({ tag: 'exus-edit-task' });
  const ref = await seedTask(account.uid, { text: 'Stary opis', dueDate: localDay(3), size: 'S' });
  const original = (await ref.get()).data();
  await openSignedIn(page, account, '#/exus');

  await send(page, '/edytuj-zadanie stary');
  await expect(replies(page).last()).toContainText('Podaj, co zmienić: treść, termin albo rozmiar.');
  await send(page, '/edytuj-zadanie stary termin=2020-01-01');
  await expect(replies(page).last()).toHaveText('Termin nie może być w przeszłości.');
  await send(page, '/edytuj-zadanie stary rozmiar=XL');
  await expect(replies(page).last()).toContainText('Nie rozumiem: rozmiar.');
  expect((await ref.get()).data()).toEqual(original);

  await send(page, '/edytuj-zadanie stary tresc="Nowy opis" termin=+4d rozmiar=l');
  await expect(replies(page).last()).toContainText('Zmieniono zadanie „Nowy opis”');
  await expect(replies(page).last()).toContainText('rozmiar L.');
  await expect.poll(async () => (await ref.get()).data()).toEqual({ ...original, text: 'Nowy opis', dueDate: localDay(4), size: 'L' });
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(log(page)).toContainText('Cofnięto: zmiana zadania „Stary opis”.');
  await expect.poll(async () => (await ref.get()).data()).toEqual(original);
});

test('/edytuj-zadanie on an overdue task asks for a new due date, as the sheet does', async ({ page }) => {
  const account = await createUser({ tag: 'exus-edit-overdue' });
  const ref = await seedTask(account.uid, { text: 'Zaległe', dueDate: localDay(-1), penaltyApplied: true });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/edytuj-zadanie zaległe rozmiar=M');
  await expect(replies(page).last()).toContainText('to zadanie jest zaległe. Podaj nowy termin, np. termin=jutro.');
  expect((await ref.get()).data().size).toBe('S');

  await send(page, '/edytuj-zadanie zaległe termin=jutro rozmiar=M');
  await expect.poll(async () => (await ref.get()).data()).toMatchObject({ dueDate: localDay(1), size: 'M' });
  // The old due date has passed, so the service would refuse to put it back: no undo is offered.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
});

test('/usun-zadanie asks first; Anuluj changes nothing, Wykonaj deletes the task and leaves the PC build', async ({ page }) => {
  const account = await createUser({ tag: 'exus-delete-task', profile: { pcBuild: build([2], 0) } });
  const ref = await seedTask(account.uid, { text: 'Do usunięcia' });
  await openSignedIn(page, account, '#/exus');
  const dialog = page.getByRole('alertdialog');

  await send(page, '/usun-zadanie usun');
  await expect(dialog).toContainText('Wykonać /usun-zadanie?');
  await expect(dialog).toContainText('Zadanie „Do usunięcia” zniknie z listy. Budowa PC zostaje bez zmian.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(log(page)).toContainText('Anulowano, nic się nie zmieniło.');
  expect((await ref.get()).exists).toBe(true);

  await send(page, '/usun-zadanie "do usunięcia"');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Usunięto zadanie „Do usunięcia”.');
  await expect.poll(async () => (await ref.get()).exists).toBe(false);
  expect(await pcBuildOf(account.uid)).toEqual(build([2], 0));
  // A destructive command asked first and is not on the undo stack.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies(page).last()).toHaveText('Nie ma nic do cofnięcia.');

  await send(page, '/usun-zadanie statek');
  await expect(replies(page).last()).toContainText('Nie ma otwartego zadania „statek”.');
  await expect(dialog).toBeHidden();
});

const notesOf = async (uid) => (await db.collection(`users/${uid}/notes`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const withoutId = ({ id, createdAt, ...rest }) => rest;

test('/notatka writes a note like the editor; /szukaj finds it; /archiwizuj archives it and "Cofnij" restores it', async ({ page }) => {
  const account = await createUser({ tag: 'exus-notes' });
  await db.collection(`users/${account.uid}/notes`).add({
    title: 'Żółw',
    content: 'Pancerz i **sałata**',
    icon: '',
    color: '',
    createdAt: new Date().toISOString(),
    archived: false,
  });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/notatka');
  await expect(replies(page).last()).toContainText('Brakuje: tytuł.');
  await send(page, '/notatka Zakupy mleko i chleb');
  await expect(replies(page).last()).toHaveText('Dodano notatkę „Zakupy” (aktywnych: 2 z 30).');
  await expect.poll(async () => (await notesOf(account.uid)).length).toBe(2);
  const note = (await notesOf(account.uid)).find((n) => n.title === 'Zakupy');
  expect(withoutId(note)).toEqual({ title: 'Zakupy', content: 'mleko i chleb', icon: '', color: '', archived: false });
  expect(Number.isNaN(Date.parse(note.createdAt))).toBe(false);

  await send(page, '/szukaj CHLEB');
  await expect(replies(page).last()).toContainText('Pasujące notatki: 1.');
  await expect(replies(page).last()).toContainText('• Zakupy — mleko i chleb');
  await send(page, '/szukaj zolw salata');
  await expect(replies(page).last()).toContainText('• Żółw — Pancerz i sałata');
  await send(page, '/szukaj kosmos');
  await expect(replies(page).last()).toHaveText('Żadna notatka nie pasuje do „kosmos”.');
  await send(page, '/szukaj');
  await expect(replies(page).last()).toContainText('Brakuje: fraza.');

  await send(page, '/archiwizuj zakup');
  await expect(replies(page).last()).toHaveText('Zarchiwizowano notatkę „Zakupy”.');
  await expect.poll(async () => (await notesOf(account.uid)).find((n) => n.title === 'Zakupy').archived).toBe(true);
  await send(page, '/szukaj chleb');
  await expect(replies(page).last()).toContainText('• Zakupy [W archiwum] — mleko i chleb');
  await send(page, '/archiwizuj zakupy');
  await expect(replies(page).last()).toContainText('Nie ma aktywnej notatki „zakupy”.');
  await page.locator('.ui-toast').filter({ hasText: 'Notatka zarchiwizowana.' }).getByRole('button', { name: 'Cofnij' }).click();
  await expect(log(page)).toContainText('Cofnięto: archiwizacja notatki „Zakupy”.');
  await expect.poll(async () => (await notesOf(account.uid)).find((n) => n.title === 'Zakupy').archived).toBe(false);
});

test('/notatka with the title in quotes; /cofnij removes the new note, unless it was edited since', async ({ page }) => {
  const account = await createUser({ tag: 'exus-note-undo' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/notatka "Lista zakupów" mleko');
  await expect(replies(page).last()).toContainText('Dodano notatkę „Lista zakupów”');
  await expect.poll(async () => (await notesOf(account.uid)).map(withoutId)).toEqual([
    { title: 'Lista zakupów', content: 'mleko', icon: '', color: '', archived: false },
  ]);
  await send(page, '/cofnij');
  await expect(replies(page).last()).toHaveText('Cofnięto: notatka „Lista zakupów”.');
  await expect.poll(async () => (await notesOf(account.uid)).length).toBe(0);

  await send(page, '/notatka Szkic');
  await expect.poll(async () => (await notesOf(account.uid)).length).toBe(1);
  const [{ id }] = await notesOf(account.uid);
  // Edited elsewhere in the meantime: the undo leaves the note alone.
  await db.doc(`users/${account.uid}/notes/${id}`).update({ content: 'dopisane gdzie indziej' });
  // Wait until Ex-us has seen the edit (the search reads the same notes as the undo does).
  await expect
    .poll(async () => {
      await send(page, '/szukaj dopisane');
      return replies(page).last().innerText();
    })
    .toContain('Pasujące notatki: 1');
  await send(page, '/cofnij');
  await expect(page.getByText('Nie udało się cofnąć.').first()).toBeVisible();
  expect((await notesOf(account.uid)).map(withoutId)).toEqual([
    { title: 'Szkic', content: 'dopisane gdzie indziej', icon: '', color: '', archived: false },
  ]);
});

test('the note commands are gone with Notes off', async ({ page }) => {
  const account = await createUser({ tag: 'exus-no-notes', profile: { enabledModules: ['chores', 'money', 'stats', 'aichat'] } });
  await openSignedIn(page, account, '#/exus');
  for (const command of ['/notatka Zakupy', '/archiwizuj zakupy', '/szukaj zakupy']) {
    await send(page, command);
    await expect(replies(page).last()).toContainText(`Nie znam komendy ${command.split(' ')[0]}.`);
  }
  await send(page, '/pomoc');
  await expect(replies(page).last()).not.toContainText('/szukaj');
  await expect(replies(page).last()).toContainText('/limit <pkt>');
});

test('/limit writes dailyLimit through the settings rule (50–500); "Cofnij" restores the old value', async ({ page }) => {
  const account = await createUser({ tag: 'exus-limit', profile: { dailyLimit: 150 } });
  const limitOf = async () => (await userDoc(account.uid).get()).data().dailyLimit;
  await openSignedIn(page, account, '#/exus');

  await send(page, '/limit 20');
  await expect(replies(page).last()).toHaveText('Wpisz liczbę od 50 do 500.');
  await send(page, '/limit 501');
  await expect(replies(page).last()).toHaveText('Wpisz liczbę od 50 do 500.');
  await send(page, '/limit');
  await expect(replies(page).last()).toContainText('Brakuje: limit (pkt).');
  expect(await limitOf()).toBe(150);

  await send(page, '/limit 120');
  await expect(replies(page).last()).toHaveText('Dzienny limit: 120 pkt (było 150 pkt).');
  await expect.poll(limitOf).toBe(120);
  await send(page, '/limit 120 pkt');
  await expect(replies(page).last()).toHaveText('Dzienny limit to już 120 pkt.');
  await send(page, '/limit 500');
  await expect.poll(limitOf).toBe(500);
  // Two in a row: each undo goes back to the value before its own command.
  await send(page, '/cofnij');
  await expect(replies(page).last()).toContainText('Cofnięto: limit 500 pkt (wraca 120 pkt).');
  await expect.poll(limitOf).toBe(120);
  await send(page, '/cofnij');
  await expect.poll(limitOf).toBe(150);
  await send(page, '/dzis');
  await expect(replies(page).last()).toContainText('limitu 150');
});

test('/jezyk en switches the whole app and the profile; the reply is in the new language', async ({ page }) => {
  const account = await createUser({ tag: 'exus-lang', profile: { lang: 'pl' } });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/jezyk en');
  await expect(replies(page).last()).toHaveText('Language changed: English.');
  await expect(page.getByLabel('Message to Ex-us')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(async () => (await userDoc(account.uid).get()).data().lang).toBe('en');
  expect(await page.evaluate(() => localStorage.getItem('lifexp-lang'))).toBe('en');

  await page.getByLabel('Message to Ex-us').fill('/lang en');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(replies(page).last()).toHaveText('The language is already English.');
  await page.getByLabel('Message to Ex-us').fill('/lang pl');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(replies(page).last()).toHaveText('Język zmieniony: Polski.');
  await expect(page.getByLabel('Wiadomość do Ex-us')).toBeVisible();
  await expect.poll(async () => (await userDoc(account.uid).get()).data().lang).toBe('pl');
});

test('/motyw sets the family and the mode like Wygląd, Gold stays dark, nothing named gets the syntax', async ({ page }) => {
  const account = await createUser({ tag: 'exus-theme' });
  await openSignedIn(page, account, '#/exus');
  const html = page.locator('html');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('lifexp-v2-theme')));

  await send(page, '/motyw jasny');
  await expect(html).toHaveAttribute('data-mode', 'light');
  await expect(html).toHaveAttribute('data-theme', 'lifexp');
  await expect(replies(page).last()).toHaveText('Motyw: LifeXP, Jasny. Wybór zostaje na tym urządzeniu.');
  expect(await stored()).toEqual({ family: 'lifexp', mode: 'light' });

  await send(page, '/motyw ios');
  await expect(html).toHaveAttribute('data-theme', 'ios');
  expect((await stored()).family).toBe('ios');
  await send(page, '/motyw ciemny ios');
  await expect(html).toHaveAttribute('data-mode', 'dark');

  await send(page, '/motyw gold jasny');
  await expect(replies(page).last()).toContainText('Motyw Gold nie ma trybu „Jasny”.');
  await expect(html).toHaveAttribute('data-theme', 'ios');
  await send(page, '/motyw gold');
  await expect(html).toHaveAttribute('data-theme', 'gold');
  await expect(html).toHaveAttribute('data-mode', 'dark');
  await send(page, '/motyw system');
  await expect(replies(page).last()).toContainText('Motyw Gold nie ma trybu „Jak system”.');

  await send(page, '/motyw');
  await expect(replies(page).last()).toContainText('Podaj motyw');
  // A theme is the device's own: nothing goes to the profile.
  expect((await userDoc(account.uid).get()).data().theme).toBeUndefined();
});

test('/modul pieniadze off hides Money and its commands; "Cofnij" brings it back; Ex-us stays', async ({ page }) => {
  const account = await createUser({ tag: 'exus-module' });
  await openSignedIn(page, account, '#/exus');
  const tabbar = page.locator('.tabbar');
  const modulesOf = async () => {
    const data = (await userDoc(account.uid).get()).data();
    return { enabled: data.enabledModules, disabled: data.disabledModules };
  };

  await send(page, '/modul pieniadze on');
  await expect(replies(page).last()).toHaveText('Moduł Pieniądze jest już włączony.');
  await send(page, '/modul pieniadze');
  await expect(replies(page).last()).toContainText('Brakuje: on albo off.');
  await send(page, '/modul ex-us off');
  await expect(replies(page).last()).toContainText('Ex-us nie wyłączy się sam z poziomu rozmowy.');
  await send(page, '/modul statek on');
  await expect(replies(page).last()).toContainText('Brakuje: moduł.');

  await send(page, '/modul Pieniądze off');
  await expect(replies(page).last()).toContainText('Moduł Pieniądze jest wyłączony. Dane zostają');
  await expect(tabbar.getByRole('link', { name: 'Pieniądze' })).toHaveCount(0);
  await expect.poll(async () => (await modulesOf()).disabled).toContain('money');
  expect((await modulesOf()).enabled).not.toContain('money');
  await send(page, '/saldo');
  await expect(replies(page).last()).toContainText('Nie znam komendy /saldo.');
  await send(page, '/modul pieniadze off');
  await expect(replies(page).last()).toHaveText('Moduł Pieniądze jest już wyłączony.');

  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(log(page)).toContainText('Cofnięto: przełączenie modułu Pieniądze.');
  await expect(tabbar.getByRole('link', { name: 'Pieniądze' })).toBeVisible();
  await expect.poll(async () => (await modulesOf()).enabled).toContain('money');
  await send(page, '/modul pieniadze off');
  await expect(tabbar.getByRole('link', { name: 'Pieniądze' })).toHaveCount(0);
  await send(page, '/modul money on');
  await expect(replies(page).last()).toHaveText('Moduł Pieniądze jest włączony.');
  // The commands follow the profile, which arrives a moment after the reply.
  await expect(tabbar.getByRole('link', { name: 'Pieniądze' })).toBeVisible();
  await send(page, '/saldo');
  await expect(replies(page).last()).toContainText('Saldo');
});

test('/idz opens a screen by name, with or without Polish letters, and honours the modules that are off', async ({ page }) => {
  const account = await createUser({ tag: 'exus-go', profile: { enabledModules: ['chores', 'notes', 'stats', 'aichat'] } });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/idz kosmos');
  await expect(replies(page).last()).toContainText('Nie znam ekranu „kosmos”.');
  await send(page, '/idz');
  await expect(replies(page).last()).toContainText('Brakuje: ekran.');
  await send(page, '/idz z');
  await expect(replies(page).last()).toContainText('Pasuje kilka ekranów: „Zadania”, „Zgłoszenia i aktualizacje”.');
  await send(page, '/idz pieniądze');
  await expect(replies(page).last()).toContainText('Ekran „Pieniądze” jest wyłączony.');
  await expect(page).toHaveURL(/#\/exus$/);

  await send(page, '/idz zadania');
  await expect(page).toHaveURL(/#\/tasks$/);
  await expect(page.getByRole('heading', { name: 'Zadania', level: 1 })).toBeVisible();
  await page.evaluate(() => (location.hash = '#/exus'));
  await send(page, '/idz obowiazki');
  await expect(page).toHaveURL(/#\/chores$/);
  await page.evaluate(() => (location.hash = '#/exus'));
  await send(page, '/idz ustawienia');
  await expect(page).toHaveURL(/#\/settings$/);
});

test('the task, note and settings commands wait for their data under a CPU 6 times slower, from a cold start', async ({ page }) => {
  const account = await createUser({ tag: 'exus-5a8-slow', profile: { pcBuild: build([0], 0), dailyLimit: 150 } });
  const task = await seedTask(account.uid, { text: 'Powolne zadanie', size: 'M' });
  await db.collection(`users/${account.uid}/notes`).add({
    title: 'Powolna notatka',
    content: 'treść',
    icon: '',
    color: '',
    createdAt: new Date().toISOString(),
    archived: false,
  });
  await openSignedIn(page, account, '#/exus');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  await send(page, '/szukaj powolna');
  await send(page, '/zadania');
  await send(page, '/zrobione powolne');
  await send(page, '/limit 100');
  await expect(log(page)).toContainText('• Powolna notatka — treść');
  await expect(log(page)).toContainText('• Powolne zadanie — na dziś, M');
  await expect(log(page)).toContainText('Zrobione: „Powolne zadanie”. Nieźle — +2 kawałki do budowy.');
  await expect(log(page)).toContainText('Dzienny limit: 100 pkt (było 150 pkt).');
  await expect.poll(async () => (await task.get()).data().done).toBe(true);
  await expect.poll(async () => (await userDoc(account.uid).get()).data().dailyLimit).toBe(100);
});
