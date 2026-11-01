// Reading one book, full screen. Three modes, as in the standalone reader:
// - Prosta (easy): one or two sentences a screen, or the whole section with them
//   highlighted ("Cała strona"); arrows, swipe, keys and the slider move.
// - Auto: a light walks word by word at a set pace, longer at punctuation and long
//   words; a tap on a word moves it there; it goes on to the next section by itself.
// - Normalny: plain scrolling of the whole book; the position follows the scroll.
// The position is saved on the device a moment after each move, and at once when the
// page hides or the reader closes. Nothing here touches points or statistics.
import { ArrowLeft, ArrowRight, ListTree, Pause, Play } from 'lucide-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildGroups, flatten, groupIndexOf, percentRead, type BookContent, type BookMeta } from '@/domain/reader/book';
import {
  clampWpm,
  EASY_SIZES,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  type EasyView,
  type ReaderMode,
  type ReaderSettings,
} from '@/domain/reader/settings';
import { t } from '@/i18n';
import { saveReaderSettings, saveReadingPosition } from '@/services/reader';
import { showToast } from '@/ui/toast';
import { AutoView } from './AutoView';
import { EasyText } from './EasyText';
import { NormalView } from './NormalView';
import { PageView } from './PageView';
import { SettingsPanel, TocPanel } from './Panels';
import { crumbText, fmt } from './texts';

interface ReaderProps {
  meta: BookMeta;
  content: BookContent;
  initialSettings: ReaderSettings;
  onBack: () => void;
}

/** A position save waits this long for the next move (the standalone reader's 400 ms). */
const SAVE_DELAY_MS = 400;

const MODES: readonly ReaderMode[] = ['easy', 'auto', 'normal'];

export type Jump = { s: number; n: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Reader({ meta, content, initialSettings, onBack }: ReaderProps) {
  const sections = content.sections;
  const { sents, secStart } = useMemo(() => flatten(sections), [sections]);
  const last = sents.length - 1;
  const [settings, setSettings] = useState(initialSettings);
  const groups = useMemo(() => buildGroups(sents, settings.per), [sents, settings.per]);
  const [sIdx, setSIdx] = useState(() => {
    const at = clamp(meta.pos || 0, 0, last);
    return initialSettings.mode === 'easy' ? (groups[groupIndexOf(groups, at)] ?? 0) : at;
  });
  const [jump, setJump] = useState<Jump>({ s: sIdx, n: 0 });
  const [easyAnim, setEasyAnim] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<'settings' | 'toc' | null>(null);
  const endNoted = useRef(false);

  const mode = settings.mode;
  const gi = groupIndexOf(groups, sIdx);
  const pos = mode === 'easy' ? (groups[gi] ?? 0) : sIdx;
  const groupEnd = groups[gi + 1] ?? sents.length;
  const current = sents[pos];

  // ── Saving ────────────────────────────────────────────────────────────────
  const metaRef = useRef(meta);
  const posRef = useRef(pos);
  posRef.current = pos;
  const saveTimer = useRef(0);
  const saveWarned = useRef(false);
  const flushSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    const next = { ...metaRef.current, pos: posRef.current, opened: Date.now() };
    metaRef.current = next;
    saveReadingPosition(next, next.pos).catch(() => {
      if (saveWarned.current) return;
      saveWarned.current = true;
      showToast({ message: t('reader.errors.saveFailed'), tone: 'negative' });
    });
  };
  const firstPos = useRef(true);
  useEffect(() => {
    if (firstPos.current) {
      firstPos.current = false;
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
  }, [pos]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setPlaying(false);
        flushSave();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    addEventListener('pagehide', flushSave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pagehide', flushSave);
      // Closing the book (Back) saves where it stopped and that it was just read.
      flushSave();
    };
  }, []);

  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    saveReaderSettings(settings).catch(() => undefined);
  }, [settings]);

  const update = (patch: Partial<ReaderSettings>) => setSettings((s) => ({ ...s, ...patch }));

  // ── Moving ────────────────────────────────────────────────────────────────
  const go = (delta: number) => {
    if (mode !== 'easy') return;
    const ni = clamp(gi + delta, 0, groups.length - 1);
    if (ni === gi) {
      if (delta > 0 && !endNoted.current) {
        endNoted.current = true;
        showToast({ message: t('reader.end') });
      }
      return;
    }
    endNoted.current = false;
    setSIdx(groups[ni] ?? 0);
    setEasyAnim((n) => n + 1);
  };

  const jumpTo = (idx: number) => {
    const s = clamp(idx, 0, last);
    if (mode === 'easy') {
      setSIdx(groups[groupIndexOf(groups, s)] ?? 0);
      setEasyAnim((n) => n + 1);
      return;
    }
    if (mode === 'normal') setSIdx(s);
    setJump((j) => ({ s, n: j.n + 1 }));
  };

  const setMode = (next: ReaderMode) => {
    if (next === mode) return;
    setPlaying(false);
    if (next === 'easy') setSIdx(groups[groupIndexOf(groups, sIdx)] ?? 0);
    update({ mode: next });
  };

  const setView = (view: EasyView) => {
    if (view === settings.view) return;
    setPlaying(false);
    update({ view });
  };

  const setPer = (per: 1 | 2) => {
    if (per === settings.per) return;
    const nextGroups = buildGroups(sents, per);
    if (mode === 'easy') setSIdx(nextGroups[groupIndexOf(nextGroups, pos)] ?? 0);
    update({ per });
  };

  const resize = (delta: number) => update({ size: clamp(settings.size + delta, 0, EASY_SIZES.length - 1) });
  const setWpm = (v: number) => update({ wpm: clampWpm(v) });

  const onSeek = (value: number) => {
    if (mode === 'normal') {
      setSIdx(clamp(value, 0, last));
      setJump((j) => ({ s: value, n: j.n + 1 }));
    } else {
      setSIdx(groups[clamp(value, 0, groups.length - 1)] ?? 0);
    }
  };

  // ── Keys and swipes ───────────────────────────────────────────────────────
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      setPanel(null);
      return;
    }
    if (panel !== null) return;
    const target = e.target instanceof Element ? e.target : null;
    const onButton = !!target?.closest('button');
    if (mode === 'easy') {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onButton)) {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      }
    } else if (mode === 'auto' && !target?.classList.contains('reader__wpm')) {
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        jumpTo(sIdx + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpTo(sIdx - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setWpm(settings.wpm + WPM_STEP);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setWpm(settings.wpm - WPM_STEP);
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const touch = useRef({ x: 0, y: 0 });
  const swipe = {
    onTouchStart: (e: TouchEvent) => {
      const p = e.changedTouches[0];
      if (p) touch.current = { x: p.clientX, y: p.clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      const p = e.changedTouches[0];
      if (!p) return;
      const dx = p.clientX - touch.current.x;
      const dy = p.clientY - touch.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    },
  };

  // ── Rendering ─────────────────────────────────────────────────────────────
  const pct = percentRead(pos, sents.length);
  const status = (
    <div class="reader__status">
      <b>{pct}%</b>
      <br />
      {t('reader.status', { n: fmt(pos + 1), total: fmt(sents.length) })}
    </div>
  );
  const secIndex = current?.sec ?? 0;

  return (
    <div
      class="reader"
      data-theme={settings.theme}
      data-mode={mode}
      style={{ '--reader-size': `${EASY_SIZES[settings.size] ?? 26}px` }}
    >
      <header class="reader__top">
        <div class="reader__top-left">
          <button type="button" class="reader__icon-btn" title={t('reader.backLabel')} onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            <span>{t('reader.back')}</span>
          </button>
          <button
            type="button"
            class="reader__icon-btn"
            aria-label={t('reader.textSettingsLabel')}
            aria-expanded={panel === 'settings'}
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
          >
            {t('reader.textSettings')}
          </button>
        </div>
        <div class="reader__top-right">
          <button
            type="button"
            class="reader__icon-btn"
            aria-expanded={panel === 'toc'}
            onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
          >
            <ListTree aria-hidden="true" />
            <span>{t('reader.toc')}</span>
          </button>
        </div>
        <div class="reader__modes">
          <div class="reader__seg" role="group" aria-label={t('reader.modeLabel')}>
            {MODES.map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {t(`reader.modes.${m}`)}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div class="reader__crumb">{crumbText(meta.title, sections[secIndex], secIndex)}</div>

      <div class="reader__stage">
        {mode === 'easy' && settings.view === 'sentences' && (
          <div class="reader__easy" {...swipe}>
            <EasyText sents={sents} sections={sections} secStart={secStart} start={pos} end={groupEnd} anim={easyAnim} />
          </div>
        )}
        {mode === 'easy' && settings.view === 'page' && (
          <PageView
            sents={sents}
            sections={sections}
            secStart={secStart}
            start={pos}
            end={groupEnd}
            anim={easyAnim}
            size={settings.size}
            onPick={jumpTo}
          />
        )}
        {mode === 'auto' && (
          <AutoView
            sents={sents}
            sections={sections}
            secStart={secStart}
            start={sIdx}
            jump={jump}
            playing={playing}
            wpm={settings.wpm}
            size={settings.size}
            onSentence={setSIdx}
            onEnd={() => {
              setPlaying(false);
              showToast({ message: t('reader.end') });
            }}
          />
        )}
        {mode === 'normal' && (
          <NormalView
            sents={sents}
            sections={sections}
            secStart={secStart}
            start={sIdx}
            current={sIdx}
            jump={jump}
            size={settings.size}
            onPosition={setSIdx}
          />
        )}
      </div>

      <footer class="reader__foot">
        <div class="reader__foot-inner">
          {mode !== 'auto' && (
            <input
              class="reader__seek"
              type="range"
              min={0}
              max={mode === 'easy' ? groups.length - 1 : last}
              value={mode === 'easy' ? gi : sIdx}
              aria-label={t('reader.seek')}
              onInput={(e) => onSeek(Number((e.currentTarget as HTMLInputElement).value))}
            />
          )}
          {mode !== 'auto' ? (
            <div class="reader__nav">
              {mode === 'easy' && (
                <button type="button" class="reader__arrow" title={t('reader.prevLabel')} disabled={gi === 0} onClick={() => go(-1)}>
                  <ArrowLeft aria-hidden="true" />
                  <span>{t('reader.prev')}</span>
                </button>
              )}
              {status}
              {mode === 'easy' && (
                <button
                  type="button"
                  class="reader__arrow reader__arrow--primary"
                  title={t('reader.nextLabel')}
                  disabled={gi >= groups.length - 1}
                  onClick={() => go(1)}
                >
                  <span>{t('reader.next')}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div class="reader__auto">
              <div class="reader__speed">
                <button type="button" aria-label={t('reader.slower')} onClick={() => setWpm(settings.wpm - WPM_STEP)}>
                  {t('reader.slowerShort')}
                </button>
                <div class="reader__speed-mid">
                  <input
                    class="reader__wpm"
                    type="range"
                    min={WPM_MIN}
                    max={WPM_MAX}
                    step={10}
                    value={settings.wpm}
                    aria-label={t('reader.speed')}
                    onInput={(e) => setWpm(Number((e.currentTarget as HTMLInputElement).value))}
                  />
                  <output>
                    <b>{settings.wpm}</b> {t('reader.wpm')}
                  </output>
                </div>
                <button type="button" aria-label={t('reader.faster')} onClick={() => setWpm(settings.wpm + WPM_STEP)}>
                  {t('reader.fasterShort')}
                </button>
              </div>
              <div class="reader__nav">
                {status}
                <button type="button" class="reader__arrow reader__arrow--primary reader__play" onClick={() => setPlaying((p) => !p)}>
                  {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  <span>{t(playing ? 'reader.pause' : 'reader.play')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </footer>

      <SettingsPanel
        open={panel === 'settings'}
        onClose={() => setPanel(null)}
        settings={settings}
        onResize={resize}
        onView={setView}
        onPer={setPer}
        onTheme={(theme) => update({ theme })}
      />
      <TocPanel
        open={panel === 'toc'}
        onClose={() => setPanel(null)}
        sections={sections}
        secStart={secStart}
        total={sents.length}
        current={secIndex}
        onPick={(s) => {
          setPanel(null);
          jumpTo(s);
        }}
      />
    </div>
  );
}
