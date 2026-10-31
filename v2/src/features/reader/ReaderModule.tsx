// The reader (docs/v2/PLAN.md 9.1 row "r"): an opt-in module, off until turned on in
// Settings → Moduły. #/reader is the library, inside the app shell; #/reader/:id
// reads one book full screen (registry `bare`), with its own Paper/Night themes and
// the Literata serif. Books, positions and settings stay on this device; reading
// earns no points and is in no statistics.
import type { RouteProps } from '@/lib/route-match';
import { LibraryPage } from './LibraryPage';
import { ReaderScreen } from './ReaderScreen';

export default function ReaderModule({ params, navigate }: RouteProps) {
  if (params.id) return <ReaderScreen key={params.id} id={params.id} navigate={navigate} />;
  return <LibraryPage navigate={navigate} />;
}
