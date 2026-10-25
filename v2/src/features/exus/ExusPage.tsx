// Ex-us (docs/v2/PLAN.md 6): one chat for slash commands (5a) and the AI (5b). A
// command is read locally (domain/exus) and run through the same services as the
// screens, so it obeys the same limits; plain text goes to exusTurn with the
// context snapshot (5b-4), one call per message. The conversation is kept
// on the device per account (offline/chatHistory, 6.10): text only, a form card as
// what it became, cleared by /nowy and by signing out.
import { useEffect, useRef, useState } from 'preact/hooks';
import { AiError, historyForAi, type AiErrorKind } from '@/domain/exus/ai';
import { availableCommands, palette, parseInput, type CommandSpec } from '@/domain/exus/commands';
import type { ContextRefs } from '@/domain/exus/context';
import { fieldsFor, initialValues, type FieldDef, type RawValue } from '@/domain/exus/form';
import { serializeHistory, type DoneCard } from '@/domain/exus/history';
import { needsInternet, whatToDo } from '@/domain/exus/policy';
import { isModuleOn } from '@/domain/modules';
import { language, t } from '@/i18n';
import { localDayKey } from '@/lib/dates';
import type { RouteProps } from '@/lib/route-match';
import { loadChatHistory, saveChatHistory } from '@/offline/chatHistory';
import { aiDenied, askExus } from '@/services/exus-ai';
import { prepareMoney } from '@/services/money';
import { aiUsage } from '@/stores/exusAi';
import { exusFocusRequests } from '@/stores/exusFocus';
import { watchMoney } from '@/stores/money';
import { watchNotes } from '@/stores/notes';
import { watchMyReportsState } from '@/stores/reports';
import { watchStats } from '@/stores/stats';
import { account } from '@/stores/session';
import { watchTasks } from '@/stores/tasks';
import { watchToday } from '@/stores/today';
import { Button } from '@/ui/components/Button';
import { ProgressBar } from '@/ui/components/Display';
import { Markdown } from '@/ui/components/Markdown';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { TextField } from '@/ui/components/Fields';
import { Card, Page, Stack } from '@/ui/components/Layout';
import type { HandlerContext } from './handlers';
import { DoneCardView, FormCard } from './FormCard';
import { exusContext } from './context';
import { blockedBy, effectOf, readyFor, runCommand } from './pipeline';
import { commandName, syntax } from './syntax';
import { createUndoStack } from './undo';
import './exus.css';

interface Message {
  id: number;
  from: 'me' | 'exus';
  text: string;
  /** Shown now but not kept on the device: the greeting, the answer to /nowy. */
  passing?: boolean;
  /** A turn of the AI conversation: sent as history; Ex-us's reply is Markdown. */
  ai?: boolean;
  /** "Ex-us pisze…" while exusTurn answers; becomes the reply. */
  typing?: boolean;
  /** A form card that was run, read-only (kept on the device as it is). */
  done?: DoneCard;
  /** A form card for a command with missing slots instead of text (PLAN.md 6.6, row 2). */
  card?: { spec: CommandSpec; fields: FieldDef[]; initial: Record<string, RawValue>; ctx: HandlerContext };
}

/** A destructive command waiting for "yes" in the dialog. */
interface Pending {
  spec: CommandSpec;
  args: Record<string, unknown>;
  ctx: HandlerContext;
  effect: string;
}

/** The slots a reply can name as missing (exus.slots). */
type SlotName =
  | 'text'
  | 'due'
  | 'size'
  | 'name'
  | 'target'
  | 'goal'
  | 'amount'
  | 'chore'
  | 'type'
  | 'duration'
  | 'task'
  | 'title'
  | 'content'
  | 'note'
  | 'query'
  | 'limit'
  | 'lang'
  | 'module'
  | 'state'
  | 'screen'
  | 'person'
  | 'loan'
  | 'points'
  | 'report';

let nextId = 1;

/** What the chat says when a turn with the AI did not come back. */
const AI_ERROR_TEXT = {
  'no-access': 'exus.ai.noAccess',
  budget: 'exus.ai.budget',
  invalid: 'exus.ai.failed',
  unavailable: 'exus.ai.unavailable',
  network: 'exus.ai.network',
  failed: 'exus.ai.failed',
} as const satisfies Record<AiErrorKind, string>;

/** The build's version, sent with every AI turn (logged by exusTurn). */
const CLIENT_VERSION = __LIFEXP_CLIENT_VERSION__;

export default function ExusPage({ navigate }: RouteProps) {
  const current = account.value;
  const uid = current?.user.uid;
  useEffect(() => (uid ? watchTasks(uid) : undefined), [uid]);
  useEffect(() => (uid ? watchToday(uid) : undefined), [uid]);
  // /blad counts the person's own reports (the bonus one), as the Reports screen does.
  useEffect(() => (uid ? watchMyReportsState(uid) : undefined), [uid]);
  // The money commands read the Money data and need the account prepared, as opening Money does.
  const moneyOn = current ? isModuleOn('money', current.profile) : false;
  const incomeCounted = current ? current.profile.moneyIncomeAllTime !== null : true;
  useEffect(() => (uid && moneyOn ? watchMoney(uid) : undefined), [uid, moneyOn]);
  // /statystyki reads what the Stats screen reads (the newest 50 activities and their type names).
  const statsOn = current ? isModuleOn('stats', current.profile) : false;
  useEffect(() => (uid && statsOn ? watchStats(uid) : undefined), [uid, statsOn]);
  // /szukaj and the other note commands read the notes the Notes screen reads.
  const notesOn = current ? isModuleOn('notes', current.profile) : false;
  useEffect(() => (uid && notesOn ? watchNotes(uid) : undefined), [uid, notesOn]);
  useEffect(() => {
    if (uid && moneyOn) prepareMoney(uid, incomeCounted).catch(() => {});
  }, [uid, moneyOn]);
  const [messages, setMessages] = useState<Message[]>([]);
  // The conversation as it is now, for the history sent with the next AI turn.
  const latest = useRef<Message[]>([]);
  latest.current = messages;
  // The refs of the latest context sent: an action from the AI names things by them (5b-5).
  const refs = useRef<ContextRefs>({});
  // The kept conversation arrives from the device's storage; nothing is saved before it did.
  const [restored, setRestored] = useState(false);
  const passingNext = useRef(false);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // The undo stack lives as long as this conversation (PLAN.md 6.6).
  const [undoStack] = useState(createUndoStack);
  // The last destructive command asked about; it stays while the dialog closes.
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let wanted = true;
    void loadChatHistory(uid).then((kept) => {
      if (!wanted) return;
      // What was said while it loaded stays after it.
      const earlier: Message[] = kept.length > 0 ? kept.map((m) => ({ ...m, id: nextId++ })) : [{ id: nextId++, from: 'exus', text: t('exus.hello'), passing: true }];
      setMessages((now) => [...earlier, ...now]);
      setRestored(true);
    });
    return () => {
      wanted = false;
    };
  }, [uid]);
  useEffect(() => {
    if (uid && restored) void saveChatHistory(uid, serializeHistory(messages.map((m) => ({ ...m, live: m.card !== undefined }))));
  }, [messages, restored, uid]);
  // Ctrl/Cmd+K (the shell) asks for the field.
  const focusRequests = exusFocusRequests.value;
  useEffect(() => {
    if (focusRequests > 0) form.current?.querySelector('input')?.focus();
  }, [focusRequests]);
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!current || !uid) return null;
  const { profile } = current;
  const commands = availableCommands(profile);

  // /nowy: the chat and the undo stack start over; the reply that follows is the first message.
  const newChat = () => {
    undoStack.clear();
    passingNext.current = true;
    setMessages([]);
  };

  const say = (text: string) => {
    const passing = passingNext.current;
    passingNext.current = false;
    setMessages((m) => [...m, { id: nextId++, from: 'exus', text, ...(passing ? { passing } : {}) }]);
  };

  /** Offline, a command that moves money or points in a transaction waits for a connection. */
  const offlineBlocked = (spec: CommandSpec) => {
    if (navigator.onLine || !needsInternet(spec.id)) return false;
    say(t('exus.offline.needsInternet'));
    return true;
  };

  const run = (spec: CommandSpec, args: Record<string, unknown>, ctx: HandlerContext) =>
    void runCommand(spec, args, ctx, say).then(say, () => say(t('exus.failed')));

  /** Plain text: one exusTurn call; "Ex-us pisze…" until the reply (or why there is none) replaces it. */
  const askAi = (message: string) => {
    const history = historyForAi(latest.current);
    const typingId = nextId++;
    setMessages((m) => [
      ...m,
      { id: nextId++, from: 'me', text: message, ai: true },
      { id: typingId, from: 'exus', text: '', typing: true, passing: true },
    ]);
    const answer = (patch: Partial<Message>) =>
      setMessages((all) => all.map((x) => (x.id === typingId ? { id: typingId, from: 'exus', text: '', ...patch } : x)));
    const lang = language.value;
    void exusContext(profile, lang)
      .then((built) => {
        refs.current = built.refs;
        return askExus(uid, { message, history, context: built.context, lang, clientVersion: CLIENT_VERSION });
      })
      // Actions are shown as cards in 5b-5; until then the reply is the answer.
      .then(
        (response) => answer({ text: response.reply, ai: true }),
        (error: unknown) => answer({ text: t(AI_ERROR_TEXT[error instanceof AiError ? error.kind : 'failed']) }),
      );
  };

  const send = () => {
    const input = draft.trim();
    if (!input) return;
    setDraft('');
    const today = localDayKey(new Date());
    const parsed = parseInput(input, today, commands);
    // Offline plain text waits for nobody; an account without AI is told so without another call.
    if (parsed.kind === 'text' && navigator.onLine && !aiDenied(uid)) return askAi(input);
    setMessages((m) => [...m, { id: nextId++, from: 'me', text: input }]);
    if (parsed.kind === 'text') return say(t(navigator.onLine ? 'exus.ai.noAccess' : 'exus.offline.text'));
    if (parsed.kind === 'unknown') return say(t('exus.unknown', { name: parsed.name }));
    const { spec, args, missing, unread } = parsed;
    const ctx: HandlerContext = { uid, profile, today, commands, navigate, undo: undoStack, newChat };
    if (unread.length > 0) {
      return say(t('exus.unread', { fields: unread.map((name) => t(`exus.slots.${name as SlotName}`)).join(', '), syntax: syntax(spec) }));
    }
    if (offlineBlocked(spec)) return;
    const decision = whatToDo(spec.risk, missing);
    if (decision === 'ask-missing') return sayMissing(spec, missing);
    if (decision === 'form') {
      const fields = fieldsFor(spec.slots(today));
      // A slot with no sensible control (a language, a module): the reply names what is missing.
      if (!fields) return sayMissing(spec, missing);
      setMessages((m) => [...m, { id: nextId++, from: 'exus', text: '', card: { spec, fields, initial: initialValues(fields, args), ctx } }]);
      return;
    }
    proceed(spec, args, ctx, decision);
  };

  const sayMissing = (spec: CommandSpec, missing: string[]) =>
    say(t('exus.missing', { fields: missing.map((name) => t(`exus.slots.${name as SlotName}`)).join(', '), syntax: syntax(spec) }));

  /** A complete command: run it, or ask first when it is destructive. */
  const proceed = (spec: CommandSpec, args: Record<string, unknown>, ctx: HandlerContext, decision: 'run' | 'confirm') => {
    if (offlineBlocked(spec)) return;
    if (decision === 'confirm') {
      // The question reads stores that may still be loading: it waits for them (or says it cannot).
      void readyFor(spec, ctx).then(
        () => {
          const blocked = blockedBy(spec, args, ctx);
          if (blocked) return say(blocked);
          setPending({ spec, args, ctx, effect: effectOf(spec, args, ctx) });
          setConfirming(true);
        },
        () => say(t('exus.failed')),
      );
      return;
    }
    run(spec, args, ctx);
  };

  const pal = palette(draft, commands);
  // Shown from the first AI answer of the session on.
  const usage = aiUsage.value;
  /** A command from the palette goes into the field, ready for its arguments. */
  const pick = (spec: CommandSpec) => {
    setDraft(`/${commandName(spec)} `);
    form.current?.querySelector('input')?.focus();
  };

  return (
    <Page>
      <Stack gap="sm">
        <div class="exus-log" role="log" aria-label={t('exus.log')} ref={log}>
          {messages.map((m) =>
            m.card ? (
              <FormCard
                key={m.id}
                spec={m.card.spec}
                fields={m.card.fields}
                initial={m.card.initial}
                onSkip={() => setMessages((all) => all.map((x) => (x.id === m.id ? { id: m.id, from: 'exus', text: t('exus.form.skipped') } : x)))}
                onRun={(args, done) => {
                  const card = m.card!;
                  setMessages((all) => all.map((x) => (x.id === m.id ? { id: m.id, from: 'exus', text: '', done } : x)));
                  proceed(card.spec, args, card.ctx, whatToDo(card.spec.risk, []) === 'confirm' ? 'confirm' : 'run');
                }}
              />
            ) : m.done ? (
              <DoneCardView key={m.id} card={m.done} />
            ) : m.typing || (m.ai && m.from === 'exus') ? (
              // One bubble: "pisze…" turns into the reply in place.
              <div key={m.id} class={`exus-msg exus-msg--exus${m.typing ? ' exus-msg--typing' : ' exus-msg--ai'}`}>
                {m.typing ? (
                  <span class="exus-msg__body">{t('exus.ai.typing')}</span>
                ) : (
                  <div class="exus-msg__body" key="reply">
                    <Markdown text={m.text} />
                  </div>
                )}
              </div>
            ) : (
            <p key={m.id} class={`exus-msg exus-msg--${m.from} user-text`}>
              {m.text}
            </p>
            ),
          )}
        </div>
        <Card>
          <form
            ref={form}
            class="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <TextField
              label={t('exus.inputLabel')}
              value={draft}
              onInput={setDraft}
              placeholder={t('exus.placeholder')}
              autoComplete="off"
            />
            {pal.suggestions.length > 0 && (
              <ul class="exus-palette" aria-label={t('exus.paletteLabel')}>
                {pal.suggestions.map((spec) => (
                  <li key={spec.id}>
                    <button type="button" class="exus-palette__item" onClick={() => pick(spec)}>
                      <span class="exus-palette__syntax">{syntax(spec)}</span>
                      <span class="exus-palette__desc">{t(`exus.commands.${spec.id}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pal.current && <p class="exus-hint">{syntax(pal.current)}</p>}
            {usage && (
              <div class="exus-usage">
                <ProgressBar value={usage.remainingPercent / 100} label={t('exus.ai.usageLabel')} tone={usage.remainingPercent === 0 ? 'negative' : 'default'} />
                <p class="exus-usage__text">{t('exus.ai.usage', { percent: usage.remainingPercent })}</p>
              </div>
            )}
            <div>
              <Button type="submit" variant="primary">
                {t('exus.send')}
              </Button>
            </div>
          </form>
        </Card>
      </Stack>
      <ConfirmDialog
        open={confirming}
        title={pending ? t('exus.confirmTitle', { name: commandName(pending.spec) }) : ''}
        body={pending?.effect}
        confirmLabel={t('exus.confirm')}
        danger
        onConfirm={() => {
          setConfirming(false);
          if (pending) run(pending.spec, pending.args, pending.ctx);
        }}
        onCancel={() => {
          setConfirming(false);
          say(t('exus.cancelled'));
        }}
      />
    </Page>
  );
}
