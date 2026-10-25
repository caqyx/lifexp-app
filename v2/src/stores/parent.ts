// The parent's view (docs/v2/PLAN.md 9.1, row 6-2). A parent is whoever signs in
// with the e-mail a child entered as parentEmail (v1 parent.html: no role, no flag
// on the parent's own account, only that match; firestore.rules checks the same).
// So the children are looked up once per signed-in e-mail: the menu lists "Rodzic"
// only when there is at least one, and #/parent reads the chosen child's data.
// One-time reads, as v1: nothing here listens, and nothing writes.
import { signal } from '@preact/signals';
import type { ParentInput, ParentProfile } from '@/domain/parent';
import { addDays, utcDayKey } from '@/lib/dates';

export interface ParentChild {
  uid: string;
  profile: ParentProfile;
}

/** For one e-mail: undefined = looking, 'error' = the read failed. */
export interface ChildrenState {
  email: string;
  children: readonly ParentChild[] | undefined | 'error';
}

export const parentChildren = signal<ChildrenState | null>(null);

/** Looks the children up for `email` (again, when asked to refresh); '' (no e-mail) means none. */
export function findParentChildren(email: string, refresh = false): void {
  const current = parentChildren.value;
  if (!refresh && current?.email === email && current.children !== 'error') return;
  if (!email) {
    parentChildren.value = { email, children: [] };
    return;
  }
  if (current?.email !== email) parentChildren.value = { email, children: undefined };
  void import('@/data/repos/parent')
    .then((repo) => repo.findChildren(email))
    .then(
      (children) => {
        if (parentChildren.value?.email === email) parentChildren.value = { email, children };
      },
      () => {
        if (parentChildren.value?.email === email) parentChildren.value = { email, children: 'error' };
      },
    );
}

/** The menu's "Rodzic": signed in with an e-mail some child entered as parentEmail. */
export function isParent(email: string): boolean {
  const state = parentChildren.value;
  return state?.email === email && Array.isArray(state.children) && state.children.length > 0;
}

/** One child's data: undefined = loading. */
export interface ChildData {
  uid: string;
  input: ParentInput | undefined | 'error';
}

export const childData = signal<ChildData | null>(null);

/** Reads everything the parent's view shows about `child`. */
export function loadChildData(child: ParentChild, now: Date = new Date()): void {
  childData.value = { uid: child.uid, input: undefined };
  // The 7-day window starts at 00:00 UTC of today − 6 (dailyLog days are UTC days, G13).
  const since = new Date(`${addDays(utcDayKey(now), -6)}T00:00:00Z`);
  void import('@/data/repos/parent')
    .then((repo) => repo.loadChild(child.uid, child.profile, since))
    .then(
      (input) => {
        if (childData.value?.uid === child.uid) childData.value = { uid: child.uid, input };
      },
      () => {
        if (childData.value?.uid === child.uid) childData.value = { uid: child.uid, input: 'error' };
      },
    );
}
