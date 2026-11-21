// Renders the banner queue (ui/banner.ts): a notification sliding in from the top,
// like a phone's. Tap it to open what it is about, "Zamknij" or a swipe up to put it
// away; it leaves by itself after a while (not while a finger or the pointer is on
// it). Transform and opacity only; with reduced motion it simply appears and goes.
import { Bell } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/i18n';
import { releaseVelocity, TAP_SLOP, type DragSample } from '@/lib/gesture';
import { BANNER_DURATION_MS, banners, dismissBanner, swipeDismisses, type Banner } from '../banner';
import { useLiquidGlass } from '../glass/useLiquidGlass';
import { cssDurationMs } from '../motion';
import './Banner.css';

interface Drag {
  pointerId: number;
  startY: number;
  samples: DragSample[];
  moved: boolean;
}

function BannerView({ banner }: { banner: Banner }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  useLiquidGlass(ref);

  const leave = () => setLeaving(true);

  useEffect(() => {
    if (held || leaving) return;
    const timer = setTimeout(leave, banner.durationMs ?? BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [banner.id, held, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => dismissBanner(banner.id), cssDurationMs('--duration-exit'));
    return () => clearTimeout(timer);
  }, [leaving]);

  const setOffset = (px: number) => ref.current?.style.setProperty('--drag-y', `${px}px`);

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('.ui-banner__close')) return;
    drag.current = { pointerId: e.pointerId, startY: e.clientY, samples: [{ pos: e.clientY, t: e.timeStamp }], moved: false };
    suppressClick.current = false;
    setHeld(true);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < TAP_SLOP) return;
      d.moved = true;
      ref.current?.classList.add('is-dragging');
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    d.samples.push({ pos: e.clientY, t: e.timeStamp });
    if (d.samples.length > 32) d.samples.shift();
    // Up follows the finger; down only a little, with resistance.
    setOffset(dy < 0 ? dy : dy / 4);
  };

  const finish = (e: PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setHeld(false);
    if (!d.moved) return;
    suppressClick.current = true;
    ref.current?.classList.remove('is-dragging');
    const dy = e.clientY - d.startY;
    const height = ref.current?.getBoundingClientRect().height ?? 1;
    if (!cancelled && swipeDismisses(dy, releaseVelocity(d.samples), height)) {
      leave();
    } else {
      setOffset(0);
    }
  };

  return (
    <div
      ref={ref}
      class={`ui-banner ui-glass ui-glass--panel${leaving ? ' ui-banner--leaving' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusIn={() => setHeld(true)}
      onFocusOut={() => setHeld(false)}
      data-testid="notification-banner"
    >
      <button
        type="button"
        class="ui-banner__open"
        onClick={() => {
          if (suppressClick.current) return;
          leave();
          banner.onOpen?.();
        }}
      >
        <span class="ui-banner__source">
          <span class="ui-banner__app" aria-hidden="true">
            <Bell />
          </span>
          {banner.source}
          <span class="ui-banner__when">{t('ui.banner.now')}</span>
        </span>
        <span class="ui-banner__title">{banner.title}</span>
        {banner.body && <span class="ui-banner__body">{banner.body}</span>}
      </button>
      <button type="button" class="ui-banner__close" onClick={leave}>
        {t('ui.close')}
      </button>
    </div>
  );
}

export function BannerHost() {
  const current = banners.value[0];
  return (
    <div class="ui-banner-host" role="status" aria-live="polite">
      {current && <BannerView key={current.id} banner={current} />}
    </div>
  );
}
