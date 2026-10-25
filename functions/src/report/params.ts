// The weekly report → the params of v1's EmailJS template (template_jztwowz;
// email-templates/weekly-report.html), in v1's formats: "12.50 zł", "1h 5m". The
// template itself is unchanged, so the numbers fill the same places.
import type { WeeklyReport } from '../v2/domain/parent';

const pln = (grosze: number) => (grosze / 100).toFixed(2);

/** v1 formatMinutes(). */
function formatMinutes(minutes: number): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export type ReportParams = Record<string, string> & { to_email: string };

export function reportParams(report: WeeklyReport, to: string): ReportParams {
  const { money } = report;
  const topCategories =
    money.topCategories.map((c, i) => `${i + 1}. ${c.category}: ${pln(c.grosze)} zł`).join('\n') || 'Brak wydatków w tym miesiącu.';
  // users.goals: money goals count what was put aside (saved), points goals the points.
  const goals =
    money.goals
      .map(({ goal, progress }) => {
        const pct = Math.floor(progress.share * 100);
        return goal.type === 'money'
          ? `• ${goal.name}: zebrano ${pln(progress.current)} / ${pln(goal.target)} zł (${pct}%)`
          : `• ${goal.name}: ${progress.current} / ${goal.target} pkt (${pct}%)`;
      })
      .join('\n') || 'Brak celów.';
  const limit = `${pln(money.expenses)} / ${pln(money.limit)} zł`;
  return {
    to_email: to,
    user_name: report.name,
    points_earned: String(report.points),
    balance_pln: `${pln(report.balanceGrosze)} zł`,
    gaming_time: formatMinutes(report.gamingMinutes),
    // The template adds " zł" itself.
    purchases: pln(report.purchases.grosze),
    money_balance_pln: `${pln(money.balance)} zł`,
    money_income_pln: `${pln(money.income)} zł`,
    money_expenses_pln: `${pln(money.expenses)} zł`,
    money_limit_info: money.exceeded ? `⚠️ ${limit}` : `✅ ${limit}`,
    money_limit_color: money.exceeded ? '#ff6b6b' : '#4ecca3',
    money_top_categories: topCategories,
    money_goals_status: goals,
  };
}
