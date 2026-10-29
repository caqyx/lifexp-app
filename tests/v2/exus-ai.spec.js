// Ex-us plain text → exusTurn (docs/v2/PLAN.md 6.9, stage 5b-4) on the Firebase
// emulators. The Functions emulator runs the real handler with its fake model
// (functions/src/exus/fake.ts: deterministic replies, 100 tokens per call), so
// access, budget, the safe reply and the request itself are checked end to end.
const { createUser, db } = require('../support/emulator');
const { test, expect: baseExpect, openSignedIn } = require('../support/v2');

// The Functions emulator starts a worker for the first calls of a run (several seconds,
// more under load); every answer here waits for exusTurn, so allow for that.
const expect = baseExpect.configure({ timeout: 15000 });

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

const USER_DAILY_TOKENS = 20000;
const FAKE_TOKENS = 100;

/** The budget day of exusTurn: Warsaw. */
const warsawDay = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** An account on the AI test list (aiTestAccess/{uid}, as the owner adds them). */
async function aiAccount(tag, profile = {}) {
  const account = await createUser({ tag, profile });
  await db.doc(`aiTestAccess/${account.uid}`).set({});
  return account;
}

const usedTokens = (uid, tokens) => db.doc(`aiUsage/${uid}_${warsawDay()}`).set({ tokens, calls: 1 });

/** Every request to exusTurn, with its body. */
function watchTurns(page) {
  const bodies = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/exusTurn')) bodies.push(JSON.parse(req.postData() ?? '{}'));
  });
  return bodies;
}

async function send(page, text) {
  await page.getByLabel('Wiadomość do Ex-us').fill(text);
  await page.getByRole('button', { name: 'Wyślij' }).click();
}

/** The texts kept on the device for the conversation, read from IndexedDB. */
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

/** Waits until the message is on the device, as a person's pause before closing the app would (as in exus.spec). */
const expectKept = (page, fragment) => expect.poll(async () => (await keptTexts(page)).some((text) => text.includes(fragment))).toBe(true);

const log = (page) => page.getByRole('log', { name: 'Rozmowa z Ex-us' });
const replies = (page) => page.locator('.exus-msg--exus');
const bar = (page) => page.getByRole('progressbar', { name: 'Pozostały dzisiejszy limit Ex-us AI' });

test('plain text gets the AI reply in one call; it stays in the history; the bar shows what is left', async ({ page }) => {
  const account = await aiAccount('exus-ai-reply');
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  // Hidden until the first AI answer of the session.
  await expect(bar(page)).toHaveCount(0);

  await send(page, 'Cześć, jak leci?');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): Cześć, jak leci?');
  await expect(page.locator('.exus-msg--typing')).toHaveCount(0);
  expect(turns).toHaveLength(1);
  expect(turns[0].data).toMatchObject({ message: 'Cześć, jak leci?', history: [], lang: 'pl' });
  expect(typeof turns[0].data.clientVersion).toBe('string');
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '99');
  await expect(page.getByText('Limit AI na dziś: 99%')).toBeVisible();

  // The second turn carries the first as history; still one call per message.
  await send(page, 'A jutro?');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): A jutro?');
  expect(turns).toHaveLength(2);
  expect(turns[1].data.history).toEqual([
    { role: 'user', text: 'Cześć, jak leci?' },
    { role: 'model', text: 'Ex-us (emulator): Cześć, jak leci?' },
  ]);
  const usage = (await db.doc(`aiUsage/${account.uid}_${warsawDay()}`).get()).data();
  expect(usage).toMatchObject({ tokens: 2 * FAKE_TOKENS, calls: 2 });

  // Kept on the device like every other message.
  await expectKept(page, 'Ex-us (emulator): A jutro?');
  await page.reload();
  await expect(log(page)).toContainText('Ex-us (emulator): A jutro?');
  await expect(log(page)).toContainText('Cześć, jak leci?');
  expect(turns).toHaveLength(2);
});

test('the bar follows each answer', async ({ page }) => {
  const account = await aiAccount('exus-ai-bar');
  await usedTokens(account.uid, USER_DAILY_TOKENS / 2 - FAKE_TOKENS);
  await openSignedIn(page, account, '#/exus');
  await send(page, 'raz');
  await expect(page.getByText('Limit AI na dziś: 50%')).toBeVisible();
  await send(page, 'dwa');
  await expect(page.getByText('Limit AI na dziś: 49%')).toBeVisible();
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '49');
});

test('an account without AI access is told so once, then without calling again', async ({ page }) => {
  const account = await createUser({ tag: 'exus-ai-denied' });
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  await send(page, 'odłóż 50 zł na rower');
  await expect(replies(page).last()).toHaveText(/Ex-us AI jest na razie w testach/);
  expect(turns).toHaveLength(1);
  await send(page, 'a teraz?');
  await expect(replies(page).last()).toHaveText(/Ex-us AI jest na razie w testach/);
  await expect(replies(page)).toHaveCount(3);
  expect(turns).toHaveLength(1);
  await expect(bar(page)).toHaveCount(0);
  // Commands still work.
  await send(page, '/dzis');
  await expect(log(page)).toContainText('Punkty');
});

test('a used-up budget: the last call brings the bar to 0, the next is refused with when it renews', async ({ page }) => {
  const account = await aiAccount('exus-ai-budget');
  await usedTokens(account.uid, USER_DAILY_TOKENS - FAKE_TOKENS / 2);
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  await send(page, 'ostatnie pytanie');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): ostatnie pytanie');
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '0');
  await send(page, 'jeszcze jedno');
  await expect(replies(page).last()).toHaveText('Dzisiejszy limit Ex-us AI się wyczerpał. Odnowi się o północy. Komendy z / działają dalej.');
  await expect(page.getByText('Limit AI na dziś: 0%')).toBeVisible();
  expect(turns).toHaveLength(2);
});

test('a budget used up before the session shows the bar from the refusal', async ({ page }) => {
  const account = await aiAccount('exus-ai-budget-fresh');
  await usedTokens(account.uid, USER_DAILY_TOKENS);
  await openSignedIn(page, account, '#/exus');
  await send(page, 'hej');
  await expect(replies(page).last()).toHaveText(/limit Ex-us AI się wyczerpał/);
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '0');
});

test('a malformed model answer becomes the safe reply', async ({ page }) => {
  const account = await aiAccount('exus-ai-malformed');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'zepsuj');
  await expect(replies(page).last()).toHaveText('Coś poszło nie tak po mojej stronie. Spróbuj napisać to jeszcze raz, innymi słowami.');
});

test('the reply is Markdown, sanitized', async ({ page }) => {
  const account = await aiAccount('exus-ai-markdown');
  await openSignedIn(page, account, '#/exus');
  await send(page, '**gruby** <img src=x onerror=alert(1)>');
  const reply = replies(page).last();
  await expect(reply.locator('strong')).toHaveText('gruby');
  await expect(reply.locator('img[onerror]')).toHaveCount(0);
});

test('offline, plain text makes no call', async ({ page, context }) => {
  const account = await aiAccount('exus-ai-offline');
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  // One turn online first: offline, a chunk not loaded yet would reload the page (as on a stale deploy).
  await send(page, 'online');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): online');
  // The Markdown renderer is its own chunk: rendered, not the plain fallback, means it has loaded.
  await expect(replies(page).last().locator('.ui-markdown:not(.ui-markdown--plain)')).toHaveCount(1);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await send(page, 'czy działa?');
  await expect(replies(page).last()).toContainText('Rozmowa z Ex-us wymaga internetu.');
  await context.setOffline(false);
  expect(turns).toHaveLength(1);
});

test('online, a function that does not answer is "unavailable", not a connection problem; slash commands still work', async ({ page }) => {
  const account = await aiAccount('exus-ai-down');
  await page.route('**/exusTurn', (route) => route.abort());
  await openSignedIn(page, account, '#/exus');
  await send(page, 'cześć');
  await expect(replies(page).last()).toContainText('Ex-us AI jest teraz niedostępne. Komendy z / działają normalnie — wpisz /pomoc.');
  // Not remembered as a denial: the next message tries again.
  await send(page, 'a teraz?');
  await expect(replies(page).last()).toContainText('Ex-us AI jest teraz niedostępne.');
  await send(page, '/dzis');
  await expect(replies(page).last()).not.toContainText('niedostępne');
});

test('the context sent names things by short refs, never by Firestore ids', async ({ page }) => {
  const account = await aiAccount('exus-ai-context');
  const ids = { task: 'seededTaskDocId7Q', chore: 'seededChoreDocId3Z', category: 'seededCategoryDocId9X' };
  await db.doc(`users/${account.uid}/todos/${ids.task}`).set({ text: 'Wypracowanie', dueDate: '2099-01-01', size: 'M', done: false, createdAt: new Date() });
  await db.doc(`users/${account.uid}/choreDefs/${ids.chore}`).set({ name: 'Zmywarka', points: 15, order: 0, oneTime: false, emoji: '', desc: '' });
  await db.doc(`users/${account.uid}/moneyCategories/${ids.category}`).set({ name: 'jedzenie', color: '#888888' });
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 12.5 });
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  // The context is built from what the screen's listeners have.
  await send(page, '/zadania wszystkie');
  await expect(log(page)).toContainText('Wypracowanie');
  await send(page, 'co mam dziś?');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): co mam dziś?');
  expect(turns).toHaveLength(1);
  const body = JSON.stringify(turns[0]);
  const { context } = turns[0].data;
  expect(context.tasks).toEqual([expect.objectContaining({ ref: 't1', text: 'Wypracowanie' })]);
  expect(context.chores.defs).toEqual([expect.objectContaining({ ref: 'c1', name: 'Zmywarka' })]);
  expect(context.categories).toContain('jedzenie');
  expect(context.money.balance).toBe(12.5);
  for (const id of [...Object.values(ids), account.uid]) expect(body).not.toContain(id);
  expect(body).not.toContain(account.email);
});

// ── Actions proposed by the AI (stage 5b-5, PLAN.md 6.6 row 3) ──

const proposal = (page, what) => page.getByRole('form', { name: `Propozycja: ${what}` });
const tasksOf = async (uid) => (await db.collection(`users/${uid}/todos`).get()).docs.map((d) => d.data());
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Waits until the tasks are loaded, so the context the next turn sends has them. */
async function tasksLoaded(page, text) {
  await send(page, '/zadania wszystkie');
  await expect(log(page)).toContainText(text);
}

test('a proposed task is a card filled in; Wykonaj writes it as v1 does, the card is read-only, /cofnij takes it back', async ({ page }) => {
  const account = await aiAccount('exus-ai-card');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'dodaj zadanie kupić mleko');
  await expect(replies(page).filter({ hasText: 'Ex-us (emulator): create-task' })).toHaveCount(1);
  const card = proposal(page, 'Nowe zadanie');
  await expect(card).toBeVisible();
  await expect(card.getByLabel('treść', { exact: true })).toHaveValue('kupić mleko');
  await expect(card.getByLabel('termin', { exact: true })).toHaveValue(localDay(1));
  // Nothing is written before Wykonaj.
  expect(await tasksOf(account.uid)).toEqual([]);
  await card.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Dodano zadanie „kupić mleko”');
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Do wykonania: /zadanie' })).toBeVisible();
  await expect.poll(() => tasksOf(account.uid)).toEqual([expect.objectContaining({ text: 'kupić mleko', dueDate: localDay(1), size: 'M', done: false })]);
  await send(page, '/cofnij');
  await expect.poll(() => tasksOf(account.uid)).toEqual([]);
});

test('Pomiń skips the proposal; the next turn is told it was skipped, and of the card still waiting as p1', async ({ page }) => {
  const account = await aiAccount('exus-ai-skip');
  const turns = watchTurns(page);
  await openSignedIn(page, account, '#/exus');
  await send(page, 'dodaj zadanie pierwsze');
  await proposal(page, 'Nowe zadanie').getByRole('button', { name: 'Pomiń' }).click();
  await expect(log(page)).toContainText('Pominięto.');
  await send(page, 'dodaj zadanie drugie');
  await expect(proposal(page, 'Nowe zadanie')).toHaveCount(1);
  await send(page, 'co dalej?');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): co dalej?');
  expect(turns).toHaveLength(3);
  expect(turns[1].data.context.recentActions).toEqual([{ command: 'create-task', status: 'skipped' }]);
  expect(turns[2].data.context.pendingActions).toEqual([{ ref: 'p1', command: 'create-task', args: { text: 'drugie', due: localDay(1) } }]);
  expect(turns[0].data.context.pendingActions).toBeUndefined();
});

test('at most three cards; a ref Ex-us never gave is a line, not a card', async ({ page }) => {
  const account = await aiAccount('exus-ai-many');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'wiele');
  await expect(proposal(page, 'Nowe zadanie')).toHaveCount(3);
  await send(page, 'zgubiony');
  await expect(replies(page).last()).toHaveText('Nie wiem, o którą rzecz chodzi w tej propozycji. Napisz jeszcze raz, jej nazwą.');
  await expect(page.getByRole('form', { name: /^Propozycja: Oznacz/ })).toHaveCount(0);
  await expect(page.locator('form.exus-card')).toHaveCount(3);
});

test('edit-pending changes the waiting card in place', async ({ page }) => {
  const account = await aiAccount('exus-ai-edit');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'dodaj zadanie mleko');
  const card = proposal(page, 'Nowe zadanie');
  await expect(card.getByLabel('termin', { exact: true })).toHaveValue(localDay(1));
  await card.getByLabel('treść', { exact: true }).fill('mleko 2%');
  // "piątek" is the nearest Friday, today included (dateFrom in domain/exus/recognizers.ts).
  // From Thursday on, "jutro" can already be that Friday, so the person first moves the due
  // to the Saturday after it: the edit then visibly changes the field on every weekday.
  const friday = localDay((5 - new Date().getDay() + 7) % 7);
  const saturday = localDay((5 - new Date().getDay() + 7) % 7 + 1);
  await card.getByLabel('termin', { exact: true }).fill(saturday);
  await send(page, 'zmień termin na piątek');
  await expect(log(page)).toContainText('Zaktualizowano propozycję.');
  // The same card changed in place; no second card was added.
  await expect(card).toHaveCount(1);
  await expect(page.locator('form.exus-card')).toHaveCount(1);
  await expect(card.getByLabel('termin', { exact: true })).toHaveValue(friday);
  expect(new Date(`${friday}T12:00:00Z`).getUTCDay()).toBe(5);
  // What the person typed into the card stays.
  await expect(card.getByLabel('treść', { exact: true })).toHaveValue('mleko 2%');
});

test('edit-pending with no waiting card changes nothing (the server drops it)', async ({ page }) => {
  const account = await aiAccount('exus-ai-edit-none');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'zmień termin na piątek');
  await expect(replies(page).last()).toHaveText('Ex-us (emulator): edit-pending');
  // The server drops edit-pending without a card in pendingActions: no line, no card.
  await expect(page.locator('form.exus-card')).toHaveCount(0);
});

test('a read action runs at once; a destructive one is a card whose Wykonaj asks in the dialog', async ({ page }) => {
  const account = await aiAccount('exus-ai-destructive');
  await db.doc(`users/${account.uid}/money/balance`).set({ current: 50 });
  await db.doc(`users/${account.uid}/todos/aiDeleteMe`).set({ text: 'Do usunięcia', dueDate: '2099-01-01', size: 'S', done: false, createdAt: new Date().toISOString() });
  await openSignedIn(page, account, '#/exus');
  await send(page, 'jakie mam saldo?');
  await expect(log(page)).toContainText('Saldo: 50,00 zł.');
  await expect(page.locator('form.exus-card')).toHaveCount(0);

  await tasksLoaded(page, 'Do usunięcia');
  await send(page, 'usuń to zadanie');
  const card = proposal(page, 'Usuń zadanie (budowa PC zostaje bez zmian)');
  await expect(card.getByLabel('zadanie', { exact: true })).toHaveValue('Do usunięcia');
  await card.getByRole('button', { name: 'Wykonaj' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Do usunięcia');
  expect(await tasksOf(account.uid)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Usunięto zadanie „Do usunięcia”.');
  await expect.poll(() => tasksOf(account.uid)).toEqual([]);
});

test('after a reload: a run card and a skipped one stay read-only, a waiting one has expired', async ({ page }) => {
  const account = await aiAccount('exus-ai-reload');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'dodaj zadanie raz');
  await proposal(page, 'Nowe zadanie').getByRole('button', { name: 'Wykonaj' }).click();
  await expect(log(page)).toContainText('Dodano zadanie „raz”');
  await send(page, 'dodaj zadanie dwa');
  await proposal(page, 'Nowe zadanie').getByRole('button', { name: 'Pomiń' }).click();
  await send(page, 'dodaj zadanie trzy');
  await expect(proposal(page, 'Nowe zadanie')).toHaveCount(1);
  await expectKept(page, 'Propozycja wygasła: Nowe zadanie.');
  await page.reload();
  await expect(log(page)).toContainText('Propozycja wygasła: Nowe zadanie.');
  await expect(page.getByRole('region', { name: 'Do wykonania: /zadanie' })).toBeVisible();
  await expect(log(page)).toContainText('Pominięto.');
  await expect(page.locator('form.exus-card')).toHaveCount(0);
  await expect.poll(() => tasksOf(account.uid)).toHaveLength(1);
});

test('on a phone the cards fit without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const account = await aiAccount('exus-ai-phone');
  await openSignedIn(page, account, '#/exus');
  await send(page, 'wiele');
  await expect(proposal(page, 'Nowe zadanie')).toHaveCount(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
