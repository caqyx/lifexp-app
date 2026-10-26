// Counts the play time of the game on screen and writes it when play ends
// (docs/v2/PLAN.md 9.1, stage g-1). Only time while the page is visible counts
// (the host covers the whole screen, so the game is visible whenever the page is).
// The session has its document id from the start (services/gaming newPlayId):
// - visibilitychange: hidden pauses and keeps a copy of the session on the device
//   (holdPlay), because a phone may kill a hidden tab without pagehide; visible
//   resumes and drops the copy;
// - leaving (Zakończ, Back, another route) unmounts the host and writes the session;
// - pagehide (tab closed, reload, leaving the app) writes it as a best effort, since
//   the page may die before Firestore stores the write, and keeps the copy: the next
//   visit to the games writes it under the same id only if Firestore does not have it
//   (recoverPlays), so it is written once either way;
// - a page restored from the back/forward cache starts a new session.
import { useEffect } from 'preact/hooks';
import { pauseClock, playedMs, resumeClock, startClock, type PlayClock } from '@/domain/gaming';
import { t } from '@/i18n';
import { holdPlay, newPlayId, recordPlay, releasePlay } from '@/services/gaming';
import { formatDuration } from '@/features/shared/activity';
import { showToast } from '@/ui/toast';

const visible = () => document.visibilityState === 'visible';

export function usePlayTime(uid: string, game: string): void {
  useEffect(() => {
    let id = newPlayId(uid);
    let clock: PlayClock = startClock(Date.now(), visible());
    let ended = false;

    const end = (how: 'leave' | 'pagehide') => {
      if (ended) return;
      ended = true;
      const now = Date.now();
      const ms = playedMs(clock, now);
      if (how === 'pagehide') holdPlay(uid, id, game, ms, now);
      else releasePlay(id);
      const { session, saved } = recordPlay(uid, id, game, ms, new Date(now));
      if (how === 'pagehide') return;
      if (session) showToast({ message: t('games.saved', { time: formatDuration(session.duration) }) });
      saved.catch(() => showToast({ message: t('games.saveFailed'), tone: 'negative' }));
    };

    const onVisibility = () => {
      if (ended) return;
      const now = Date.now();
      if (visible()) {
        clock = resumeClock(clock, now);
        releasePlay(id);
      } else {
        clock = pauseClock(clock, now);
        const ms = playedMs(clock, now);
        if (ms > 0) holdPlay(uid, id, game, ms, now);
      }
    };
    const onPageHide = () => end('pagehide');
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      id = newPlayId(uid);
      clock = startClock(Date.now(), visible());
      ended = false;
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      end('leave');
    };
  }, [uid, game]);
}
