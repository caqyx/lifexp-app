// Ex-us slash commands (docs/v2/PLAN.md 6, stage 5a) on the Firebase emulators:
// read and run locally, through the same services as the screens, no backend call.
const { Timestamp } = require('firebase-admin/firestore');
const { createUser, db, todayUtcKey } = require('../support/emulator');
const { test, expect, openSignedIn, signIn } = require('../support/v2');

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

/** The form card of a command with missing slots: the fields marked missing, and Wykonaj disabled until they are filled. */
async function expectCard(page, command, missing) {
  const card = page.getByRole('form', { name: `Uzupełnij /${command}` }).last();
  await expect(card).toBeVisible();
  for (const label of missing) await expect(card.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(card.getByRole('button', { name: 'Wykonaj' })).toBeDisabled();
  return card;
}

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
  await expect(log(page)).toContainText('/pozyczam <osoba> <kwota> [notatka] — Pożycz komuś');
  await expect(log(page)).toContainText('/pozyczam-od <osoba> <kwota> [notatka] — Pożycz od kogoś');
  await expect(log(page)).toContainText('/splata <pożyczka|osoba> <kwota> — Spłać pożyczkę');
  await expect(log(page)).toContainText('/pozyczki — Pożyczki: do odzyskania i do oddania');
  await expect(log(page)).toContainText('/limit-wydatkow <kwota> — Miesięczny limit wydatków');
  await expect(log(page)).toContainText('/nowy-obowiazek <nazwa> <pkt> [--jednorazowy] — Nowy obowiązek na liście');
  await expect(log(page)).toContainText('/usun-obowiazek <obowiązek> — Usuń obowiązek z listy');
  await expect(log(page)).toContainText('/usun-wpis [ostatni|obowiązek] — Usuń wpis obowiązku do wypłaty');
  await expect(log(page)).toContainText('/usun-aktywnosc [ostatnia|tekst] — Usuń aktywność');
  await expect(log(page)).toContainText('/blad <tytuł> | <obszar> | <opis> — Zgłoś błąd');
  await expect(log(page)).toContainText('/nowy — Nowa rozmowa');
  await send(page, 'odłóż 50 zł na rower');
  await expect(log(page)).toContainText('Ex-us AI jest na razie w testach');
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
  await expectCard(page, 'zadanie', ['termin']);
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
  await expect(list.getByRole('button')).toHaveCount(44);
  await field.fill('/za');
  await expect(list.getByRole('button')).toHaveCount(6);
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
  await expectCard(page, 'cel', ['kwota (zł albo pkt)']);
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
  await expectCard(page, 'wplac', ['cel']);
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
  await expectCard(page, 'wydatek', ['kwota']);
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
  await expectCard(page, 'kategoria', ['nazwa']);
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
  await expect(list.getByRole('button')).toHaveCount(34);
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
  await expectCard(page, 'obowiazek', ['obowiązek']);
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
  await expectCard(page, 'aktywnosc', ['czas']);
  await send(page, '/aktywnosc 30');
  await expectCard(page, 'aktywnosc', ['rodzaj aktywności']);
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
  await expect(list.getByRole('button')).toHaveCount(33);
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
  await expectCard(page, 'zrobione', ['zadanie']);
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
  await expectCard(page, 'notatka', ['tytuł']);
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
  await expectCard(page, 'limit', ['limit (pkt)']);
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

// ── Stage 5a-9: loans, the spending limit, chore and activity deletion, /blad, /nowy ──

const loansOf = (uid) => db.collection(`users/${uid}/moneyLoans`);

/** The balance and every loan, ids and times aside (completedAt only as set or not): money.spec's loansState. */
async function loansState(uid) {
  const balance = (await db.doc(`users/${uid}/money/balance`).get()).data();
  const loans = (await loansOf(uid).get()).docs
    .map((d) => {
      const { createdAt, completedAt, ...rest } = d.data();
      return { ...rest, completed: completedAt !== null && completedAt !== undefined };
    })
    .sort((a, b) => a.person.localeCompare(b.person));
  return { balance, loans, transactions: (await db.collection(`users/${uid}/moneyTransactions`).get()).size };
}

let loanOrder = 0;
function seedLoan(uid, { person, amount, repaidAmount = 0, direction, note = '' }) {
  return loansOf(uid).add({
    person,
    amount,
    repaidAmount,
    direction,
    note,
    date: utcToday(),
    createdAt: new Date(Date.now() + (loanOrder += 1)),
    completedAt: null,
  });
}

const loan = (person, amount, direction, { repaidAmount = 0, note = '', completed = false } = {}) => ({
  person,
  amount,
  repaidAmount,
  direction,
  note,
  date: utcToday(),
  completed,
});

test('/pozyczam writes the loan and the balance the Loans view writes (G6.1), and the Loans view lists it', async ({ page }) => {
  const account = await moneyAccount('exus-lend');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  // Typed at once, before the Money data has loaded.
  await send(page, '/pozyczam Ola 20 zł na kino');
  await expect(replies.last()).toHaveText('Zapisano pożyczkę dla: Ola, 20,00 zł. Saldo zmalało o tę kwotę. Notatka: „na kino”.');
  await expect(page.getByText('Pożyczka dodana.')).toBeVisible();
  // The document of money.spec's G6.1 test.
  expect(await loansState(account.uid)).toEqual({ balance: { current: 30 }, loans: [loan('Ola', 20, 'lent', { note: 'na kino' })], transactions: 0 });

  await page.evaluate(() => (location.hash = '#/money/loans'));
  const row = page.getByRole('list', { name: 'Pożyczki' }).getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row.first()).toContainText('Pożyczka dla: Ola');
  await expect(row.first()).toContainText('Spłacono 0,00 zł z 20,00 zł (0%) · na kino');
});

test('/pozyczam: /cofnij deletes the loan and the balance is back exactly', async ({ page }) => {
  const account = await moneyAccount('exus-lend-undo');
  const before = await loansState(account.uid);
  await openSignedIn(page, account, '#/exus');
  await send(page, '/pozyczam Ola 20');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Zapisano pożyczkę dla: Ola, 20,00 zł. Saldo zmalało o tę kwotę.');
  await expect.poll(async () => (await loansState(account.uid)).balance).toEqual({ current: 30 });
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Cofnięto: pożyczka dla: Ola (20,00 zł).');
  await expect.poll(() => loansState(account.uid)).toEqual(before);
});

test('/pozyczam above the balance is refused (G6.1); the person, the amount and the limits are asked for', async ({ page }) => {
  const account = await moneyAccount('exus-lend-rules');
  const before = await loansState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/pozyczam Ola 60');
  await expect(replies.last()).toHaveText('Za mało środków na saldzie.');
  await send(page, '/pozyczam Ola');
  await expectCard(page, 'pozyczam', ['kwota']);
  await send(page, '/pozyczam 20');
  await expectCard(page, 'pozyczam', ['osoba']);
  await send(page, '/pozyczam Ola 0');
  await expect(replies.last()).toHaveText('Podaj kwotę większą od zera.');
  await send(page, `/pozyczam ${'x'.repeat(41)} 5`);
  await expect(replies.last()).toHaveText('Nazwa osoby ma najwyżej 40 znaków.');
  await send(page, `/pozyczam Ola 5 ${'n'.repeat(101)}`);
  await expect(replies.last()).toHaveText('Notatka ma najwyżej 100 znaków.');
  expect(await loansState(account.uid)).toEqual(before);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
});

test('/pozyczam-od adds to the balance (G6.2) and the person may be quoted; /cofnij deletes the loan', async ({ page }) => {
  const account = await moneyAccount('exus-borrow');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/pozyczam-od "Ciocia Ania" 40 buty');
  await expect(replies.last()).toHaveText('Zapisano pożyczkę od: Ciocia Ania, 40,00 zł. Saldo wzrosło o tę kwotę. Notatka: „buty”.');
  expect(await loansState(account.uid)).toEqual({ balance: { current: 90 }, loans: [loan('Ciocia Ania', 40, 'borrowed', { note: 'buty' })], transactions: 0 });

  // The money was spent since: the loan cannot be deleted below zero, so /cofnij says it could not and changes nothing.
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 10 });
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: pożyczka od: Ciocia Ania (40,00 zł).');
  await expect(page.getByText('Nie udało się cofnąć.')).toBeVisible();
  expect((await loansState(account.uid)).loans).toHaveLength(1);
});

test('/splata is capped at what is left and settles once (G6.3); a repayment has no undo', async ({ page }) => {
  const account = await moneyAccount('exus-repay');
  await seedLoan(account.uid, { person: 'Ola', amount: 20, repaidAmount: 5, direction: 'lent' });
  await seedLoan(account.uid, { person: 'Tata', amount: 40, direction: 'borrowed' });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/splata ola 25');
  await expect(replies.last()).toHaveText('Pożyczka dla: Ola rozliczona. Spłacono 15,00 zł, saldo wzrosło. Spłata ograniczona do tego, co zostało.');
  await expect(page.getByText('Pożyczka rozliczona: Ola.')).toBeVisible();
  // The state of money.spec's G6.3 test.
  expect((await loansState(account.uid)).balance).toEqual({ current: 65 });
  expect((await loansState(account.uid)).loans.find((l) => l.person === 'Ola')).toEqual(loan('Ola', 20, 'lent', { repaidAmount: 20, completed: true }));

  // A settled loan is no longer there to repay.
  await send(page, '/splata ola 5');
  await expect(replies.last()).toContainText('Nie ma niespłaconej pożyczki „ola”.');

  await send(page, '/splata Tata 15');
  await expect(replies.last()).toHaveText('Spłacono 15,00 zł pożyczki od: Tata. Zostało 25,00 zł. Saldo zmalało.');
  await expect(page.getByText('Spłacono 15,00 zł.')).toBeVisible();
  await expect.poll(async () => (await loansState(account.uid)).balance).toEqual({ current: 50 });
  expect((await loansState(account.uid)).loans.find((l) => l.person === 'Tata')).toEqual(loan('Tata', 40, 'borrowed', { repaidAmount: 15 }));

  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
  await send(page, '/splata Tata');
  await expectCard(page, 'splata', ['kwota']);
});

test('/splata with the balance too low changes nothing (G6.4); several loans of one person are told apart by the note', async ({ page }) => {
  const account = await moneyAccount('exus-repay-rules');
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 10 });
  await seedLoan(account.uid, { person: 'Tata', amount: 40, direction: 'borrowed' });
  await seedLoan(account.uid, { person: 'Ola', amount: 20, direction: 'lent', note: 'na kino' });
  await seedLoan(account.uid, { person: 'Ola', amount: 8, direction: 'lent', note: 'buty' });
  const before = await loansState(account.uid);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/splata Tata 15');
  await expect(replies.last()).toHaveText('Za mało środków na saldzie.');
  expect(await loansState(account.uid)).toEqual(before);

  await send(page, '/splata Ola 5');
  await expect(replies.last()).toContainText('Pasuje kilka pożyczek: Ola, na kino (20,00 zł); Ola, buty (8,00 zł).');
  expect(await loansState(account.uid)).toEqual(before);

  await send(page, '/splata ola buty 5');
  await expect(replies.last()).toHaveText('Spłacono 5,00 zł pożyczki dla: Ola. Zostało 3,00 zł. Saldo wzrosło.');
  await expect.poll(async () => (await loansState(account.uid)).balance).toEqual({ current: 15 });
});

test('/pozyczki tells what is owed to me and what I owe, per person, settled loans left out', async ({ page }) => {
  const account = await moneyAccount('exus-loans');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/pozyczki');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Brak pożyczek.');

  await seedLoan(account.uid, { person: 'Ola', amount: 20, repaidAmount: 5, direction: 'lent' });
  await seedLoan(account.uid, { person: 'Ola', amount: 10, direction: 'lent', note: 'buty' });
  await seedLoan(account.uid, { person: 'Kasia', amount: 8, repaidAmount: 8, direction: 'lent' });
  await seedLoan(account.uid, { person: 'Tata', amount: 40, direction: 'borrowed' });
  // The four documents arrive one by one; ask again until the listener has all of them.
  await expect
    .poll(async () => {
      await send(page, '/pozyczki');
      return (await page.locator('.exus-msg--exus').last().innerText()).replace(/\u00a0/g, ' ');
    })
    .toBe('Do odzyskania: 25,00 zł.\n• Ola: 25,00 zł\nDo oddania: 40,00 zł.\n• Tata: 40,00 zł');
});

test('/limit-wydatkow sets the monthly limit as the Money settings do; 0 turns it off; /cofnij restores the one before', async ({ page }) => {
  const account = await moneyAccount('exus-money-limit');
  const settings = async () => (await db.doc(`users/${account.uid}/money/settings`).get()).data();
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/limit-wydatkow 150,5');
  await expect(replies.last()).toHaveText('Miesięczny limit wydatków: 150,50 zł (było: 200,00 zł).');
  await expect(page.getByText('Limit zapisany: 150,50 zł.')).toBeVisible();
  await expect.poll(settings).toEqual({ monthlyLimit: 150.5, currency: 'PLN' });

  await send(page, '/limit-wydatkow 150,50');
  await expect(replies.last()).toHaveText('Limit wydatków już wynosi: 150,50 zł.');

  await send(page, '/limit-wydatkow 0');
  await expect(replies.last()).toHaveText('Limit wydatków wyłączony (było: 150,50 zł).');
  await expect.poll(settings).toEqual({ monthlyLimit: 0, currency: 'PLN' });
  await send(page, '/saldo');
  await expect(replies.last()).toContainText('(bez limitu)');

  // /cofnij takes the off back to 150,50, then the 150,50 back to 200.
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: limit wydatków brak limitu (wraca 150,50 zł).');
  await expect.poll(settings).toEqual({ monthlyLimit: 150.5, currency: 'PLN' });
  await send(page, '/cofnij');
  await expect.poll(settings).toEqual({ monthlyLimit: 200, currency: 'PLN' });

  await send(page, '/limit-wydatkow');
  await expectCard(page, 'limit-wydatkow', ['kwota']);
  await send(page, '/limit-wydatkow 2000000');
  await expect(replies.last()).toHaveText('Najwięcej 1 000 000 zł.');
});

test('/nowy-obowiazek writes the definition the Chores list writes, one-time with --jednorazowy; /cofnij removes it', async ({ page }) => {
  const account = await choresAccount('exus-create-chore');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  const defOf = async (name) => (await choreDefsOf(account.uid).where('name', '==', name).get()).docs.map((d) => d.data());

  await send(page, '/nowy-obowiazek Wyniesienie śmieci 12');
  await expect(replies.last()).toHaveText('Dodano obowiązek „Wyniesienie śmieci” do listy: 12 pkt.');
  await expect(page.getByText('Dodano do listy: Wyniesienie śmieci')).toBeVisible();
  // After the last one (order 4), no emoji, no description: the document of the sheet.
  await expect.poll(() => defOf('Wyniesienie śmieci')).toEqual([{ name: 'Wyniesienie śmieci', desc: '', emoji: '', points: 12, oneTime: false, order: 4 }]);

  await send(page, '/nowy-obowiazek --jednorazowy Mycie okien 2 30 pkt');
  await expect(replies.last()).toHaveText('Dodano jednorazowy obowiązek „Mycie okien 2”: 30 pkt. Zniknie z listy po pierwszym zapisaniu.');
  await expect.poll(() => defOf('Mycie okien 2')).toEqual([{ name: 'Mycie okien 2', desc: '', emoji: '', points: 30, oneTime: true, order: 5 }]);

  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: obowiązek „Mycie okien 2” na liście.');
  await expect.poll(() => defOf('Mycie okien 2')).toEqual([]);
  expect(await defOf('Wyniesienie śmieci')).toHaveLength(1);

  await send(page, '/nowy-obowiazek Okna');
  await expectCard(page, 'nowy-obowiazek', ['punkty']);
  await send(page, '/nowy-obowiazek Okna 20000');
  await expect(replies.last()).toHaveText('Najwięcej 10000 pkt.');
  await send(page, `/nowy-obowiazek ${'x'.repeat(61)} 5`);
  await expect(replies.last()).toHaveText('Nazwa obowiązku ma najwyżej 60 znaków.');
  expect(await defOf('Okna')).toEqual([]);
});

test('/usun-obowiazek asks first; Anuluj changes nothing, Wykonaj removes the definition and leaves the entries; /cofnij brings it back', async ({ page }) => {
  const account = await choresAccount('exus-delete-chore');
  await addChoreEntry(account.uid, 'dishwasher', localDay(0));
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  const dialog = page.getByRole('alertdialog');
  const hasDef = async (id) => (await choreDefsOf(account.uid).doc(id).get()).exists;

  // Typed at once, before the chores have loaded.
  await send(page, '/usun-obowiazek zmywarki');
  await expect(dialog).toContainText('Wykonać /usun-obowiazek?');
  await expect(dialog).toContainText('Obowiązek „Opróżnienie zmywarki” zniknie z listy. Zapisane wpisy zostają z dawną nazwą i punktami.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(replies.last()).toHaveText('Anulowano, nic się nie zmieniło.');
  await expect(dialog).toBeHidden();
  expect(await hasDef('dishwasher')).toBe(true);

  await send(page, '/usun-obowiazek zmywarki');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toHaveText('Usunięto obowiązek „Opróżnienie zmywarki” z listy.');
  await expect(page.getByText('Usunięto z listy: Opróżnienie zmywarki')).toBeVisible();
  await expect.poll(() => hasDef('dishwasher')).toBe(false);
  expect(await choreEntries(account.uid)).toEqual([choreEntry('dishwasher', localDay(0))]);

  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: usunięcie obowiązku „Opróżnienie zmywarki”.');
  await expect.poll(() => hasDef('dishwasher')).toBe(true);
  expect((await choreDefsOf(account.uid).doc('dishwasher').get()).data()).toEqual({ name: 'Opróżnienie zmywarki', desc: '', emoji: '🍽️', points: 15, oneTime: false, order: 0 });

  // No such chore and several fits are said before any question.
  await send(page, '/usun-obowiazek latanie');
  await expect(replies.last()).toContainText('Nie ma obowiązku „latanie”.');
  await send(page, '/usun-obowiazek odkurzanie');
  await expect(replies.last()).toContainText('Pasuje kilka obowiązków: „Odkurzanie schodów”, „Odkurzanie przedpokoju”.');
  await expect(dialog).toBeHidden();
  await send(page, '/usun-obowiazek');
  await expectCard(page, 'usun-obowiazek', ['obowiązek']);
});

test('/usun-wpis deletes the newest unpaid entry or the newest of a chore, after asking; /cofnij writes the same entry back', async ({ page }) => {
  const account = await choresAccount('exus-delete-entry');
  const now = Date.now();
  const add = (choreId, dateISO, ago) => {
    const [, name, emoji, points] = CHORE_DEFS.find((d) => d[0] === choreId);
    return choreEntriesOf(account.uid).add({ choreId, choreName: name, choreEmoji: emoji, points, dateISO, monthKey: dateISO.slice(0, 7), createdAt: new Date(now - ago) });
  };
  await add('dishwasher', localDay(-2), 3000);
  await add('vacuum_stairs', localDay(-1), 2000);
  await add('dishwasher', localDay(0), 1000);
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  const dialog = page.getByRole('alertdialog');

  await send(page, '/usun-wpis');
  await expect(dialog).toContainText(`Usuniesz wpis „Opróżnienie zmywarki” z dnia`);
  await expect(dialog).toContainText('(+15 pkt). Te punkty nie trafią do wypłaty.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(replies.last()).toHaveText('Anulowano, nic się nie zmieniło.');
  await expect(dialog).toBeHidden();
  expect(await choreEntries(account.uid)).toHaveLength(3);

  await send(page, '/usun-wpis ostatni');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toContainText('Usunięto wpis „Opróżnienie zmywarki” z dnia');
  await expect(page.getByText('Wpis usunięty.')).toBeVisible();
  await expect.poll(async () => (await choreEntries(account.uid)).length).toBe(2);
  expect(await choreEntries(account.uid)).not.toContainEqual(choreEntry('dishwasher', localDay(0)));

  // The same entry, with its time, comes back.
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Cofnięto: usunięcie wpisu „Opróżnienie zmywarki”.');
  await expect.poll(async () => (await choreEntries(account.uid)).length).toBe(3);
  expect(await choreEntries(account.uid)).toContainEqual(choreEntry('dishwasher', localDay(0)));

  // A name takes the newest entry of that chore.
  await send(page, '/usun-wpis schodow');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toContainText('Usunięto wpis „Odkurzanie schodów” z dnia');
  await expect.poll(async () => (await choreEntries(account.uid)).length).toBe(2);

  await send(page, '/usun-wpis latanie');
  await expect(replies.last()).toContainText('Nie ma wpisu „latanie” do wypłaty.');
  await expect(dialog).toBeHidden();
});

test('/usun-wpis with no entries says so at once, without a question', async ({ page }) => {
  const account = await choresAccount('exus-delete-entry-none');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/usun-wpis');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Nie ma żadnych wpisów do wypłaty.');
  await expect(page.getByRole('alertdialog')).toBeHidden();
});

/** A moment of today's UTC day (v1 todayStr), `seconds` after its 00:00. */
const utcTodayAt = (seconds) => Timestamp.fromMillis(Date.parse(`${todayUtcKey()}T00:00:00Z`) + seconds * 1000);

/** An account with two logged activities (Nauka 40 pts, Czytanie 25 pts) and the totals and today's log they left. */
async function twoActivities(tag) {
  const account = await createUser({ tag, profile: { points: { total: 120, earnedAllTime: 620, spentAllTime: 0 }, dailyLimit: 150 } });
  const user = db.doc(`users/${account.uid}`);
  await user.collection('dailyLog').doc(todayUtcKey()).set({ pointsEarned: 65, gamingMinutes: 0 });
  await user.collection('activityDefs').doc('learning').set({ name: 'Nauka', points: 40, color: '#6c63ff', icon: 'ti-book', order: 0 });
  await user.collection('activityDefs').doc('reading').set({ name: 'Czytanie', points: 25, color: '#ffd700', icon: 'ti-book-2', order: 1 });
  // Inside today's UTC day whatever the time of the run: the day log a delete corrects is keyed by the
  // UTC day of the timestamp, so "30 minutes ago" would be yesterday's right after 00:00 UTC.
  await user.collection('activities').add({ type: 'learning', duration: 60, points: 40, desc: 'rozdział 3', timestamp: utcTodayAt(1) });
  await user.collection('activities').add({ type: 'reading', duration: 60, points: 25, desc: '', timestamp: utcTodayAt(3) });
  return account;
}

test('/usun-aktywnosc asks first; Wykonaj deletes the newest and takes its points back exactly (G11)', async ({ page }) => {
  const account = await twoActivities('exus-delete-activity');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  const dialog = page.getByRole('alertdialog');

  await send(page, '/usun-aktywnosc');
  await expect(dialog).toContainText('Usuniesz aktywność „Czytanie” (1 h,');
  await expect(dialog).toContainText('Odejmiemy 25 pkt z punktów i z dnia, w którym ją zapisano.');
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(replies.last()).toHaveText('Anulowano, nic się nie zmieniło.');
  await expect(dialog).toBeHidden();
  expect((await activityState(account.uid)).activities).toHaveLength(2);

  await send(page, '/usun-aktywnosc ostatnia');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toHaveText('Usunięto aktywność „Czytanie”. Odjęto 25 pkt.');
  await expect(page.getByText('Usunięto aktywność. −25 pkt')).toBeVisible();
  await expect.poll(() => activityState(account.uid)).toMatchObject({
    points: { total: 95, earnedAllTime: 595, spentAllTime: 0 },
    day: { pointsEarned: 40, gamingMinutes: 0 },
    activities: [{ type: 'learning', duration: 60, points: 40, desc: 'rozdział 3' }],
  });
  // Nothing writes an activity back with its credit: no undo.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');

  // A text names it by type and note; the last one goes, then there is nothing.
  await send(page, '/usun-aktywnosc nauka rozdzial');
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(replies.last()).toHaveText('Usunięto aktywność „Nauka”. Odjęto 40 pkt.');
  await expect.poll(() => activityState(account.uid)).toMatchObject({
    points: { total: 55, earnedAllTime: 555, spentAllTime: 0 },
    day: { pointsEarned: 0, gamingMinutes: 0 },
    activities: [],
  });
  // The list /statystyki and /usun-aktywnosc read is the Stats listener's: wait until it has dropped both entries.
  await expect
    .poll(async () => {
      await send(page, '/statystyki');
      return (await replies.last().innerText()).includes('Brak danych');
    })
    .toBe(true);
  await send(page, '/usun-aktywnosc');
  await expect(replies.last()).toHaveText('Nie ma żadnych aktywności do usunięcia.');
  await expect(dialog).toBeHidden();
});

test('/usun-aktywnosc lists several fits and says when nothing fits, before any question', async ({ page }) => {
  const account = await twoActivities('exus-delete-activity-text');
  await db.collection(`users/${account.uid}/activities`).add({
    type: 'learning',
    duration: 30,
    points: 20,
    desc: 'testy',
    timestamp: utcTodayAt(2),
  });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/usun-aktywnosc nauka');
  await expect(replies.last()).toContainText('Pasuje kilka aktywności. Napisz dokładniej albo wpisz „ostatnia”:');
  await expect(replies.last()).toContainText('• Nauka testy (30 min,');
  await expect(replies.last()).toContainText('• Nauka rozdział 3 (1 h,');
  await send(page, '/usun-aktywnosc latanie');
  await expect(replies.last()).toContainText('Nie ma aktywności „latanie” wśród ostatnich.');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect((await activityState(account.uid)).activities).toHaveLength(3);
});

// The reports of this account as the Reports screen's tests read them.
const reportsOf = async (uid) => (await db.collection('bugReports').where('reporterUid', '==', uid).get()).docs.map((d) => d.data());

test('/blad sends the report the Reports screen sends (title, area by name, description); the second one the same day is refused', async ({ page }) => {
  const account = await createUser({ tag: 'exus-report', profile: { name: 'Ola' } });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  // Typed at once, before the reports have loaded.
  await send(page, '/blad Saldo | pieniadze | Saldo nie działa po wypłacie, "a=b"');
  await expect(replies.last()).toHaveText('Zgłoszenie wysłane. Dzięki! „Saldo”, obszar: Pieniądze.');
  await expect(page.getByRole('status')).toContainText('Zgłoszenie wysłane. Dzięki!');
  await expect.poll(async () => (await reportsOf(account.uid)).length).toBe(1);
  const { createdAt, ...report } = (await reportsOf(account.uid))[0];
  expect(createdAt).toBeInstanceOf(Timestamp);
  expect(report).toEqual({
    reporterUid: account.uid,
    reporterName: 'Ola',
    title: 'Saldo',
    area: 'money',
    description: 'Saldo nie działa po wypłacie, "a=b"',
    status: 'new',
    messages: [],
  });
  await expect.poll(async () => (await db.doc(`users/${account.uid}`).get()).data()?.lastBugReportAt?.slice(0, 10)).toBe(todayUtcKey());

  // One a day: the second is refused and writes nothing; it cannot be undone either.
  await send(page, '/blad Inne | inne | Przycisk nie działa');
  await expect(replies.last()).toHaveText('Możesz wysłać jedno zgłoszenie dziennie. Spróbuj jutro.');
  expect(await reportsOf(account.uid)).toHaveLength(1);
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');

  // The Reports screen lists it, and its button is used up for today.
  await page.evaluate(() => (location.hash = '#/reports'));
  await expect(page.getByRole('list', { name: 'Moje zgłoszenia' }).getByRole('listitem')).toContainText('Saldo');
  await expect(page.getByRole('button', { name: 'Zgłoś błąd' })).toBeDisabled();
});

test('/blad: the format, the area, the length and the spam filter work as on the Reports screen', async ({ page }) => {
  const account = await createUser({ tag: 'exus-report-rules', profile: { name: 'Ola' } });
  await db.doc('bugReportsConfig/keywords').set({ words: ['nie działa', 'błąd'] });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');

  await send(page, '/blad');
  await expectCard(page, 'blad', ['tytuł | obszar | opis']);
  await send(page, '/blad Saldo');
  await expect(replies.last()).toHaveText('Napisz zgłoszenie tak: tytuł | obszar | opis. Obszary: Dziś, Pieniądze, Obowiązki, Historia, Statystyki, Ustawienia, Inne.');
  await send(page, '/blad Saldo | latanie | opis');
  await expect(replies.last()).toHaveText('Nie znam obszaru „latanie”. Obszary: Dziś, Pieniądze, Obowiązki, Historia, Statystyki, Ustawienia, Inne.');
  await send(page, `/blad ${'t'.repeat(81)} | inne | opis`);
  await expect(replies.last()).toHaveText('Tytuł ma najwyżej 80 znaków.');
  await send(page, `/blad Tytuł | inne | ${'o'.repeat(401)}`);
  await expect(replies.last()).toHaveText('Opis ma najwyżej 400 znaków.');
  expect(await reportsOf(account.uid)).toEqual([]);

  // None of the admin's words: it goes to spam, and the reporter is told only that it was sent.
  await send(page, '/blad Hej | Inne | Fajna apka');
  await expect(replies.last()).toHaveText('Zgłoszenie wysłane. Dzięki! „Hej”, obszar: Inne.');
  await expect.poll(async () => (await reportsOf(account.uid)).map((r) => r.status)).toEqual(['spam']);
});

test('/blad uses the bonus report of an accepted one when today is used up', async ({ page }) => {
  const sentToday = `${todayUtcKey()}T08:00:00.000Z`;
  const account = await createUser({ tag: 'exus-report-bonus', profile: { name: 'Ola', lastBugReportAt: sentToday } });
  await db.collection('bugReports').doc(`bonus-${account.uid}`).set({
    reporterUid: account.uid,
    reporterName: 'Ola',
    title: 'Stare',
    area: 'other',
    description: 'Przycisk nie działa',
    status: 'accepted',
    messages: [],
    createdAt: Timestamp.fromDate(new Date(Date.now() - 86400000)),
    bonusGranted: true,
  });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  await send(page, '/blad Saldo | Pieniądze | Saldo nie działa');
  await expect(replies.last()).toHaveText('Zgłoszenie wysłane. Dzięki! „Saldo”, obszar: Pieniądze.');
  await expect.poll(async () => (await db.doc(`bugReports/bonus-${account.uid}`).get()).data().bonusUsed).toBe(true);
  await send(page, '/blad Jeszcze | Inne | Przycisk nie działa');
  await expect(replies.last()).toHaveText('Możesz wysłać jedno zgłoszenie dziennie. Spróbuj jutro.');
});

test('/nowy empties the chat and the undo list; the work already done stays', async ({ page }) => {
  const account = await createUser({ tag: 'exus-new-chat' });
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  const mine = page.locator('.exus-msg--me');

  await send(page, '/zadanie Kupić mleko jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko”');
  await send(page, '/pomoc');
  await expect(mine).toHaveCount(2);

  await send(page, '/nowy');
  await expect(replies).toHaveCount(1);
  await expect(replies.first()).toHaveText('Zaczynamy od nowa. Wpisz /pomoc, żeby zobaczyć komendy.');
  await expect(mine).toHaveCount(0);
  await expect(log(page)).not.toContainText('Kupić mleko');
  await expect(page.getByLabel('Wiadomość do Ex-us')).toHaveValue('');

  // The undo list is empty now, and the task is still there.
  await send(page, '/cofnij');
  await expect(replies.last()).toHaveText('Nie ma nic do cofnięcia.');
  await expect.poll(async () => (await tasksOf(account.uid)).map((task) => task.text)).toEqual(['Kupić mleko']);
  // The chat works as before.
  await send(page, '/nowy');
  await expect(replies).toHaveCount(1);
});

test('with Money, Chores or Statistics XP off, their new commands are gone; /blad and /nowy stay', async ({ page }) => {
  const account = await createUser({ tag: 'exus-no-modules-5a9', profile: { enabledModules: ['notes', 'aichat', 'games'] } });
  await openSignedIn(page, account, '#/exus');
  const field = page.getByLabel('Wiadomość do Ex-us');
  const list = page.getByRole('list', { name: 'Komendy pasujące do wpisu' });
  for (const prefix of ['/pozycz', '/splat', '/limit-w', '/nowy-ob', '/usun-ob', '/usun-wp', '/usun-ak']) {
    await field.fill(prefix);
    await expect(list).toHaveCount(0);
  }
  await field.fill('/bla');
  await expect(list.getByRole('button')).toHaveCount(1);
  await field.fill('/nowy');
  await expect(list.getByRole('button')).toHaveCount(1);
  await field.fill('');
  for (const command of ['/pozyczam Ola 5', '/pozyczam-od Ola 5', '/splata Ola 5', '/pozyczki', '/limit-wydatkow 5', '/nowy-obowiazek Okna 5', '/usun-obowiazek okna', '/usun-wpis', '/usun-aktywnosc']) {
    await send(page, command);
    await expect(page.locator('.exus-msg--exus').last()).toContainText(`Nie znam komendy ${command.split(' ')[0]}.`);
  }
  await send(page, '/pomoc');
  const help = page.locator('.exus-msg--exus').last();
  await expect(help).toContainText('/blad <tytuł> | <obszar> | <opis>');
  await expect(help).toContainText('/nowy — Nowa rozmowa');
  await expect(help).not.toContainText('/pozyczam');
  await expect(help).not.toContainText('/usun-wpis');
  await send(page, '/blad Saldo | Inne | Saldo nie działa');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Zgłoszenie wysłane. Dzięki!');
});

test('the 5a-9 commands wait for their data under a CPU 6 times slower, from a cold start', async ({ page }) => {
  const account = await choresAccount('exus-5a9-slow', { name: 'Ola' });
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 50 });
  await db.doc(`users/${account.uid}/money/settings`).set({ monthlyLimit: 200, currency: 'PLN' });
  await seedLoan(account.uid, { person: 'Ola', amount: 20, repaidAmount: 5, direction: 'lent' });
  await addChoreEntry(account.uid, 'dishwasher', localDay(0));
  await openSignedIn(page, account, '#/exus');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  await send(page, '/pozyczki');
  await send(page, '/splata ola 5');
  await send(page, '/limit-wydatkow 100');
  await send(page, '/nowy-obowiazek Okna 20');
  await send(page, '/blad Wolno | Inne | Strona nie działa');
  await expect(log(page)).toContainText('Do odzyskania: 15,00 zł.');
  await expect(log(page)).toContainText('Spłacono 5,00 zł pożyczki dla: Ola. Zostało 10,00 zł. Saldo wzrosło.');
  await expect(log(page)).toContainText('Miesięczny limit wydatków: 100,00 zł (było: 200,00 zł).');
  await expect(log(page)).toContainText('Dodano obowiązek „Okna” do listy: 20 pkt.');
  await expect(log(page)).toContainText('Zgłoszenie wysłane. Dzięki! „Wolno”, obszar: Inne.');

  await send(page, '/usun-wpis');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Usunięto wpis „Opróżnienie zmywarki” z dnia');
  await expect.poll(async () => (await loansState(account.uid)).balance).toEqual({ current: 55 });
  await expect.poll(() => choreEntries(account.uid)).toEqual([]);
  await expect.poll(async () => (await reportsOf(account.uid)).length).toBe(1);
});

// ── Stage 5a-10: the form card of a command with missing slots (PLAN.md 6.6, row 2) ──

const cardOf = (page, command) => page.getByRole('form', { name: `Uzupełnij /${command}` }).last();

test('/zadanie without a date shows a card with what was understood; filling it and "Wykonaj" creates the task and makes the card read-only', async ({ page }) => {
  const account = await createUser({ tag: 'exus-card-task' });
  await openSignedIn(page, account, '#/exus');
  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await send(page, '/zadanie Kupić mleko L');
  const card = await expectCard(page, 'zadanie', ['termin']);
  // What the parser understood is in the fields; the optional one says so.
  await expect(card.getByLabel('treść', { exact: true })).toHaveValue('Kupić mleko');
  await expect(card.getByLabel('rozmiar (opcjonalnie)')).toHaveValue('L');
  await expect(card.getByText('Uzupełnij to pole.')).toBeVisible();
  await expect(card.getByText('Uzupełnij zaznaczone pola, żeby wykonać.')).toBeVisible();
  expect(await tasksOf(account.uid)).toEqual([]);

  await card.getByLabel('termin', { exact: true }).fill(tomorrow);
  await expect(card.getByRole('button', { name: 'Wykonaj' })).toBeEnabled();
  await card.getByLabel('treść', { exact: true }).fill('Kupić mleko i chleb');
  await card.getByRole('button', { name: 'Wykonaj' }).click();

  // The same handler as the typed command: the reply, the toast with "Cofnij", the task of the Tasks screen.
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko i chleb”');
  await expect.poll(() => tasksOf(account.uid)).toEqual([
    expect.objectContaining({ text: 'Kupić mleko i chleb', dueDate: tomorrow, size: 'L', done: false, penaltyApplied: false }),
  ]);
  // Read-only now: a summary, no fields, no second run.
  await expect(cardOf(page, 'zadanie')).toHaveCount(0);
  const summary = page.getByRole('region', { name: 'Do wykonania: /zadanie' });
  await expect(summary).toContainText('treść');
  await expect(summary).toContainText('Kupić mleko i chleb');
  await expect(summary.getByRole('button')).toHaveCount(0);
  await expect(summary.getByRole('textbox')).toHaveCount(0);
  expect(await tasksOf(account.uid)).toHaveLength(1);

  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(() => tasksOf(account.uid)).toEqual([]);
});

test('"Pomiń" collapses the card into a short message and writes nothing', async ({ page }) => {
  const account = await createUser({ tag: 'exus-card-skip' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/zadanie Kupić mleko');
  const card = await expectCard(page, 'zadanie', ['termin']);
  await card.getByRole('button', { name: 'Pomiń' }).click();
  await expect(cardOf(page, 'zadanie')).toHaveCount(0);
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Pominięto.');
  expect(await tasksOf(account.uid)).toEqual([]);
  await send(page, '/cofnij');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Nie ma nic do cofnięcia.');
});

test('an amount that does not read keeps "Wykonaj" disabled with a reason under the field, until it does', async ({ page }) => {
  const account = await goalsAccount('exus-card-amount');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/cel Rower');
  const card = await expectCard(page, 'cel', ['kwota (zł albo pkt)']);
  const run = card.getByRole('button', { name: 'Wykonaj' });
  const target = card.getByLabel('kwota (zł albo pkt)', { exact: true });

  await target.fill('dużo');
  await expect(card.getByText('Ta wartość nie pasuje.')).toBeVisible();
  await expect(run).toBeDisabled();
  await target.fill('1500');
  await expect(card.getByText('Ta wartość nie pasuje.')).toBeHidden();
  // A bare number reads (the command itself asks for the unit when it runs); with the unit it is a money goal.
  await target.fill('1 500 zł');
  await expect(run).toBeEnabled();
  await run.click();
  await expect(log(page)).toContainText('Dodano cel „Rower”: 1500,00 zł');
  await expect.poll(() => goalsOf(account.uid)).toEqual([expect.objectContaining({ name: 'Rower', type: 'money', amount: 1500 })]);
});

test('a money field and the person: /pozyczam Ola asks for the amount; the loan is the one the typed command writes', async ({ page }) => {
  const account = await moneyAccount('exus-card-loan');
  await openSignedIn(page, account, '#/exus');
  await send(page, '/pozyczam Ola');
  const card = await expectCard(page, 'pozyczam', ['kwota']);
  await expect(card.getByLabel('osoba', { exact: true })).toHaveValue('Ola');
  await card.getByLabel('kwota', { exact: true }).fill('20');
  await card.getByLabel('notatka (opcjonalnie)').fill('na kino');
  await card.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Zapisano pożyczkę dla: Ola, 20,00 zł.');
  expect(await loansState(account.uid)).toEqual({ balance: { current: 30 }, loans: [loan('Ola', 20, 'lent', { note: 'na kino' })], transactions: 0 });
});

test('a destructive command with a missing slot shows a card, and "Wykonaj" still goes through the dialog', async ({ page }) => {
  const account = await goalsAccount('exus-card-destructive', [rower]);
  await openSignedIn(page, account, '#/exus');
  await send(page, '/usun-cel');
  const card = await expectCard(page, 'usun-cel', ['cel']);
  await card.getByLabel('cel', { exact: true }).fill('rower');
  await card.getByRole('button', { name: 'Wykonaj' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Wykonać /usun-cel?');
  expect(await goalsOf(account.uid)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect.poll(() => goalsOf(account.uid)).toEqual([]);
});

test('a choice, a flag, and the raw text of /blad: each command gets the control of its slot', async ({ page }) => {
  const account = await choresAccount('exus-card-controls', { name: 'Ola' });
  await openSignedIn(page, account, '#/exus');

  await send(page, '/obowiazek');
  const chore = await expectCard(page, 'obowiazek', ['obowiązek']);
  await chore.getByLabel('kiedy (opcjonalnie)').selectOption({ label: 'wczoraj' });
  await chore.getByLabel('obowiązek', { exact: true }).fill('zmywarki');
  await chore.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Zapisano obowiązek „Opróżnienie zmywarki” na wczoraj');
  await expect.poll(() => choreEntries(account.uid)).toEqual([choreEntry('dishwasher', localDay(-1))]);

  await send(page, '/nowy-obowiazek Okna');
  const create = await expectCard(page, 'nowy-obowiazek', ['punkty']);
  await create.getByLabel('punkty', { exact: true }).fill('30');
  await create.getByLabel('jednorazowy').check();
  await create.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Dodano jednorazowy obowiązek „Okna”: 30 pkt.');

  await send(page, '/blad');
  const bug = await expectCard(page, 'blad', ['tytuł | obszar | opis']);
  await bug.getByLabel('tytuł | obszar | opis', { exact: true }).fill('Saldo | Pieniądze | Saldo nie działa po wypłacie');
  await bug.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Zgłoszenie wysłane. Dzięki! „Saldo”, obszar: Pieniądze.');
  await expect.poll(async () => (await reportsOf(account.uid)).length).toBe(1);
});

test('a command whose slot has no control (/jezyk) and a read command keep the text reply', async ({ page }) => {
  const account = await createUser({ tag: 'exus-card-text' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/jezyk');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Brakuje: język.');
  await send(page, '/szukaj');
  await expect(page.locator('.exus-msg--exus').last()).toContainText('Brakuje: fraza.');
  await expect(page.getByRole('form', { name: /^Uzupełnij/ })).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test('the card fits the screen: no horizontal scroll, and its buttons are reachable', async ({ page }) => {
    const account = await createUser({ tag: 'exus-card-phone' });
    await openSignedIn(page, account, '#/exus');
    await send(page, '/zadanie Kupić mleko');
    const card = await expectCard(page, 'zadanie', ['termin']);
    await card.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(412);
    await expect(card.getByRole('button', { name: 'Pomiń' })).toBeInViewport();
    await card.getByRole('button', { name: 'Pomiń' }).click();
    await expect(page.locator('.exus-msg--exus').last()).toHaveText('Pominięto.');
  });
});

/** The texts kept on the device for the conversation (every account), read from IndexedDB. */
const keptTexts = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('lifexp-v2-exus');
        open.onerror = () => resolve([]);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('history')) return resolve([]);
          const all = db.transaction('history').objectStore('history').getAll();
          all.onsuccess = () => resolve(all.result.flat().map((m) => m.text || m.done?.title || ''));
          all.onerror = () => resolve([]);
        };
      }),
  );

/** Waits until the last message is on the device, as a person's pause before closing the app would: a reload before that loses it. */
const expectKept = (page, fragment) => expect.poll(async () => (await keptTexts(page)).some((text) => text.includes(fragment))).toBe(true);

// ── Stage 5a-11a: history on the device, Ctrl/Cmd+K, offline ──

test('the conversation survives a reload, without a live undo list; /nowy clears it for good', async ({ page }) => {
  const account = await createUser({ tag: 'exus-history' });
  await openSignedIn(page, account, '#/exus');
  await expect(log(page)).toContainText('Wpisz /pomoc');
  await send(page, '/zadanie Kupić mleko jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko”');
  await send(page, '/nie-ma-takiej');
  await expect.poll(() => tasksOf(account.uid)).toHaveLength(1);
  await expectKept(page, 'Nie znam komendy /nie-ma-takiej.');

  await page.reload();
  await expect(log(page)).toContainText('/zadanie Kupić mleko jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko”');
  await expect(log(page)).toContainText('Nie znam komendy /nie-ma-takiej.');
  // Said once, kept once: no greeting in a conversation that has begun.
  await expect(log(page)).not.toContainText('Wpisz /pomoc, żeby zobaczyć komendy.');
  // The undo list is not kept: the task is there, and /cofnij has nothing.
  await send(page, '/cofnij');
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Nie ma nic do cofnięcia.');
  await expect.poll(async () => (await tasksOf(account.uid)).map((task) => task.text)).toEqual(['Kupić mleko']);

  await send(page, '/nowy');
  await expect(page.locator('.exus-msg')).toHaveCount(1);
  await expect(log(page)).toContainText('Zaczynamy od nowa.');
  await expect.poll(async () => (await keptTexts(page)).length).toBe(0);
  await page.reload();
  await expect(log(page)).toContainText('Wpisz /pomoc, żeby zobaczyć komendy.');
  await expect(log(page)).not.toContainText('Kupić mleko');
  await expect(page.locator('.exus-msg')).toHaveCount(1);
});

test('another account on the same device does not see the conversation, and signing out clears it', async ({ page }) => {
  const account = await createUser({ tag: 'exus-history-out' });
  await openSignedIn(page, account, '#/exus');
  await send(page, '/zadanie Sekretne zadanie jutro');
  await expect(log(page)).toContainText('Dodano zadanie „Sekretne zadanie”');
  await expect.poll(() => tasksOf(account.uid)).toHaveLength(1);

  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('region', { name: 'Konto' }).getByRole('button', { name: 'Wyloguj' }).click();
  await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible();
  // Nothing of it is left in the browser's storage.
  const stored = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('lifexp-v2-exus');
        open.onerror = () => resolve('none');
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('history')) return resolve('none');
          const all = db.transaction('history').objectStore('history').getAll();
          all.onsuccess = () => resolve(all.result.length);
          all.onerror = () => resolve('error');
        };
      }),
  );
  expect(stored === 'none' || stored === 0).toBe(true);

  await signIn(page, account);
  await expect(page.locator('.shell')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/exus'));
  await expect(log(page)).toContainText('Wpisz /pomoc');
  await expect(log(page)).not.toContainText('Sekretne');
});

test('a form card is kept as what it became: a used one read-only, a skipped one as "Pominięto.", an unused one not at all', async ({ page }) => {
  const account = await createUser({ tag: 'exus-history-cards' });
  await openSignedIn(page, account, '#/exus');
  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await send(page, '/zadanie Kupić mleko');
  const used = await expectCard(page, 'zadanie', ['termin']);
  await used.getByLabel('termin', { exact: true }).fill(tomorrow);
  await used.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Dodano zadanie „Kupić mleko”');
  await expect.poll(() => tasksOf(account.uid)).toHaveLength(1);

  await send(page, '/zadanie Skipped');
  await (await expectCard(page, 'zadanie', ['termin'])).getByRole('button', { name: 'Pomiń' }).click();
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Pominięto.');

  await send(page, '/zadanie Nieużyta');
  await expectCard(page, 'zadanie', ['termin']);
  await expect(page.getByLabel('Wiadomość do Ex-us')).toHaveValue('');
  // The last message is written to the device before the reload.
  await send(page, '/pomoc');
  await expect(log(page)).toContainText('Komendy (kolejność argumentów dowolna):');
  await expectKept(page, 'Komendy (kolejność argumentów dowolna):');

  await page.reload();
  await expect(log(page)).toContainText('Komendy (kolejność argumentów dowolna):');
  const summary = page.getByRole('region', { name: 'Do wykonania: /zadanie' });
  await expect(summary).toHaveCount(1);
  await expect(summary).toContainText('Kupić mleko');
  await expect(summary.getByRole('button')).toHaveCount(0);
  await expect(summary.getByRole('textbox')).toHaveCount(0);
  await expect(page.locator('.exus-msg--exus').filter({ hasText: /^Pominięto\.$/ })).toHaveCount(1);
  // The card nobody used is gone: nothing on the page can run it twice.
  await expect(page.getByRole('form', { name: /^Uzupełnij/ })).toHaveCount(0);
  expect(await tasksOf(account.uid)).toHaveLength(1);
});

test('Ctrl+K opens Ex-us from another screen and focuses the field; on Ex-us it only focuses; Cmd+K does the same', async ({ page }) => {
  const account = await createUser({ tag: 'exus-ctrl-k' });
  await openSignedIn(page, account, '#/today');
  const field = page.getByLabel('Wiadomość do Ex-us');

  // The shell registers the key in an effect right after it shows: on a slow machine the first press can come first.
  await expect(async () => {
    await page.keyboard.press('Control+K');
    await expect(page).toHaveURL(/#\/exus$/, { timeout: 1000 });
  }).toPass();
  await expect(field).toBeFocused();

  // Already on Ex-us: no new history entry, just the focus.
  await page.getByRole('log', { name: 'Rozmowa z Ex-us' }).click({ position: { x: 5, y: 5 } });
  await field.blur();
  await expect(field).not.toBeFocused();
  const entries = await page.evaluate(() => history.length);
  await page.keyboard.press('Control+K');
  await expect(field).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(entries);

  await page.evaluate(() => (location.hash = '#/goals'));
  await expect(page).toHaveURL(/#\/goals$/);
  await page.keyboard.press('Meta+K');
  await expect(page).toHaveURL(/#\/exus$/);
  await expect(field).toBeFocused();
});

test('Ctrl+K does nothing when Ex-us is off', async ({ page }) => {
  const account = await createUser({ tag: 'exus-ctrl-k-off', profile: { enabledModules: ['money', 'chores', 'stats', 'notes'] } });
  await openSignedIn(page, account, '#/today');
  await page.keyboard.press('Control+K');
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/#\/today$/);
});

test('offline, a command that needs the server says so; a write Firestore queues still goes; plain text says the chat needs the internet', async ({ page, context }) => {
  const account = await goalsAccount('exus-offline');
  await openSignedIn(page, account, '#/exus');
  const replies = page.locator('.exus-msg--exus');
  // Everything the screen loads lazily is loaded first (offline, a missing chunk would reload the page, as it does on a stale deploy).
  await send(page, '/saldo');
  await expect(replies.last()).toContainText('Saldo: 50,00 zł.');
  await send(page, '/statystyki');
  await expect(replies.last()).toContainText('Punkty z ostatnich 7 dni');
  await send(page, '/szukaj nic');
  await expect(replies.last()).toContainText('nic');
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

  await send(page, '/cel Rower 1500 zł');
  await expect(replies.last()).toHaveText('To polecenie wymaga internetu. Połącz się i spróbuj ponownie.');
  // Before any card: no form for a command that cannot run.
  await send(page, '/cel');
  await expect(replies.last()).toHaveText('To polecenie wymaga internetu. Połącz się i spróbuj ponownie.');
  await expect(page.getByRole('form', { name: /^Uzupełnij/ })).toHaveCount(0);
  await send(page, '/wydatek 5 jedzenie');
  await expect(replies.last()).toHaveText('To polecenie wymaga internetu. Połącz się i spróbuj ponownie.');
  await send(page, 'odłóż 50 zł na rower');
  await expect(replies.last()).toContainText('Rozmowa z Ex-us wymaga internetu.');
  // Reads from what is loaded and single queued writes go on, as on the screens.
  await send(page, '/zadanie Offline jutro');
  await expect(replies.last()).toContainText('Dodano zadanie „Offline”');

  await context.setOffline(false);
  await expect.poll(() => goalsOf(account.uid)).toEqual([]);
  await expect.poll(() => tasksOf(account.uid)).toHaveLength(1);
  await send(page, '/cel Rower 1500 zł');
  await expect(replies.last()).toContainText('Dodano cel „Rower”');
});

test('slow storage cannot bring an old conversation back: writes land in the order they were made, so /nowy sticks', async ({ page }) => {
  const account = await createUser({ tag: 'exus-history-order' });
  // Each open of the history database takes less time than the one before it: without ordering, the newest write would commit first and the oldest last.
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let calls = 0;
    IDBFactory.prototype.open = function (name, version) {
      if (name !== 'lifexp-v2-exus') return open.call(this, name, version);
      const delay = Math.max(0, 900 - 150 * calls++);
      let real;
      const proxy = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        get result() {
          return real.result;
        },
        get error() {
          return real.error;
        },
      };
      setTimeout(() => {
        real = open.call(this, name, version);
        real.onupgradeneeded = (e) => proxy.onupgradeneeded?.(e);
        real.onsuccess = (e) => proxy.onsuccess?.(e);
        real.onerror = (e) => proxy.onerror?.(e);
      }, delay);
      return proxy;
    };
  });
  await openSignedIn(page, account, '#/exus');
  await expect(log(page)).toContainText('Wpisz /pomoc');
  await send(page, '/pomoc');
  await expect(log(page)).toContainText('Komendy (kolejność argumentów dowolna):');
  await send(page, '/nie-ma-takiej');
  await send(page, '/nowy');
  await expect(page.locator('.exus-msg')).toHaveCount(1);

  const stored = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open('lifexp-v2-exus');
          open.onerror = () => resolve(-1);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('history')) return resolve(0);
            const all = db.transaction('history').objectStore('history').getAll();
            all.onsuccess = () => resolve(all.result.flat().length);
          };
        }),
    );
  // Every write has landed once the stored conversation stops changing; it must be the empty one.
  await page.waitForTimeout(3000);
  expect(await stored()).toBe(0);
});
