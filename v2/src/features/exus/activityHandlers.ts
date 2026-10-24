// The XP commands (docs/v2/PLAN.md 6.5, "XP / aktywności"): /aktywnosc, /seria,
// /statystyki, /co-teraz. Logging goes through the same service as the Today
// sheet (services/activity: one transaction, the daily limit read on the server),
// the reads use the same domain functions as Today's streak card and the Stats
// screen. Whatever they read is awaited first.
import { activityLabel, findActivity, splitTypeDesc, whatNow } from '@/domain/exus/activities';
import { periodStats, type StatsPeriod } from '@/domain/exus/stats';
import {
  ACTIVITY_MIN_MINUTES,
  activityName,
  generatorPool,
  type Activity,
  type ActivityDef,
  type ActivityDraft,
} from '@/domain/activity';
import { levelOf, levelTitleIndex } from '@/domain/points';
import { FREEZE_COOLDOWN_DAYS, streakOf } from '@/domain/streak';
import { formatDuration } from '@/features/shared/activity';
import { locale, t } from '@/i18n';
import { formatDayMonth, localDayKey, utcDayKey } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { ensureActivityDefs, removeActivity, saveActivity } from '@/services/activity';
import { stats as statsSources } from '@/stores/stats';
import { today as todaySources } from '@/stores/today';
import type { CommandHandler } from './handlers';
import { loadedStats, loadedToday, seeded } from './loaded';

/** The activity types; an account without any gets v1's list first, as opening the log sheet does. */
const loadedDefs = (uid: string) => seeded(loadedToday('activityDefs'), () => todaySources.value.activityDefs, () => ensureActivityDefs(uid));

const quoted = (names: readonly string[]) => names.map((n) => `„${n}”`).join(', ');

/** The Today sheet's own sentences about what an activity would credit. */
function creditLine(points: number, earned: number, limit: number): string {
  const lang = locale();
  if (points === 0) return t('activity.limitReached', { limit: formatInteger(limit, lang) });
  if (points < earned) {
    return t('activity.willEarnCapped', { points: formatInteger(points, lang), earned: formatInteger(earned, lang), limit: formatInteger(limit, lang) });
  }
  return t('activity.willEarn', { points: formatInteger(points, lang) });
}

const NO_NAMES: ReadonlyMap<string, string> = new Map();

/** "Nauka (JS, Unity, C#), 1 h, 12 paź, 40 pkt" for the lists of activities that fit. */
function listLine(activity: Activity, names: ReadonlyMap<string, string>, lang: string): string {
  return t('exus.activity.line', {
    name: activityLabel(activity, names),
    time: formatDuration(activity.duration),
    date: formatDayMonth(localDayKey(activity.at), lang),
    points: formatInteger(activity.points, lang),
  });
}

/** The activity a /usun-aktywnosc names among the newest ones the Stats screen reads, or what to answer. */
function findOne(args: Record<string, unknown>): { activity: Activity; names: ReadonlyMap<string, string> } | { reply: string } {
  const { latest, activityNames } = statsSources.value;
  const names = activityNames ?? NO_NAMES;
  const ref = typeof args.ref === 'string' ? args.ref : undefined;
  const match = findActivity(ref, latest ?? [], names);
  if (match.kind === 'found') return { activity: match.activity, names };
  if (match.kind === 'ambiguous') {
    const lang = locale();
    return { reply: [t('exus.activity.deleteAmbiguous'), ...match.activities.slice(0, 5).map((a) => listLine(a, names, lang))].join('\n') };
  }
  const named = ref !== undefined && ref.trim() !== '' && !/^(ostatni[ae]?|last|latest)$/i.test(ref.trim());
  return { reply: named ? t('exus.activity.deleteNone', { name: ref }) : t('exus.activity.noActivities') };
}

export const ACTIVITY_HANDLERS = {
  'log-activity': {
    run: async (args, { uid, profile }) => {
      let defs: readonly ActivityDef[];
      try {
        defs = await loadedDefs(uid);
      } catch {
        return { reply: t('today.loadFailed') };
      }
      if (defs.length === 0) return { reply: t('activity.noDefs') };
      const words = String(args.type).split(/\s+/).filter(Boolean);
      const split = splitTypeDesc(words, defs);
      if (split.kind === 'ambiguous') return { reply: t('exus.activity.ambiguous', { names: quoted(split.names) }) };
      if (split.kind === 'none') return { reply: t('exus.activity.none', { name: words[0] ?? '', names: quoted(defs.map((d) => d.name)) }) };
      const minutes = args.duration as number;
      if (minutes < ACTIVITY_MIN_MINUTES) return { reply: t('activity.needMinutes', { min: ACTIVITY_MIN_MINUTES }) };
      const { def, desc } = split;
      const draft: ActivityDraft = { type: def.id, minutes, desc, generated: null };
      // Logging moves points and needs the server (a transaction); offline drafts stay a Today feature.
      if (!navigator.onLine) return { reply: t('exus.activity.offline') };
      try {
        const result = await saveActivity(uid, draft, defs);
        const lang = locale();
        if (!result.ok) {
          return result.problem === 'dailyLimit'
            ? { reply: `${t('activity.limitReached', { limit: formatInteger(result.limit ?? 0, lang) })} ${t('exus.activity.nothingSaved')}` }
            : { reply: t('activity.needMinutes', { min: ACTIVITY_MIN_MINUTES }) };
        }
        // The credit and the limit are the transaction's, not the profile snapshot's.
        const { points, earned, limit, id } = result;
        const before = levelOf(profile.points.earnedAllTime).level;
        const level = levelOf(profile.points.earnedAllTime + points).level;
        const title = t(`today.levelTitle.${levelTitleIndex(level)}` as 'today.levelTitle.1');
        const lines = [t('exus.activity.logged', { name: def.name, time: formatDuration(minutes), points: formatInteger(points, lang) })];
        if (points < earned) lines.push(t('exus.activity.capped', { earned: formatInteger(earned, lang), points: formatInteger(points, lang), limit: formatInteger(limit, lang) }));
        if (level > before) lines.push(t('exus.activity.levelUp', { level, title }));
        return {
          reply: lines.join(' '),
          write: {
            saved: Promise.resolve(),
            toast: level > before ? t('activity.levelUp', { points, level, title }) : t('activity.earned', { points, name: def.name }),
            failed: t('activity.saveFailed'),
          },
          // The delete service takes the points back off the entry's day and the totals, exactly.
          undo: {
            what: t('exus.undoWhat.log-activity', { name: def.name, points }),
            run: () => removeActivity(uid, { id }).then(() => undefined),
          },
        };
      } catch {
        return { reply: t('activity.saveFailed') };
      }
    },
  },

  'delete-activity': {
    ready: async () => {
      await Promise.all([loadedStats('latest'), loadedStats('activityNames')]);
    },
    check: (args) => {
      const found = findOne(args);
      return 'reply' in found ? found.reply : null;
    },
    effect: (args) => {
      const found = findOne(args);
      if ('reply' in found) return found.reply;
      const { activity, names } = found;
      const lang = locale();
      return t('exus.activity.deleteEffect', {
        name: activityName(activity, names),
        time: formatDuration(activity.duration),
        date: formatDayMonth(localDayKey(activity.at), lang),
        points: formatInteger(activity.points, lang),
      });
    },
    run: async (args, { uid }) => {
      try {
        await Promise.all([loadedStats('latest'), loadedStats('activityNames')]);
      } catch {
        return { reply: t('stats.loadFailed') };
      }
      // Read again: the list may have changed while the dialog was open.
      const found = findOne(args);
      if ('reply' in found) return found;
      const { activity, names } = found;
      try {
        // The same service as the History view: the entry goes, its points come off the day and the totals (G11).
        const points = await removeActivity(uid, activity);
        // No undo: nothing writes an activity back with its time and credit.
        return {
          reply: t('exus.activity.deleted', { name: activityName(activity, names), points: formatInteger(points, locale()) }),
          write: { saved: Promise.resolve(), toast: t('activity.deleted', { points }), failed: t('activity.deleteFailed') },
        };
      } catch {
        return { reply: t('activity.deleteFailed') };
      }
    },
  },

  streak: {
    run: async (_args, { profile }) => {
      let days;
      try {
        days = await loadedToday('days');
      } catch {
        return { reply: t('today.loadFailed') };
      }
      // The same function as Today's streak card, on the same UTC day.
      const { streak, freezeAvailable } = streakOf(profile.streakFreezeLastUsed, days, utcDayKey(new Date()));
      return {
        reply: [
          streak.days > 0 ? t('today.streakDays', { count: streak.days }) : t('today.streakNone'),
          streak.freezeUsed
            ? t('today.freezeUsed')
            : freezeAvailable
              ? t('today.freezeAvailable')
              : t('exus.streak.freezeWaiting', { days: FREEZE_COOLDOWN_DAYS }),
        ].join('\n'),
      };
    },
  },

  stats: {
    run: async (args) => {
      const period = (args.period as StatsPeriod | undefined) ?? 7;
      let sources;
      try {
        const [days, latest, names] = await Promise.all([loadedStats('days'), loadedStats('latest'), loadedStats('activityNames')]);
        sources = { days, latest, names };
      } catch {
        return { reply: t('stats.loadFailed') };
      }
      const stats = periodStats(sources.days, sources.latest, utcDayKey(new Date()), period);
      const lang = locale();
      const lines = [
        t('exus.stats.points', { days: period, points: formatInteger(stats.points, lang) }),
        t(stats.partial ? 'exus.stats.activityTimePartial' : 'exus.stats.activityTime', { time: formatDuration(stats.activityMinutes) }),
        t('exus.stats.gaming', { time: formatDuration(stats.gamingMinutes) }),
        stats.top
          ? t('exus.stats.top', { name: sources.names.get(stats.top.type) ?? stats.top.type, count: stats.top.count })
          : t('stats.noTop'),
      ];
      return { reply: lines.join('\n') };
    },
  },

  'what-now': {
    run: async (args, { profile }) => {
      let sources;
      try {
        const [defs, days] = await Promise.all([loadedToday('activityDefs'), loadedToday('days')]);
        sources = { defs, days };
      } catch {
        return { reply: t('today.loadFailed') };
      }
      const minutes = args.duration as number;
      const pool = generatorPool(t('generator.pool', { returnObjects: true }), sources.defs);
      const earnedToday = sources.days.get(utcDayKey(new Date()))?.pointsEarned ?? 0;
      const pick = whatNow(pool, minutes, earnedToday, profile.dailyLimit);
      if (!pick) return { reply: t('activity.needMinutes', { min: ACTIVITY_MIN_MINUTES }) };
      // Nothing is written: logging the pick is a separate /aktywnosc (or the Today sheet).
      return {
        reply: `${t('exus.whatNow.pick', { name: pick.pick.name, time: formatDuration(minutes) })}\n${creditLine(pick.credit.points, pick.credit.earned, pick.credit.limit)}`,
      };
    },
  },
} satisfies Record<string, CommandHandler>;
