// The Ex-us conversation kept on the device (docs/v2/PLAN.md 6.10): which messages are
// worth keeping, how many, and reading them back from storage that may hold anything.
// Only text is kept; a form card is kept as what it became (its summary once run) and
// never as a live card, which could run twice. Pure: the storage is offline/chatHistory.

/** The last messages kept per account. */
export const HISTORY_MAX = 200;

/** A card that was run, as it is shown read-only: a title and label/value rows. */
export interface DoneCard {
  title: string;
  rows: { label: string; value: string }[];
}

export interface StoredMessage {
  from: 'me' | 'exus';
  text: string;
  done?: DoneCard;
}

/** The newest `max` messages. */
export function trimHistory<T>(messages: readonly T[], max = HISTORY_MAX): T[] {
  return messages.length > max ? messages.slice(messages.length - max) : [...messages];
}

const isText = (value: unknown): value is string => typeof value === 'string';

function doneFrom(raw: unknown): DoneCard | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { title, rows } = raw as { title?: unknown; rows?: unknown };
  if (!isText(title) || !Array.isArray(rows)) return undefined;
  const kept = rows.flatMap((row: unknown) => {
    const { label, value } = (typeof row === 'object' && row !== null ? row : {}) as { label?: unknown; value?: unknown };
    return isText(label) && isText(value) ? [{ label, value }] : [];
  });
  return { title, rows: kept };
}

/** What storage gave back, as messages: anything that is not a message is left out, the list is cut to the newest. */
export function parseHistory(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages = raw.flatMap((item: unknown): StoredMessage[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { from, text, done } = item as { from?: unknown; text?: unknown; done?: unknown };
    if ((from !== 'me' && from !== 'exus') || !isText(text)) return [];
    const card = done === undefined ? undefined : doneFrom(done);
    if (done !== undefined && !card) return [];
    // A summary is the message; an empty bubble is nothing.
    if (!card && text === '') return [];
    return [card ? { from, text, done: card } : { from, text }];
  });
  return trimHistory(messages);
}

/** What goes to storage: the messages that are text or a run card, trimmed. Live cards and passing messages are not kept. */
export function serializeHistory(
  messages: readonly { from: 'me' | 'exus'; text: string; done?: DoneCard; live?: boolean; passing?: boolean }[],
): StoredMessage[] {
  return trimHistory(
    messages.flatMap((m): StoredMessage[] => {
      if (m.live || m.passing) return [];
      return [m.done ? { from: m.from, text: m.text, done: m.done } : { from: m.from, text: m.text }];
    }),
  );
}
