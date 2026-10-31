// The reader's two panels over the text: text settings (size, Prosta's view and
// sentences per screen, theme) and the table of contents. Each comes in and goes
// out (transform and opacity); a tap on the dimmed text or Escape closes it.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Section } from '@/domain/reader/book';
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
  kind: 'settings' | 'toc';
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

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onResize: (delta: number) => void;
  onView: (view: EasyView) => void;
  onPer: (per: 1 | 2) => void;
  onTheme: (theme: ReaderTheme) => void;
}

export function SettingsPanel({ open, onClose, settings, onResize, onView, onPer, onTheme }: SettingsPanelProps) {
  return (
    <Layer open={open} onClose={onClose} kind="settings" label={t('reader.settings.title')}>
      <div class="reader__row">
        <span class="reader__row-label">{t('reader.settings.size')}</span>
        <span class="reader__step">
          <button type="button" aria-label={t('reader.settings.smaller')} disabled={settings.size === 0} onClick={() => onResize(-1)}>
            A−
          </button>
          <output>{settings.size + 1}</output>
          <button
            type="button"
            aria-label={t('reader.settings.bigger')}
            disabled={settings.size === EASY_SIZES.length - 1}
            onClick={() => onResize(1)}
          >
            A+
          </button>
        </span>
      </div>
      {settings.mode === 'easy' && (
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
  onPick: (sentence: number) => void;
}

export function TocPanel({ open, onClose, sections, secStart, total, current, onPick }: TocPanelProps) {
  return (
    <Layer open={open} onClose={onClose} kind="toc" label={t('reader.tocTitle')}>
      <div class="reader__toc-head">
        <h2>{t('reader.tocTitle')}</h2>
        <button type="button" class="reader__icon-btn" onClick={onClose}>
          {t('reader.close')}
        </button>
      </div>
      <div class="reader__toc-list">
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
