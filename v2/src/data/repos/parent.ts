// Read-only data for the parent's view (docs/v2/PLAN.md 9.1, row 6-2), as v1's
// parent.html reads it: one-time reads, never a write. The Firestore rules decide
// what a parent may read (firestore.rules: users/{uid} when its parentEmail is the
// signed-in e-mail; every subcollection except moneyTransactions, moneyCategories,
// moneyLoans, fcmTokens and money/settings), and nothing here asks for more.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import type { Activity, DayLog } from '@/domain/activity';
import type { ChoreEntry, ChorePayout } from '@/domain/chores';
import { PARENT_PAYOUT_COUNT, PARENT_RECENT_COUNT, type ParentInput, type ParentProfile } from '@/domain/parent';
import { groszeFromZloty } from '@/lib/money';
import { activityDefName, activityFromData, dayLogFromData } from '../converters/activity';
import { choreEntryFromData, chorePayoutFromData } from '../converters/chores';
import { numberOr } from '../converters/fields';
import { profileFromData } from '../converters/profile';
import { purchaseFromData } from '../converters/purchases';
import { db } from '../firebase';

export interface Child {
  uid: string;
  profile: ParentProfile;
}

/**
 * v1 loadChildren(): the accounts whose parentEmail is exactly the signed-in e-mail.
 * The rule checks every returned document, so the query must filter on parentEmail.
 */
export async function findChildren(email: string): Promise<Child[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('parentEmail', '==', email)));
  return snap.docs.map((d) => ({ uid: d.id, profile: profileFromData(d.data()) }));
}

/**
 * Everything parentSummary needs about one child. Activities: the newest
 * PARENT_RECENT_COUNT (as v1) and every one since `since` (the 7-day window, for
 * the week's top activities).
 */
export async function loadChild(uid: string, profile: ParentProfile, since: Date): Promise<ParentInput> {
  const user = (...path: string[]) => collection(db, 'users', uid, ...path);
  const [days, recent, week, defs, chores, payouts, purchases, balance] = await Promise.all([
    getDocs(user('dailyLog')),
    getDocs(query(user('activities'), orderBy('timestamp', 'desc'), limit(PARENT_RECENT_COUNT))),
    getDocs(query(user('activities'), where('timestamp', '>=', since))),
    getDocs(user('activityDefs')),
    getDocs(user('chores')),
    getDocs(query(user('chorePayouts'), orderBy('createdAt', 'desc'), limit(PARENT_PAYOUT_COUNT))),
    getDocs(query(user('purchases'), orderBy('timestamp', 'desc'), limit(PARENT_RECENT_COUNT))),
    getDoc(doc(db, 'users', uid, 'money', 'balance')),
  ]);
  const activities = new Map<string, Activity>();
  for (const d of [...recent.docs, ...week.docs]) {
    const activity = activityFromData(d.id, d.data());
    if (activity) activities.set(d.id, activity);
  }
  return {
    profile,
    days: new Map<string, DayLog>(days.docs.map((d) => [d.id, dayLogFromData(d.data())])),
    activities: [...activities.values()],
    activityNames: new Map(
      defs.docs.flatMap((d) => {
        const name = activityDefName(d.data());
        return name ? [[d.id, name] as const] : [];
      }),
    ),
    choreEntries: chores.docs.flatMap((d): ChoreEntry[] => {
      const entry = choreEntryFromData(d.id, d.data());
      return entry ? [entry] : [];
    }),
    chorePayouts: payouts.docs.map((d): ChorePayout => chorePayoutFromData(d.id, d.data())),
    purchases: purchases.docs.map((d) => purchaseFromData(d.id, d.data())),
    moneyBalance: balance.exists() ? groszeFromZloty(numberOr(balance.data().current)) : null,
  };
}
