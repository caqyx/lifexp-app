// The bug-report command (docs/v2/PLAN.md 6.5, "Zgłoszenia"): /blad <tytuł> | <obszar> | <opis>.
// It goes through the same service as the Reports screen (services/reports sendReport): one
// report a day plus one for each accepted report, and the admin's words decide whether it
// goes to spam (the reporter is not told, as on the screen). Nothing deletes a report, so
// there is no undo.
import { findArea, splitBugReport } from '@/domain/exus/reports';
import { BUG_AREAS, BUG_DESC_MAX, BUG_TITLE_MAX } from '@/domain/reports';
import { t } from '@/i18n';
import { loadSpamKeywords, sendReport } from '@/services/reports';
import { account } from '@/stores/session';
import type { CommandHandler, HandlerContext } from './handlers';
import { loadedReports } from './loaded';

const areaNames = () => BUG_AREAS.map((id) => ({ id, name: t(`reports.areas.${id}`) }));

export const REPORT_HANDLERS = {
  'report-bug': {
    run: async (args, ctx: HandlerContext) => {
      const areas = areaNames();
      const list = areas.map((a) => a.name).join(', ');
      const parts = splitBugReport(String(args.report));
      if (!parts.ok) return { reply: t('exus.report.format', { areas: list }) };
      const area = findArea(parts.area, areas);
      if (area.kind === 'none') return { reply: t('exus.report.areaNone', { name: parts.area, areas: list }) };
      if (area.kind === 'ambiguous') return { reply: t('exus.report.areaAmbiguous', { names: area.names.join(', ') }) };
      if (parts.title.length > BUG_TITLE_MAX) return { reply: t('exus.report.titleTooLong', { max: BUG_TITLE_MAX }) };
      if (parts.description.length > BUG_DESC_MAX) return { reply: t('exus.report.descTooLong', { max: BUG_DESC_MAX }) };
      let mine;
      try {
        mine = await loadedReports();
      } catch {
        return { reply: t('reports.loadFailed') };
      }
      const keywords = await loadSpamKeywords();
      // The profile as it is now: a report sent a moment ago has already moved lastBugReportAt.
      const profile = account.peek()?.profile ?? ctx.profile;
      const result = sendReport(ctx.uid, profile, { title: parts.title, area: area.id, description: parts.description }, mine, keywords);
      if (!result.ok) {
        return { reply: t(result.problem === 'rateLimited' ? 'reports.rateLimited' : 'exus.report.format', { areas: list }) };
      }
      return {
        reply: t('exus.report.sent', { title: parts.title, area: t(`reports.areas.${area.id}`) }),
        write: { saved: result.saved, toast: t('reports.sent'), failed: t('reports.saveFailed') },
      };
    },
  },
} satisfies Record<string, CommandHandler>;
