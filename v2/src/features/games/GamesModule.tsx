// Games (docs/v2/PLAN.md 9.1, stage g-1): the list at #/games, one game at
// #/games/:id. Playing costs no points; its time is recorded the way v1 records
// gaming, so the parent view, the weekly report and the parent alert see it.
import { useEffect } from 'preact/hooks';
import { t } from '@/i18n';
import { utcDayKey } from '@/lib/dates';
import type { RouteProps } from '@/lib/route-match';
import { recoverPlays } from '@/services/gaming';
import { gamingDay, watchGamingDay } from '@/stores/gaming';
import { account } from '@/stores/session';
import { ButtonLink } from '@/ui/components/ButtonLink';
import { EmptyState } from '@/ui/components/Display';
import { Card, Page, Stack } from '@/ui/components/Layout';
import { gameById, type GameDef } from './catalog';
import { GameHost } from './GameHost';
import { GamesList } from './GamesList';
import './games.css';

function SoonPage({ game }: { game: GameDef }) {
  return (
    <Card>
      <EmptyState
        title={t(`games.names.${game.id}`)}
        body={`${t('games.soon')}. ${t('games.soonBody')}`}
        action={<ButtonLink href="#/games">{t('games.back')}</ButtonLink>}
      />
    </Card>
  );
}

export default function GamesModule({ params, navigate }: RouteProps) {
  const current = account.value;
  const uid = current?.user.uid;
  const today = utcDayKey(new Date());
  // Sessions a page that died left on the device are written on the next visit to the
  // games; offline they wait for the one after.
  useEffect(() => {
    if (uid) recoverPlays(uid).catch(() => undefined);
  }, [uid]);
  useEffect(() => (uid ? watchGamingDay(uid, today) : undefined), [uid, today]);
  if (!current || !uid) return null;

  const game = params.id ? gameById(params.id) : null;
  if (params.id && game?.src) {
    const src = game.src;
    return <GameHost key={game.id} uid={uid} game={{ ...game, src }} onExit={() => navigate('/games')} />;
  }

  return (
    <Page>
      <Stack>
        {params.id ? (
          game ? (
            <SoonPage game={game} />
          ) : (
            <Card>
              <EmptyState
                title={t('games.notFound')}
                action={<ButtonLink href="#/games">{t('games.back')}</ButtonLink>}
              />
            </Card>
          )
        ) : (
          <GamesList state={gamingDay.value} />
        )}
      </Stack>
    </Page>
  );
}
