// Daily token budgets (docs/v2/PLAN.md 6.12): one counter per account and day,
// aiUsage/{uid}_{YYYY-MM-DD}, and one fuse for everybody, aiUsageGlobalV2/{YYYY-MM-DD},
// both { tokens, calls, updatedAt }. Top-level and closed to clients in
// firestore.rules: only this function (Admin SDK) reads or writes them.
import { HttpsError } from 'firebase-functions/https';
import type { Firestore } from 'firebase-admin/firestore';
import { BUDGET_TIME_ZONE, GLOBAL_DAILY_TOKENS, USER_DAILY_TOKENS } from './config';
import type { TurnInput } from './input';

export const USER_USAGE = 'aiUsage';
export const GLOBAL_USAGE = 'aiUsageGlobalV2';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUDGET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD of `now` in Warsaw. */
export function dayKey(now: Date): string {
  return dayFormat.format(now);
}

export interface Usage {
  tokensUsedToday: number;
  tokensLimitDaily: number;
  remainingPercent: number;
}

export function usageOf(tokensUsedToday: number): Usage {
  const left = 1 - tokensUsedToday / USER_DAILY_TOKENS;
  return {
    tokensUsedToday,
    tokensLimitDaily: USER_DAILY_TOKENS,
    remainingPercent: Math.max(0, Math.min(100, Math.floor(left * 100))),
  };
}

const refs = (db: Firestore, uid: string, day: string) => ({
  user: db.doc(`${USER_USAGE}/${uid}_${day}`),
  global: db.doc(`${GLOBAL_USAGE}/${day}`),
});

const tokensIn = (data: unknown): number => {
  const t = (data as { tokens?: unknown } | undefined)?.tokens;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : 0;
};
const callsIn = (data: unknown): number => {
  const c = (data as { calls?: unknown } | undefined)?.calls;
  return typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : 0;
};

const EXHAUSTED = {
  user: {
    pl: 'Dzisiejszy limit Ex-us na tym koncie się wyczerpał. Wróć jutro albo użyj komend /.',
    en: "Today's Ex-us limit for this account is used up. Come back tomorrow or use / commands.",
  },
  global: {
    pl: 'Ex-us ma dziś przerwę: dzienny limit całej aplikacji się wyczerpał. Wróć jutro albo użyj komend /.',
    en: 'Ex-us is taking a break today: the daily limit of the whole app is used up. Come back tomorrow or use / commands.',
  },
} as const;

/** Throws `resource-exhausted` when either budget is spent; else returns today's usage so far. */
export async function checkBudget(db: Firestore, uid: string, day: string, lang: TurnInput['lang']): Promise<number> {
  const { user, global } = refs(db, uid, day);
  return db.runTransaction(async (tx) => {
    const [u, g] = [await tx.get(user), await tx.get(global)];
    const used = tokensIn(u.data());
    if (used >= USER_DAILY_TOKENS) {
      throw new HttpsError('resource-exhausted', EXHAUSTED.user[lang], { reason: 'user', usage: usageOf(used) });
    }
    if (tokensIn(g.data()) >= GLOBAL_DAILY_TOKENS) {
      throw new HttpsError('resource-exhausted', EXHAUSTED.global[lang], { reason: 'global', usage: usageOf(used) });
    }
    return used;
  });
}

/** Adds one call and its real tokens to both counters; returns the account's total for the day. */
export async function recordUsage(db: Firestore, uid: string, day: string, tokens: number, now: Date): Promise<number> {
  const { user, global } = refs(db, uid, day);
  const add = Math.max(0, Math.round(tokens));
  return db.runTransaction(async (tx) => {
    const [u, g] = [await tx.get(user), await tx.get(global)];
    const userTokens = tokensIn(u.data()) + add;
    tx.set(user, { tokens: userTokens, calls: callsIn(u.data()) + 1, updatedAt: now }, { merge: true });
    tx.set(global, { tokens: tokensIn(g.data()) + add, calls: callsIn(g.data()) + 1, updatedAt: now }, { merge: true });
    return userTokens;
  });
}
