// Settings and navigation commands (docs/v2/PLAN.md 6.5, "Ogólne" and "Ustawienia"):
// /limit, /jezyk, /motyw, /modul, /idz. They go through the same services and
// stores as Settings (services/settings, stores/theme) and read the live profile,
// not the one the chat started with, so two quick commands see each other.
import { findCommand } from '@/domain/exus/commands';
import { matchScreen } from '@/domain/exus/screens';
import { chooseTheme, KEPT_ON_HERE } from '@/domain/exus/settings';
import { isModuleOn, type OptionalModule } from '@/domain/modules';
import { DAILY_LIMIT_DEFAULT } from '@/domain/points';
import type { Language, Profile } from '@/domain/profile';
import { DAILY_LIMIT_MAX, DAILY_LIMIT_MIN, dailyLimitProblem } from '@/domain/settings';
import { language, setLanguage, t, V1_LANG_STORAGE_KEY } from '@/i18n';
import type { ModePreference, ThemeFamily } from '@/lib/theme';
import { saveDailyLimit, saveLanguage, saveModule } from '@/services/settings';
import { account } from '@/stores/session';
import { setThemePreference, themePreference } from '@/stores/theme';
import type { CommandHandler, HandlerContext } from './handlers';
import { syntax } from './syntax';

/** The profile as it is now; the one the command was read with when the session has none. */
const liveProfile = (ctx: HandlerContext): Profile => account.peek()?.profile ?? ctx.profile;

const moduleName = (id: OptionalModule) => t(`settings.moduleNames.${id}`);

export const SETTINGS_HANDLERS = {
  'daily-limit': {
    run: async (args, ctx) => {
      const limit = args.limit as number;
      if (dailyLimitProblem(limit)) return { reply: t('settings.dailyLimitRange', { min: DAILY_LIMIT_MIN, max: DAILY_LIMIT_MAX }) };
      const before = liveProfile(ctx).dailyLimit ?? DAILY_LIMIT_DEFAULT;
      if (limit === before) return { reply: t('exus.limit.same', { limit }) };
      const result = saveDailyLimit(ctx.uid, limit);
      if (!result.ok) return { reply: t('settings.dailyLimitRange', { min: DAILY_LIMIT_MIN, max: DAILY_LIMIT_MAX }) };
      return {
        reply: t('exus.limit.set', { limit, before }),
        write: { saved: result.saved, toast: t('settings.saved'), failed: t('settings.saveFailed') },
        // Back to the value it was: not when that one is outside today's range (a v1 value), which the service would refuse.
        undo:
          dailyLimitProblem(before) === null
            ? {
                what: t('exus.undoWhat.daily-limit', { limit, before }),
                run: async () => {
                  const back = saveDailyLimit(ctx.uid, before);
                  if (!back.ok) throw new Error(back.problem);
                  await back.saved;
                },
              }
            : undefined,
      };
    },
  },

  lang: {
    run: async (args, { uid }) => {
      const lang = args.lang as Language;
      const name = t(`settings.languages.${lang}`, { lng: lang });
      if (language.value === lang) return { reply: t('exus.lang.same', { name, lng: lang }) };
      // As Settings → Wygląd does: this device now, the profile for the other devices.
      setLanguage(lang);
      try {
        localStorage.setItem(V1_LANG_STORAGE_KEY, lang);
      } catch {
        // Storage blocked: the profile still carries the choice.
      }
      return {
        // The answer is already in the new language.
        reply: t('exus.lang.changed', { name, lng: lang }),
        write: { saved: saveLanguage(uid, lang), failed: t('settings.saveFailed') },
      };
    },
  },

  theme: {
    run: async (args, { commands }) => {
      const family = args.family as ThemeFamily | undefined;
      const mode = args.mode as ModePreference | undefined;
      const choice = chooseTheme(themePreference.value, family, mode);
      if (!choice.ok && choice.problem === 'nothing') {
        const spec = findCommand('theme', commands);
        return { reply: t('exus.theme.nothing', { syntax: spec ? syntax(spec) : '' }) };
      }
      if (!choice.ok) {
        return { reply: t('exus.theme.unsupported', { family: t(`settings.families.${choice.family}`), mode: t(`settings.modes.${choice.mode}`) }) };
      }
      // Kept on this device only, as in Settings: nothing to save to the profile.
      setThemePreference(choice.pref);
      return { reply: t('exus.theme.set', { family: t(`settings.families.${choice.pref.family}`), mode: t(`settings.modes.${choice.pref.mode}`) }) };
    },
  },

  module: {
    run: async (args, ctx) => {
      const id = args.module as OptionalModule;
      const on = args.state as boolean;
      const name = moduleName(id);
      // Turning Ex-us off from inside it would pull the chat from under the person: that is left to Settings.
      if (id === KEPT_ON_HERE && !on) return { reply: t('exus.module.keepExus') };
      const profile = liveProfile(ctx);
      if (isModuleOn(id, profile) === on) return { reply: t(on ? 'exus.module.alreadyOn' : 'exus.module.alreadyOff', { name }) };
      return {
        reply: t(on ? 'exus.module.turnedOn' : 'exus.module.turnedOff', { name }),
        write: { saved: saveModule(ctx.uid, profile, id, on), toast: t('settings.moduleToggled'), failed: t('settings.saveFailed') },
        undo: {
          what: t('exus.undoWhat.module', { name }),
          run: () => saveModule(ctx.uid, liveProfile(ctx), id, !on),
        },
      };
    },
  },

  go: {
    run: async (args, ctx) => {
      const name = String(args.screen);
      const match = matchScreen(name);
      if (match.kind === 'none') return { reply: t('exus.go.none', { name }) };
      if (match.kind === 'ambiguous') return { reply: t('exus.go.ambiguous', { names: match.screens.map((s) => `„${t(`nav.${s.id}`)}”`).join(', ') }) };
      const { screen } = match;
      // A screen of a module that is off is not there (the menu does not list it either).
      if (screen.module && !isModuleOn(screen.module, liveProfile(ctx))) return { reply: t('exus.go.off', { name: t(`nav.${screen.id}`) }) };
      ctx.navigate(screen.path);
      return { reply: t('exus.go.went', { name: t(`nav.${screen.id}`) }) };
    },
  },
} satisfies Record<string, CommandHandler>;
