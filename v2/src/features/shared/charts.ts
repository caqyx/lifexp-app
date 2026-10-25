// A week of days as BarChart data (Statistics, the parent's view): one series, the
// day under each bar, every value also in text.
import type { StatsDay } from '@/domain/stats';
import { locale, t } from '@/i18n';
import { formatDayKey, formatWeekdayShort } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import type { BarDatum } from '@/ui/components/BarChart';

export function weekBars(
  week: readonly StatsDay[],
  todayKey: string,
  pick: (day: StatsDay) => number,
  unit: (n: number) => string,
): BarDatum[] {
  const lang = locale();
  return week.map((day) => {
    const value = pick(day);
    const title = formatDayKey(day.key, lang);
    const valueLabel = unit(value);
    return {
      key: day.key,
      label: formatWeekdayShort(day.key, lang),
      value,
      valueText: formatInteger(value, lang),
      title,
      valueLabel,
      description: t('stats.dayValue', { day: title, value: valueLabel }),
      current: day.key === todayKey,
    };
  });
}
