// Reading one book, full screen. Three modes, as in the standalone reader:
// - Prosta (easy): one or two sentences a screen, or the whole section with them
//   highlighted ("Cała strona"); arrows, swipe, keys and the slider move.
// - Auto: a light walks word by word at a set pace, longer at punctuation and long
//   words; a tap on a word moves it there; it goes on to the next section by itself.
// - Normalny: plain scrolling of the whole book; the position follows the scroll.
// A phone held sideways shows the book as an open two-page spread instead (SpreadView,
// row r-2): Prosta steps a sentence at a time and zooms onto it (or turns whole
// spreads with the zoom off), Auto's light walks the pages and the zoom follows it,
// Normalny turns spreads. The book's own table of contents is left out of reading and
// of the counts (domain/reader/toc) unless the setting keeps it; positions are saved
// as sentences of the whole book, so that choice never moves anyone.
// The position is saved on the device a moment after each move, and at once when the
// page hides or the reader closes. Nothing here touches points or statistics.
import { ArrowLeft, ArrowRight, ListTree, Maximize2, Minimize2, Pause, Play } from 'lucide-preact';
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
import { firstContentSentence, fromFull, hasToc, readingView, tocBlocks, type TocMarks } from '@/domain/reader/toc';
import { t } from '@/i18n';
import { saveReaderSettings, saveReadingPosition } from '@/services/reader';
import { showToast } from '@/ui/toast';
import { AutoView } from './AutoView';
import { EasyText } from './EasyText';
import { NormalView } from './NormalView';
import { PageView } from './PageView';
import { BookTocPanel, SettingsPanel, TocPanel } from './Panels';
import { SpreadView, type SpreadControl } from './SpreadView';
import { crumbText, fmt } from './texts';
import { fullscreenRemembered, leaveSystemFullscreen, rememberFullscreen, requestSystemFullscreen } from './fullscreen';
import { useLandscape } from './useLandscape';

interface ReaderProps {
  meta: BookMeta;
  content: BookContent;
  /** The book's own table of contents (domain/reader/toc detectToc). */
  marks: TocMarks;
  initialSettings: ReaderSettings;
  onBack: () => void;
}

/** A position save waits this long for the next move (the standalone reader's 400 ms). */
const SAVE_DELAY_MS = 400;

const MODES: readonly ReaderMode[] = ['easy', 'auto', 'normal'];

export type Jump = { s: number; n: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Panel = 'settings' | 'toc' | 'bookToc' | null;

export function Reader({ meta, content, marks, initialSettings, onBack }: ReaderProps) {
  const full = useMemo(() => flatten(content.sections), [content]);
  const [settings, setSettings] = useState(initialSettings);
  const landscape = useLandscape();
  const view = useMemo(() => readingView(content.sections, full, marks, settings.skipToc), [content, full, marks, settings.skipToc]);
  const sections = view.sections;
  const { sents, secStart } = useMemo(() => flatten(sections), [sections]);
  const last = Math.max(0, sents.length - 1);
  const groups = useMemo(() => buildGroups(sents, settings.per), [sents, settings.per]);

  // The position as a sentence of the whole book: the same place whether the table of contents is skipped or not.
  const [fullPos, setFullPos] = useState(() => {
    // A book opened for the first time starts after its table of contents (chapter 1).
    const firstOpen = meta.opened === 0 && meta.pos === 0;
    return firstOpen && initialSettings.skipToc ? firstContentSentence(full, marks) : meta.pos || 0;
  });
  const sIdx = clamp(fromFull(view, fullPos), 0, last);
  const setSIdx = (s: number) => setFullPos(view.toFull[clamp(s, 0, last)] ?? 0);

  const [jump, setJump] = useState<Jump>({ s: sIdx, n: 0 });
  const [easyAnim, setEasyAnim] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  // ── Full screen: only the book and its arrows (fullscreen.ts) ──────────────
  const [fullscreen, setFullscreen] = useState(fullscreenRemembered);
  /** The browser's own full screen is on because the reader asked for it. */
  const systemFullscreen = useRef(false);
  const enterFullscreen = () => {
    setPanel(null);
    setFullscreen(true);
    rememberFullscreen(true);
    void requestSystemFullscreen().then((granted) => {
      systemFullscreen.current = granted;
    });
  };
  const exitFullscreen = () => {
    setFullscreen(false);
    rememberFullscreen(false);
    systemFullscreen.current = false;
    leaveSystemFullscreen();
  };
  useEffect(() => {
    // Left by the system (Back, Esc, a gesture): the reader leaves it too.
    const onChange = () => {
      if (document.fullscreenElement) systemFullscreen.current = true;
      else if (systemFullscreen.current) {
        systemFullscreen.current = false;
        setFullscreen(false);
        rememberFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      // Closing the book leaves the browser's full screen (the library has its own controls).
      if (systemFullscreen.current) leaveSystemFullscreen();
    };
  }, []);
  const togglePlay = () => setPlaying((p) => !p);
  const endNoted = useRef(false);
  const spread = useRef<SpreadControl | null>(null);

  const mode = settings.mode;
  const gi = groupIndexOf(groups, sIdx);
  // Portrait Prosta shows whole groups; the spread steps sentence by sentence.
  const groupMode = mode === 'easy' && !landscape;
  const pos = groupMode ? (groups[gi] ?? 0) : sIdx;
  const groupEnd = groups[gi + 1] ?? sents.length;
  const current = sents[pos];

  // ── Saving ────────────────────────────────────────────────────────────────
  const metaRef = useRef(meta);
  const saved = useRef({ full: view.toFull[pos] ?? 0, progress: { pos, total: sents.length } });
  saved.current = { full: view.toFull[pos] ?? 0, progress: { pos, total: sents.length } };
  const saveTimer = useRef(0);
  const saveWarned = useRef(false);
  const flushSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    const { full: at, progress } = saved.current;
    const next = { ...metaRef.current, pos: at, opened: Date.now(), progress };
    metaRef.current = next;
    saveReadingPosition(next, at, progress).catch(() => {
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
  }, [pos, view]);

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
  const noteEnd = () => {
    if (endNoted.current) return;
    endNoted.current = true;
    showToast({ message: t('reader.end') });
  };

  const go = (delta: number) => {
    if (landscape) {
      if (delta > 0) spread.current?.next();
      else spread.current?.prev();
      return;
    }
    if (mode !== 'easy') return;
    const ni = clamp(gi + delta, 0, groups.length - 1);
    if (ni === gi) {
      if (delta > 0) noteEnd();
      return;
    }
    endNoted.current = false;
    setSIdx(groups[ni] ?? 0);
    setEasyAnim((n) => n + 1);
  };

  const jumpTo = (idx: number) => {
    const s = clamp(idx, 0, last);
    if (groupMode) {
      setSIdx(groups[groupIndexOf(groups, s)] ?? 0);
      setEasyAnim((n) => n + 1);
      return;
    }
    if (mode !== 'auto' || landscape) setSIdx(s);
    setJump((j) => ({ s, n: j.n + 1 }));
  };

  const setMode = (next: ReaderMode) => {
    if (next === mode) return;
    setPlaying(false);
    if (next === 'easy' && !landscape) setSIdx(groups[groupIndexOf(groups, sIdx)] ?? 0);
    update({ mode: next });
  };

  const setView = (v: EasyView) => {
    if (v === settings.view) return;
    setPlaying(false);
    update({ view: v });
  };

  const setPer = (per: 1 | 2) => {
    if (per === settings.per) return;
    const nextGroups = buildGroups(sents, per);
    if (groupMode) setSIdx(nextGroups[groupIndexOf(nextGroups, pos)] ?? 0);
    update({ per });
  };

  const resize = (delta: number) => update({ size: clamp(settings.size + delta, 0, EASY_SIZES.length - 1) });
  const setWpm = (v: number) => update({ wpm: clampWpm(v) });

  const onSeek = (value: number) => {
    if (mode === 'normal') {
      setSIdx(value);
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
      if (panel === null && fullscreen) exitFullscreen();
      setPanel(null);
      return;
    }
    if (panel !== null) return;
    const target = e.target instanceof Element ? e.target : null;
    const onButton = !!target?.closest('button');
    if (mode === 'auto' && target?.classList.contains('reader__wpm')) return;
    if (mode === 'auto') {
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (landscape) spread.current?.next();
        else jumpTo(sIdx + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (landscape) spread.current?.prev();
        else jumpTo(sIdx - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setWpm(settings.wpm + WPM_STEP);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setWpm(settings.wpm - WPM_STEP);
      }
      return;
    }
    if (mode === 'easy' || landscape) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onButton)) {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
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
  const statusText = t('reader.status', { n: fmt(pos + 1), total: fmt(sents.length) });
  const status = (
    <div class="reader__status">
      <b>{pct}%</b>
      <br />
      {statusText}
    </div>
  );
  const secIndex = current?.sec ?? 0;
  const bookToc = useMemo(() => tocBlocks(content.sections, marks), [content, marks]);
  const fontPx = EASY_SIZES[settings.size] ?? 26;

  const playButton = (
    <button type="button" class="reader__arrow reader__arrow--primary reader__play" onClick={() => setPlaying((p) => !p)}>
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      <span>{t(playing ? 'reader.pause' : 'reader.play')}</span>
    </button>
  );

  return (
    <div
      class="reader"
      data-theme={settings.theme}
      data-mode={mode}
      data-layout={landscape ? 'spread' : 'column'}
      data-fullscreen={fullscreen ? 'true' : 'false'}
      style={{ '--reader-size': `${fontPx}px` }}
    >
      {!fullscreen && (
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
          <button type="button" class="reader__icon-btn" title={t('reader.fullscreenLabel')} onClick={enterFullscreen}>
            <Maximize2 aria-hidden="true" />
            <span>{t('reader.fullscreen')}</span>
          </button>
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
        {landscape && (
          <div class="reader__top-status">
            <span class="reader__status reader__status--line" data-testid="reader-status">
              <b>{pct}%</b>
              <span class="reader__status-rest"> · {statusText}</span>
            </span>
            {mode === 'auto' && (
              <div class="reader__top-auto">
                <button type="button" class="reader__mini" aria-label={t('reader.slower')} onClick={() => setWpm(settings.wpm - WPM_STEP)}>
                  {t('reader.slowerShort')}
                </button>
                <output class="reader__mini-out">
                  <b>{settings.wpm}</b> {t('reader.wpm')}
                </output>
                <button type="button" class="reader__mini" aria-label={t('reader.faster')} onClick={() => setWpm(settings.wpm + WPM_STEP)}>
                  {t('reader.fasterShort')}
                </button>
                {playButton}
              </div>
            )}
          </div>
        )}
      </header>
      )}
      {fullscreen && (
        <button type="button" class="reader__fs-exit" aria-label={t('reader.fullscreenExitLabel')} onClick={exitFullscreen}>
          <Minimize2 aria-hidden="true" />
          <span>{t('reader.fullscreenExit')}</span>
        </button>
      )}
      {!landscape && !fullscreen && <div class="reader__crumb">{crumbText(meta.title, sections[secIndex], secIndex)}</div>}

      <div class="reader__stage" key={`${settings.skipToc}-${landscape}`}>
        {landscape && (
          <SpreadView
            control={spread}
            sents={sents}
            sections={sections}
            secStart={secStart}
            mode={mode}
            pos={pos}
            jump={jump}
            zoom={settings.zoom}
            swap={settings.swapButtons}
            playing={playing}
            wpm={settings.wpm}
            fontPx={fontPx}
            onPosition={(s) => {
              endNoted.current = false;
              setSIdx(s);
            }}
            onEnd={() => {
              setPlaying(false);
              noteEnd();
            }}
            onTapPage={fullscreen ? togglePlay : undefined}
            swipe={swipe}
          />
        )}
        {!landscape && mode === 'easy' && settings.view === 'sentences' && (
          <div class="reader__easy" {...swipe}>
            <EasyText sents={sents} sections={sections} secStart={secStart} start={pos} end={groupEnd} anim={easyAnim} />
          </div>
        )}
        {!landscape && mode === 'easy' && settings.view === 'page' && (
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
        {!landscape && mode === 'auto' && (
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
            onTapPage={fullscreen ? togglePlay : undefined}
          />
        )}
        {!landscape && mode === 'normal' && (
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

      {!landscape && (!fullscreen || mode === 'easy') && (
        <footer class="reader__foot">
          <div class="reader__foot-inner">
            {mode !== 'auto' && !fullscreen && (
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
                {!fullscreen && status}
                {fullscreen && <div class="reader__status" />}
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
                  {playButton}
                </div>
              </div>
            )}
          </div>
        </footer>
      )}

      <SettingsPanel
        open={panel === 'settings'}
        onClose={() => setPanel(null)}
        settings={settings}
        landscape={landscape}
        onResize={resize}
        onView={setView}
        onPer={setPer}
        onTheme={(theme) => update({ theme })}
        onToggle={(key, value) => update({ [key]: value })}
      />
      <TocPanel
        open={panel === 'toc'}
        onClose={() => setPanel(null)}
        sections={sections}
        secStart={secStart}
        total={sents.length}
        current={secIndex}
        hasBookToc={hasToc(marks)}
        onBookToc={() => setPanel('bookToc')}
        onPick={(s) => {
          setPanel(null);
          jumpTo(s);
        }}
      />
      <BookTocPanel open={panel === 'bookToc'} onClose={() => setPanel(null)} blocks={bookToc} />
    </div>
  );
}
