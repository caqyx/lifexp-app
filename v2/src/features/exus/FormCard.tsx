// The form card of a command with missing slots (docs/v2/PLAN.md 6.6, row 2): one field
// per slot, filled with what was parsed, the missing ones marked, "Wykonaj" only when
// every required field reads as the slot's own recognizer reads it. Once run or skipped
// the card is read-only and cannot run again.
import { useState } from 'preact/hooks';
import type { CommandSpec } from '@/domain/exus/commands';
import type { DoneCard } from '@/domain/exus/history';
import { readForm, type FieldDef, type FieldError, type RawValue } from '@/domain/exus/form';
import { locale, t } from '@/i18n';
import { formatDayMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Button } from '@/ui/components/Button';
import { Checkbox, DateField, MoneyField, NumberField, Select, TextAreaField, TextField } from '@/ui/components/Fields';
import { commandName } from './syntax';

type SlotLabel = 'exus.slots.text';
type ChoiceLabel = 'exus.choices.S';

const slotLabel = (name: string) => t(`exus.slots.${name}` as SlotLabel);
const choiceLabel = (value: string) => t(`exus.choices.${value}` as ChoiceLabel);

interface FormCardProps {
  spec: CommandSpec;
  fields: readonly FieldDef[];
  /** What the parser understood. */
  initial: Record<string, RawValue>;
  /** Runs the command with the card's arguments; the card is done and becomes `done` (a summary). */
  onRun: (args: Record<string, unknown>, done: DoneCard) => void;
  onSkip: () => void;
  /** The heading instead of "Uzupełnij /…" (an AI proposal names what it does). */
  title?: string;
  /** Every edit, for the chat to know what the card holds now (an AI proposal is sent back as pendingActions). */
  onChange?: (raw: Record<string, RawValue>) => void;
}

/** A value of the card in words, for the summary of a card that was run. */
function shown({ kind }: FieldDef, value: unknown, raw: RawValue | undefined): string {
  switch (kind) {
    case 'date':
      return formatDayMonth(String(value), locale());
    case 'money':
      return formatMoney(Number(value), locale());
    case 'amount':
      return String(raw ?? '').trim();
    case 'choice':
      return choiceLabel(String(value));
    case 'flag':
      return t('exus.form.yes');
    default:
      return String(value);
  }
}

/** A card that was run, read-only: what it was run with (kept in the history as it is). */
export function DoneCardView({ card }: { card: DoneCard }) {
  return (
    <section class="exus-card exus-card--done" aria-label={card.title}>
      <p class="exus-card__title">{card.title}</p>
      <dl class="exus-card__summary">
        {card.rows.map((row) => (
          <div key={row.label} class="exus-card__row">
            <dt>{row.label}</dt>
            <dd class="user-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FormCard({ spec, fields, initial, onRun, onSkip, title, onChange }: FormCardProps) {
  const [raw, setRaw] = useState<Record<string, RawValue>>(initial);
  const { args, errors } = readForm(fields, raw);
  const ready = Object.keys(errors).length === 0;
  const name = commandName(spec);
  const summary = (): DoneCard => ({
    title: t('exus.form.sent', { name }),
    rows: fields
      .filter((f) => args[f.slot.name] !== undefined)
      .map((f) => ({ label: slotLabel(f.slot.name), value: shown(f, args[f.slot.name], raw[f.slot.name]) })),
  });

  const set = (field: string, value: RawValue) => {
    const next = { ...raw, [field]: value };
    setRaw(next);
    onChange?.(next);
  };
  const control = (field: FieldDef) => {
    const { slot, kind } = field;
    const value = raw[slot.name];
    const label = slot.required ? slotLabel(slot.name) : t('exus.form.optional', { label: slotLabel(slot.name) });
    const problem: FieldError | undefined = errors[slot.name];
    const error = problem ? t(problem === 'required' ? 'exus.form.required' : 'exus.form.invalid') : null;
    switch (kind) {
      case 'text':
        return <TextField label={label} value={String(value ?? '')} onInput={(v) => set(slot.name, v)} error={error} autoComplete="off" />;
      case 'amount':
        return (
          <TextField
            label={label}
            value={String(value ?? '')}
            onInput={(v) => set(slot.name, v)}
            hint={t('exus.form.amountHint')}
            error={error}
            autoComplete="off"
          />
        );
      case 'textarea':
        return <TextAreaField label={label} value={String(value ?? '')} onInput={(v) => set(slot.name, v)} error={error} rows={4} />;
      case 'date':
        return <DateField label={label} value={String(value ?? '')} onChange={(v) => set(slot.name, v)} error={error} />;
      case 'money':
        return <MoneyField label={label} size="md" value={typeof value === 'number' ? value : null} onChange={(v) => set(slot.name, v)} error={error} />;
      case 'number':
        return <NumberField label={label} value={typeof value === 'number' ? value : null} onChange={(v) => set(slot.name, v)} error={error} />;
      case 'choice':
        return (
          <Select<string>
            label={label}
            value={String(value ?? '')}
            options={[{ value: '', label: t('exus.form.none') }, ...(slot.choices ?? []).map((c) => ({ value: c, label: choiceLabel(c) }))]}
            onChange={(v) => set(slot.name, v)}
            error={error}
          />
        );
      case 'flag':
        return <Checkbox label={slotLabel(slot.name)} checked={value === true} onChange={(v) => set(slot.name, v)} />;
    }
  };

  return (
    <form
      class="exus-card"
      aria-label={title ?? t('exus.form.title', { name })}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onRun(args, summary());
      }}
    >
      <p class="exus-card__title">{title ?? t('exus.form.title', { name })}</p>
      {fields.map((f) => (
        <div key={f.slot.name}>{control(f)}</div>
      ))}
      {!ready && <p class="exus-hint">{t('exus.form.fillIn')}</p>}
      <div class="exus-card__actions">
        <Button type="submit" variant="primary" disabled={!ready}>
          {t('exus.form.run')}
        </Button>
        <Button variant="quiet" onClick={onSkip}>
          {t('exus.form.skip')}
        </Button>
      </div>
    </form>
  );
}
