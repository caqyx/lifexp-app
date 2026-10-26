// Runs one game over the whole screen (docs/v2/PLAN.md 9.1, stage g-1), with
// "Zakończ" always visible and the play time counted (usePlayTime).
//
// Sandbox: vendored games keep their saves and records in localStorage, which an
// opaque-origin frame cannot use (it throws), so the frame is same-origin:
// `allow-scripts allow-same-origin` and nothing else — no popups, no top-level
// navigation, no forms, no modal dialogs, and an empty `allow` (no camera, microphone,
// geolocation, fullscreen…). Downloads only for a game that saves files for the player
// (GameDef.downloads: Wartime's save export). With these two flags the sandbox
// does not wall the game off from this page, so the trust lies in what is framed:
// only files vendored into this repo from the owner's own repositories at a pinned
// commit (scripts/vendor-game.mjs, VENDORED.json), or LifeXP's own game written in
// this repo (Flappy Bird, v2/public/games/flappy, GAME.json). The vendoring script removes
// third-party scripts (Gridlock's CrazyGames SDK), refuses a copy that still names an
// external host, and writes a Content-Security-Policy into each game page that allows
// only this origin: a game cannot load or send anything elsewhere (children play).
import { RotateCcw, X } from 'lucide-preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { language, t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { frameSrc, type GameDef } from './catalog';
import { usePlayTime } from './usePlayTime';

interface GameHostProps {
  uid: string;
  game: GameDef & { src: string };
  onExit: () => void;
}

export function GameHost({ uid, game, onExit }: GameHostProps) {
  usePlayTime(uid, game.sessionName);
  const frame = useRef<HTMLIFrameElement>(null);
  const [hint, setHint] = useState(game.landscape === true);
  const name = t(`games.names.${game.id}`);

  // The game takes the keys and taps from the start.
  useEffect(() => frame.current?.focus(), []);

  return createPortal(
    <section class="game-host" aria-label={name} data-game={game.id}>
      <div class="game-host__bar">
        <Button variant="secondary" onClick={onExit}>
          <X aria-hidden="true" />
          {t('games.exit')}
        </Button>
        <p class="game-host__title">{name}</p>
      </div>
      {hint && (
        <div class="game-host__hint" role="note">
          <RotateCcw aria-hidden="true" />
          <span>{t('games.rotate')}</span>
          <Button variant="quiet" onClick={() => setHint(false)}>
            {t('games.rotateDismiss')}
          </Button>
        </div>
      )}
      <iframe
        ref={frame}
        class="game-host__frame"
        src={frameSrc(game.src, language.value)}
        title={t('games.frameTitle', { name })}
        sandbox={`allow-scripts allow-same-origin${game.downloads ? ' allow-downloads' : ''}`}
        allow=""
        referrerpolicy="no-referrer"
      />
    </section>,
    document.body,
  );
}
