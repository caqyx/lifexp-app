// The reader's two panels over the text: text settings (size, Prosta's view and
// sentences per screen, theme) and the table of contents. Each comes in and goes
// out (transform and opacity); a tap on the dimmed text or Escape closes it.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Para, Section } from '@/domain/reader/book';
import { EASY_SIZES, type EasyView, type ReaderSettings, type ReaderTheme } from '@/domain/reader/settings';
import { t } from '@/i18n';
import { cssDurationMs } from '@/ui/motion';
import { sectionName } from './texts';

/** Mounted while open and while its exit plays. */
function usePresence(open: boolean): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, cssDurationMs('--duration-exit'));
    return () => clearTimeout(timer);
  }, [open]);
  return { mounted: mounted || open, leaving: leaving && !open };
}

interface LayerProps {
  open: boolean;
  onClose: () => void;
  kind: 'settings' | 'toc' | 'booktoc';
  label: string;
  children: ComponentChildren;
}

function Layer({ open, onClose, kind, label, children }: LayerProps) {
  const { mounted, leaving } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const target = panel.current?.querySelector<HTMLElement>('.is-current') ?? panel.current?.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
    panel.current?.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus({ preventScroll: true });
    };
  }, [open]);
  if (!mounted) return null;
  const state = leaving ? ' is-leaving' : '';
  return (
    <>
      <div class={`reader__scrim${state}`} onClick={onClose} aria-hidden="true" />
      <div ref={panel} class={`reader__panel reader__panel--${kind}${state}`} role="dialog" aria-label={label}>
        {children}
      </div>
    </>
  );
}

function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <span class="reader__seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** An on/off row: a switch named by its label. */
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="reader__row">
      <span class="reader__row-label">
        {label}
        {hint && <span class="reader__row-hint">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} class="reader__switch" onClick={() => onChange(!value)}>
        <span class="reader__switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

export type ToggleSetting = 'zoom' | 'swapButtons' | 'skipToc';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  /** The two-page spread is shown: its settings instead of Prosta's view and sentences per screen. */
  landscape: boolean;
  onResize: (delta: number) => void;
  onView: (view: EasyView) => void;
  onPer: (per: 1 | 2) => void;
  onTheme: (theme: ReaderTheme) => void;
  onToggle: (key: ToggleSetting, value: boolean) => void;
}

export function SettingsPanel({ open, onClose, settings, landscape, onResize, onView, onPer, onTheme, onToggle }: SettingsPanelProps) {
  return (
    <Layer open={open} onClose={onClose} kind="settings" label={t('reader.settings.title')}>
      <div class="reader__row">
        <span class="reader__row-label">{t('reader.settings.size')}</span>
        <span class="reader__step">
          <button type="button" aria-label={t('reader.settings.smaller')} disabled={settings.size === 0} onClick={() => onResize(-1)}>
            {t('reader.settings.smallerShort')}
          </button>
          <output>{settings.size + 1}</output>
          <button
            type="button"
            aria-label={t('reader.settings.bigger')}
            disabled={settings.size === EASY_SIZES.length - 1}
            onClick={() => onResize(1)}
          >
            {t('reader.settings.biggerShort')}
          </button>
        </span>
      </div>
      {landscape && (
        <>
          <Toggle
            label={t('reader.settings.zoom')}
            hint={t('reader.settings.zoomHint')}
            value={settings.zoom}
            onChange={(v) => onToggle('zoom', v)}
          />
          <Toggle label={t('reader.settings.swap')} value={settings.swapButtons} onChange={(v) => onToggle('swapButtons', v)} />
        </>
      )}
      {settings.mode === 'easy' && !landscape && (
        <>
          <div class="reader__row">
            <span class="reader__row-label">{t('reader.settings.view')}</span>
            <Seg
              label={t('reader.settings.viewLabel')}
              value={settings.view}
              onChange={onView}
              options={[
                { value: 'sentences', label: t('reader.settings.sentences') },
                { value: 'page', label: t('reader.settings.page') },
              ]}
            />
          </div>
          <div class="reader__row">
            <span class="reader__row-label">{t('reader.settings.per')}</span>
            <Seg
              label={t('reader.settings.per')}
              value={settings.per}
              onChange={onPer}
              options={[
                { value: 1 as const, label: '1' },
                { value: 2 as const, label: '2' },
              ]}
            />
          </div>
        </>
      )}
      <div class="reader__row">
        <span class="reader__row-label">{t('reader.settings.theme')}</span>
        <Seg
          label={t('reader.settings.theme')}
          value={settings.theme}
          onChange={onTheme}
          options={[
            { value: 'paper', label: t('reader.settings.paper') },
            { value: 'night', label: t('reader.settings.night') },
          ]}
        />
      </div>
      <Toggle
        label={t('reader.settings.skipToc')}
        hint={t('reader.settings.skipTocHint')}
        value={settings.skipToc}
        onChange={(v) => onToggle('skipToc', v)}
      />
    </Layer>
  );
}

interface TocPanelProps {
  open: boolean;
  onClose: () => void;
  sections: readonly Section[];
  secStart: readonly number[];
  total: number;
  current: number;
  /** The book has its own table of contents (domain/reader/toc): an entry opens it. */
  hasBookToc: boolean;
  onBookToc: () => void;
  onPick: (sentence: number) => void;
}

export function TocPanel({ open, onClose, sections, secStart, total, current, hasBookToc, onBookToc, onPick }: TocPanelProps) {
  return (
    <Layer open={open} onClose={onClose} kind="toc" label={t('reader.tocTitle')}>
      <div class="reader__toc-head">
        <h2>{t('reader.tocTitle')}</h2>
        <button type="button" class="reader__icon-btn" onClick={onClose}>
          {t('reader.close')}
        </button>
      </div>
      <div class="reader__toc-list">
        {hasBookToc && (
          <button type="button" class="reader__toc-book" onClick={onBookToc}>
            {t('reader.bookToc')}
          </button>
        )}
        {sections.map((sec, si) => {
          const from = secStart[si] ?? 0;
          if ((secStart[si + 1] ?? total) <= from) return null;
          return (
            <button
              key={si}
              type="button"
              class={si === current ? 'is-current' : ''}
              aria-current={si === current ? 'true' : undefined}
              onClick={() => onPick(from)}
            >
              {sectionName(sec, si)}
            </button>
          );
        })}
      </div>
    </Layer>
  );
}

/** "Spis treści książki": the book's own table of contents, as found in it (left out of reading). */
export function BookTocPanel({ open, onClose, blocks }: { open: boolean; onClose: () => void; blocks: readonly Para[][] }) {
  return (
    <Layer open={open} onClose={onClose} kind="booktoc" label={t('reader.bookToc')}>
      <div class="reader__toc-head">
        <h2>{t('reader.bookToc')}</h2>
        <button type="button" class="reader__icon-btn" onClick={onClose}>
          {t('reader.close')}
        </button>
      </div>
      <div class="reader__booktoc">
        {blocks.map((block, bi) => (
          <section key={bi} class="reader__booktoc-block">
            {block.map((p, pi) => (p.h ? <h3 key={pi}>{p.t}</h3> : <p key={pi}>{p.t}</p>))}
          </section>
        ))}
      </div>
    </Layer>
  );
}
