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
  await expect(list.getByRole('button')).toHaveCount(9);
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
