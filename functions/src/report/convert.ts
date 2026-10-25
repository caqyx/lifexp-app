// users/{uid} and its documents (Admin SDK) → the v2 domain's input, as the v2
// converters read them (v2/src/data/converters): złoty → grosze, defaults for
// missing fields. Only what weeklyReport reads.
import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import type { DayLog } from '../v2/domain/activity';
import type { Goal } from '../v2/domain/goals';
import { MONEY_LIMIT_DEFAULT, type MoneyTx } from '../v2/domain/money';
import type { ParentProfile, Purchase } from '../v2/domain/parent';
import type { Profile } from '../v2/domain/profile';
import { groszeFromZloty } from '../v2/lib/money';

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const dayKey = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function dateOrNull(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** v2 converters/goals goalsFromData. */
function goalsOf(value: unknown): Goal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown): Goal[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const g = entry as Record<string, unknown>;
    if (typeof g.id !== 'string' || g.id === '') return [];
    const type = g.type === 'money' ? 'money' : 'points';
    const amount = num(g.amount);
    return [{ id: g.id, name: str(g.name), type, target: type === 'money' ? groszeFromZloty(amount) : amount, saved: groszeFromZloty(num(g.saved)), celebrated: g.celebrated === true }];
  });
}

export type ReportProfile = ParentProfile &
  Pick<Profile, 'autoReport' | 'parentEmail' | 'parentEmailVerifiedAt'> & {
    /** v1's lastReportSent: the day ("YYYY-MM-DD") a report last went out. */
    lastReportSent: string | null;
  };

/** v2 converters/profile profileFromData, the report's fields. */
export function reportProfile(data: DocumentData): ReportProfile {
  const points = (typeof data.points === 'object' && data.points !== null ? data.points : {}) as Record<string, unknown>;
  return {
    name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name : 'Użytkownik',
    points: { total: num(points.total), earnedAllTime: num(points.earnedAllTime), spentAllTime: num(points.spentAllTime) },
    rateGeneral: { zloty: numOrNull(data.pointsRateGeneralZl), points: numOrNull(data.pointsRateGeneralPts) },
    rateChores: { zloty: numOrNull(data.pointsRateChoresZl), points: numOrNull(data.pointsRateChoresPts) },
    streakFreezeLastUsed: dayKey(data.streakFreezeLastUsed),
    goals: goalsOf(data.goals),
    autoReport: data.autoReport === true,
    parentEmail: str(data.parentEmail),
    parentEmailVerifiedAt: typeof data.parentEmailVerifiedAt === 'string' && data.parentEmailVerifiedAt !== '' ? data.parentEmailVerifiedAt : null,
    lastReportSent: dayKey(data.lastReportSent),
  };
}

export const dayLogOf = (data: DocumentData | undefined): DayLog => ({
  pointsEarned: num(data?.pointsEarned),
  gamingMinutes: num(data?.gamingMinutes),
});

export const purchaseOf = (id: string, data: DocumentData): Purchase => ({
  id,
  description: str(data.description).trim(),
  grosze: groszeFromZloty(num(data.amount)),
  pointsCost: num(data.pointsCost),
  at: dateOrNull(data.timestamp),
});

export const txOf = (id: string, data: DocumentData): MoneyTx => ({
  id,
  type: data.type === 'income' ? 'income' : 'expense',
  grosze: groszeFromZloty(num(data.amount)),
  category: str(data.category),
  note: str(data.note),
  date: dayKey(data.date) ?? '',
  source: str(data.source, 'manual'),
  pointsCost: num(data.pointsCost),
  createdAt: dateOrNull(data.createdAt),
});

/** money/settings.monthlyLimit in grosze; v1 falls back to 200 zł. */
export function monthlyLimitOf(data: DocumentData | undefined): number {
  const limit = data?.monthlyLimit;
  return typeof limit === 'number' && Number.isFinite(limit) ? groszeFromZloty(limit) : MONEY_LIMIT_DEFAULT;
}

/** money/balance.current (złoty) in grosze. */
export const balanceOf = (data: DocumentData | undefined): number => groszeFromZloty(num(data?.current));
