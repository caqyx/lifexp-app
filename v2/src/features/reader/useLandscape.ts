// A phone held sideways: wider than tall and at most 600 px high (a tablet or a
// desktop window keeps the ordinary layout). The reader then shows a two-page spread.
import { useEffect, useState } from 'preact/hooks';

export const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px)';

export function useLandscape(): boolean {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(LANDSCAPE_QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(LANDSCAPE_QUERY);
    const update = () => setOn(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return on;
}
