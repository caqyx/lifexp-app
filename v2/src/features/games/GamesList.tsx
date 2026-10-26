// The four games as cards: name, one line about it, today's play time and "Graj"
// (or "Wkrótce" until its stage adds it).
import { Clock, Play } from 'lucide-preact';
import { minutesByGame } from '@/domain/gaming';
import { t } from '@/i18n';
import type { GamingDayState } from '@/stores/gaming';
import { formatDuration } from '@/features/shared/activity';
import { ButtonLink } from '@/ui/components/ButtonLink';
import { IconTile } from '@/ui/components/Display';
import { Card } from '@/ui/components/Layout';
import { GAMES, type GameDef } from './catalog';

function todayText(minutes: number | undefined): string {
  if (minutes === undefined) return t('games.todayLoading');
  return minutes > 0 ? t('games.today', { time: formatDuration(minutes) }) : t('games.todayNone');
}

function GameCard({ game, minutes }: { game: GameDef; minutes: number | undefined }) {
  const name = t(`games.names.${game.id}`);
  const Icon = game.icon;
  return (
    <li class="game-card" data-game={game.id}>
      <Card>
      <div class="game-card__head">
        <IconTile>
          <Icon />
        </IconTile>
        <div class="game-card__text">
          <h2 class="game-card__name">{name}</h2>
          <p class="game-card__desc">{t(`games.descriptions.${game.id}`)}</p>
        </div>
      </div>
      <div class="game-card__foot">
        <p class="game-card__today numeric">
          <Clock aria-hidden="true" />
          {todayText(minutes)}
        </p>
        {game.src ? (
          <ButtonLink variant="primary" href={`#/games/${game.id}`}>
            <Play aria-hidden="true" />
            {t('games.play')}
            <span class="visually-hidden">: {name}</span>
          </ButtonLink>
        ) : (
          <span class="game-card__soon">{t('games.soon')}</span>
        )}
      </div>
      </Card>
    </li>
  );
}

export function GamesList({ state }: { state: GamingDayState }) {
  const byGame = state.sessions && state.day ? minutesByGame(state.sessions, state.day) : undefined;
  return (
    <>
      <p class="games-note">{t('games.timeNote')}</p>
      {state.failed && (
        <p class="games-error" role="alert">
          {t('games.loadFailed')}
        </p>
      )}
      <ul class="games-list" aria-label={t('nav.games')}>
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} minutes={byGame ? (byGame.get(game.sessionName) ?? 0) : undefined} />
        ))}
      </ul>
    </>
  );
}
