// Ex-us (docs/v2/PLAN.md 6, stage 5a): one chat for slash commands now and for
// the AI later (5b). A command is read locally (domain/exus) and run through the
// same services as the screens, so it obeys the same limits. The conversation
// lives in memory for now; history on the device comes with the full UI (6.10).
import { useEffect, useRef, useState } from 'preact/hooks';
import { availableCommands, palette, parseInput, type CommandSpec } from '@/domain/exus/commands';
import { whatToDo } from '@/domain/exus/policy';
import { isModuleOn } from '@/domain/modules';
import { t } from '@/i18n';
import { localDayKey } from '@/lib/dates';
import type { RouteProps } from '@/lib/route-match';
import { prepareMoney } from '@/services/money';
import { watchMoney } from '@/stores/money';
import { watchNotes } from '@/stores/notes';
import { watchStats } from '@/stores/stats';
import { account } from '@/stores/session';
import { watchTasks } from '@/stores/tasks';
import { watchToday } from '@/stores/today';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { TextField } from '@/ui/components/Fields';
import { Card, Page, Stack } from '@/ui/components/Layout';
import type { HandlerContext } from './handlers';
import { blockedBy, effectOf, readyFor, runCommand } from './pipeline';
import { commandName, syntax } from './syntax';
import { createUndoStack } from './undo';
import './exus.css';

interface Message {
  id: number;
  from: 'me' | 'exus';
  text: string;
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
  | 'screen';

let nextId = 1;

export default function ExusPage({ navigate }: RouteProps) {
  const current = account.value;
  const uid = current?.user.uid;
  useEffect(() => (uid ? watchTasks(uid) : undefined), [uid]);
  useEffect(() => (uid ? watchToday(uid) : undefined), [uid]);
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
  const [messages, setMessages] = useState<Message[]>(() => [{ id: nextId++, from: 'exus', text: t('exus.hello') }]);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // The undo stack lives as long as this conversation (PLAN.md 6.6).
  const [undoStack] = useState(createUndoStack);
  // The last destructive command asked about; it stays while the dialog closes.
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!current || !uid) return null;
  const { profile } = current;
  const commands = availableCommands(profile);

  const say = (text: string) => setMessages((m) => [...m, { id: nextId++, from: 'exus', text }]);

  const run = (spec: CommandSpec, args: Record<string, unknown>, ctx: HandlerContext) =>
    void runCommand(spec, args, ctx, say).then(say, () => say(t('exus.failed')));

  const send = () => {
    const input = draft.trim();
    if (!input) return;
    setDraft('');
    setMessages((m) => [...m, { id: nextId++, from: 'me', text: input }]);
    const today = localDayKey(new Date());
    const parsed = parseInput(input, today, commands);
    if (parsed.kind === 'text') return say(t('exus.aiLater'));
    if (parsed.kind === 'unknown') return say(t('exus.unknown', { name: parsed.name }));
    const { spec, args, missing, unread } = parsed;
    const ctx: HandlerContext = { uid, profile, today, commands, navigate, undo: undoStack };
    if (unread.length > 0) {
      return say(t('exus.unread', { fields: unread.map((name) => t(`exus.slots.${name as SlotName}`)).join(', '), syntax: syntax(spec) }));
    }
    const decision = whatToDo(spec.risk, missing);
    if (decision === 'ask-missing') {
      return say(
        t('exus.missing', {
          fields: missing.map((name) => t(`exus.slots.${name as SlotName}`)).join(', '),
          syntax: syntax(spec),
        }),
      );
    }
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
  /** A command from the palette goes into the field, ready for its arguments. */
  const pick = (spec: CommandSpec) => {
    setDraft(`/${commandName(spec)} `);
    form.current?.querySelector('input')?.focus();
  };

  return (
    <Page>
      <Stack gap="sm">
        <div class="exus-log" role="log" aria-label={t('exus.log')} ref={log}>
          {messages.map((m) => (
            <p key={m.id} class={`exus-msg exus-msg--${m.from} user-text`}>
              {m.text}
            </p>
          ))}
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
