// The book's elements in the text (row r-5): a picture (an image, or a region of a PDF
// page: a chart, a diagram, a formula, a table that would not rebuild) or a rebuilt
// table. They sit in their place in every view and take no part in reading (no
// sentences). A tap opens one on the whole screen, where it can be pinched and moved.
import { signal } from '@preact/signals';
import { Minimize2 } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { BookElement, ImageElement, TableElement } from '@/domain/reader/book';
import { t } from '@/i18n';
import { assetUrl } from '@/services/reader';

/** The element shown on the whole screen, if any. */
export const zoomedElement = signal<BookElement | null>(null);

function useAsset(key: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void assetUrl(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}

function altOf(el: ImageElement): string {
  return el.alt || t(`reader.elements.${el.role ?? 'image'}`);
}

export function Picture({ el }: { el: ImageElement }) {
  const url = useAsset(el.asset);
  // Width and height keep the place (and the pages) the same before the picture arrives.
  return <img class="reader-el__img" src={url ?? undefined} width={el.w} height={el.h} alt={altOf(el)} decoding="async" />;
}

export function Table({ el }: { el: TableElement }) {
  const [head, ...body] = el.header ? el.rows : [undefined, ...el.rows];
  return (
    <table class="reader-el__table">
      {head && (
        <thead>
          <tr>
            {head.map((c, k) => (
              <th key={k} colSpan={c.span}>
                {c.t}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {body.map((row, r) => (
          <tr key={r}>
            {(row ?? []).map((c, k) => (
              <td key={k} colSpan={c.span}>
                {c.t}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One element in the flow of the text; a tap shows it on the whole screen. */
export function ElementBlock({ el, cls = '' }: { el: BookElement; cls?: string }) {
  // The picture's size on the page, kept before it loads (the pages then do not move);
  // it never grows past the column (reader.css).
  const pic = el.kind === 'image' ? el : null;
  return (
    <figure
      class={`reader-el reader-el--${el.kind}${el.kind === 'image' ? ` reader-el--role-${el.role ?? 'image'}` : ''}${cls}`}
      data-testid={`reader-el-${el.kind}`}
      style={{ '--el-w': pic ? `${pic.w}px` : undefined, '--el-ratio': pic ? String(pic.w / Math.max(1, pic.h)) : undefined }}
      onClick={(e) => {
        // Not a tap on the page (zoom, play, a sentence): the element itself.
        e.stopPropagation();
        zoomedElement.value = el;
      }}
    >
      {el.kind === 'image' ? <Picture el={el} /> : <Table el={el} />}
    </figure>
  );
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The element on the whole screen: pinch (or wheel) to zoom, drag to move; "Zamknij" or Esc closes. */
export function ElementZoom() {
  const el = zoomedElement.value;
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const apply = () => {
    const s = stage.current;
    if (!s) return;
    s.style.setProperty('--zoom-scale', String(view.current.scale));
    s.style.setProperty('--zoom-x', `${view.current.x}px`);
    s.style.setProperty('--zoom-y', `${view.current.y}px`);
  };

  useEffect(() => {
    view.current = { scale: 1, x: 0, y: 0 };
    apply();
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        zoomedElement.value = null;
      }
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [el]);

  if (!el) return null;
  const close = () => {
    zoomedElement.value = null;
  };
  return (
    <div class="reader-zoom" role="dialog" aria-label={t('reader.elements.zoomed')}>
      <div
        ref={stage}
        class="reader-zoom__stage"
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.current.scale };
          }
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
            view.current.scale = clamp((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.current.dist), 1, 6);
          } else if (pointers.current.size === 1) {
            view.current.x += e.clientX - prev.x;
            view.current.y += e.clientY - prev.y;
          }
          apply();
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          view.current.scale = clamp(view.current.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 1, 6);
          apply();
        }}
        onDblClick={() => {
          view.current = view.current.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 };
          apply();
        }}
      >
        <div class="reader-zoom__content">{el.kind === 'image' ? <Picture el={el} /> : <Table el={el} />}</div>
      </div>
      <p class="reader-zoom__hint">{t('reader.elements.zoomHint')}</p>
      <button type="button" class="reader-zoom__close" onClick={close}>
        <Minimize2 aria-hidden="true" />
        <span>{t('reader.close')}</span>
      </button>
    </div>
  );
}
