// The reminder texts, short, in the account's language (v1 lang; Polish by default).
import type { Reminder } from '../v2/domain/reminders';

export type Lang = 'pl' | 'en';

export interface PushText {
  title: string;
  body: string;
}

/** Polish: 1 dzień, every other count dni. */
const plDays = (n: number) => (n === 1 ? 'dzień' : 'dni');

export function reminderText(reminder: Reminder, lang: Lang): PushText {
  if (reminder.kind === 'streak') {
    return lang === 'en'
      ? { title: `🔥 ${reminder.days}-day streak`, body: 'Nothing logged today yet. Log something to keep it going.' }
      : { title: `🔥 Seria: ${reminder.days} ${plDays(reminder.days)}`, body: 'Dziś jeszcze nic nie ma. Zaloguj coś, żeby jej nie stracić.' };
  }
  const left = reminder.daysLeft;
  if (lang === 'en') {
    return {
      title: '🧹 Chores',
      body: left === 0 ? 'Last day of the month. Anything from your chore list today?' : `${left} ${left === 1 ? 'day' : 'days'} left this month. Anything from your chore list?`,
    };
  }
  return {
    title: '🧹 Obowiązki',
    body: left === 0 ? 'Ostatni dzień miesiąca. Zrobisz dziś coś z listy?' : `Do końca miesiąca: ${left} ${plDays(left)}. Zrobisz coś z listy?`,
  };
}

export function testText(lang: Lang): PushText {
  return lang === 'en'
    ? { title: 'LifeXP', body: 'Test notification: reminders reach this device.' }
    : { title: 'LifeXP', body: 'Powiadomienie testowe: przypomnienia docierają na to urządzenie.' };
}
