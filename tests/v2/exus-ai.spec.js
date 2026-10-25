// Ex-us plain text → exusTurn (docs/v2/PLAN.md 6.9, stage 5b-4) on the Firebase
// emulators. The Functions emulator runs the real handler with its fake model
// (functions/src/exus/fake.ts: deterministic replies, 100 tokens per call), so
// access, budget, the safe reply and the request itself are checked end to end.
const { createUser, db } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');

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
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await send(page, 'czy działa?');
  await expect(replies(page).last()).toContainText('Rozmowa z Ex-us wymaga internetu.');
  await context.setOffline(false);
  expect(turns).toHaveLength(1);
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
