// The parent's view (docs/v2/PLAN.md 9.1, row 6-2): v1's parent.html on the shared
// domain (domain/parent parentSummary). A parent is whoever signs in with the
// e-mail a child entered as parentEmail; the children and their data are read once
// (stores/parent), within what firestore.rules gives a parent. View only: nothing
// here writes. Money transactions are not shown (v1 neither; the rules keep them
// for the owner).
import { Eye, ShoppingBag, Wallet } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { parentSummary, type ParentSummary } from '@/domain/parent';
import { levelTitleIndex, XP_PER_LEVEL } from '@/domain/points';
import { formatDuration, ActivityRow } from '@/features/shared/activity';
import { weekBars } from '@/features/shared/charts';
import { goalAmount } from '@/features/shared/goals';
import { locale, t } from '@/i18n';
import { formatDayMonth, formatShortDate, utcDayKey } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { childData, findParentChildren, loadChildData, parentChildren, type ParentChild } from '@/stores/parent';
import { session } from '@/stores/session';
import { BarChart } from '@/ui/components/BarChart';
import { Button } from '@/ui/components/Button';
import { EmptyState, IconTile, List, ListRow, Metric, ProgressBar, Skeleton } from '@/ui/components/Display';
import { Select, SegmentedControl } from '@/ui/components/Fields';
import { Card, Page, Section, Stack } from '@/ui/components/Layout';
import './parent.css';

/** SegmentedControl holds 2–4 options; more children get a Select. */
const SEGMENTS_MAX = 4;

function ChildSwitch({ kids, uid, onPick }: { kids: readonly ParentChild[]; uid: string; onPick: (uid: string) => void }) {
  if (kids.length < 2) return null;
  const options = kids.map((k) => ({ value: k.uid, label: k.profile.name }));
  return kids.length <= SEGMENTS_MAX ? (
    <SegmentedControl label={t('parent.child')} value={uid} options={options} onChange={onPick} />
  ) : (
    <Select label={t('parent.child')} value={uid} options={options} onChange={onPick} />
  );
}

function PointsCard({ s }: { s: ParentSummary }) {
  const lang = locale();
  const title = t(`today.levelTitle.${levelTitleIndex(s.level.level)}` as 'today.levelTitle.1');
  return (
    <Card>
      <div class="parent-points">
        <Metric
          size="hero"
          label={t('parent.points', { name: s.name })}
          value={t('units.points', { points: formatInteger(s.points.total, lang) })}
          detail={t('parent.pointsWorth', { amount: formatMoney(s.points.totalGrosze, lang) })}
        />
        <div class="parent-grid">
          <Metric label={t('parent.pointsToday')} value={formatInteger(s.points.today, lang)} />
          <Metric
            label={t('parent.spent')}
            value={formatInteger(s.points.spentAllTime, lang)}
            detail={formatMoney(s.points.spentAllTimeGrosze, lang)}
          />
          <Metric
            label={t('parent.level')}
            value={formatInteger(s.level.level, lang)}
            detail={`${title} · ${t('today.levelXp', { cur: s.level.intoLevel, max: XP_PER_LEVEL })}`}
          />
          <Metric
            label={t('parent.streak')}
            value={formatInteger(s.streakDays, lang)}
            detail={s.streakDays > 0 ? t('today.streakDays', { count: s.streakDays }) : undefined}
          />
        </div>
      </div>
    </Card>
  );
}

function Charts({ s, todayKey }: { s: ParentSummary; todayKey: string }) {
  // Two units, two charts (PLAN.md 7.5): never two axes on one.
  return (
    <>
      <Section title={t('parent.pointsWeek')}>
        <Card>
          <BarChart
            label={t('parent.pointsWeek')}
            data={weekBars(s.week, todayKey, (d) => d.points, (n) => t('units.points', { points: n }))}
          />
        </Card>
      </Section>
      <Section title={t('parent.gamingWeek')}>
        <Card>
          <div class="parent-grid parent-grid--gap">
            <Metric label={t('parent.gamingToday')} value={formatDuration(s.gaming.todayMinutes)} />
            <Metric label={t('parent.gamingWeekTotal')} value={formatDuration(s.gaming.weekMinutes)} />
          </div>
          <BarChart
            label={t('parent.gamingWeek')}
            data={weekBars(s.week, todayKey, (d) => d.gamingMinutes, formatDuration)}
          />
        </Card>
      </Section>
    </>
  );
}

function Goals({ s }: { s: ParentSummary }) {
  const lang = locale();
  return (
    <Section title={t('parent.goals')}>
      <Card>
        {s.goals.length === 0 ? (
          <EmptyState title={t('parent.noGoals')} />
        ) : (
          <ul class="parent-goals" aria-label={t('parent.goals')}>
            {s.goals.map(({ goal, progress }) => (
              <li key={goal.id} class="parent-goal">
                <span class="parent-goal__top">
                  <span class="parent-goal__name user-text">{goal.name}</span>
                  <span class={`numeric tone-${progress.reached ? 'positive' : 'default'}`}>
                    {progress.reached
                      ? t('goals.reached')
                      : t('goals.missing', { amount: goalAmount(goal.type, progress.missing, lang) })}
                  </span>
                </span>
                <ProgressBar
                  value={progress.share}
                  label={t('goals.progress', {
                    current: goalAmount(goal.type, progress.current, lang),
                    target: goalAmount(goal.type, goal.target, lang),
                    percent: Math.floor(progress.share * 100),
                  })}
                  tone={progress.reached ? 'positive' : 'default'}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

function Chores({ s }: { s: ParentSummary }) {
  const lang = locale();
  return (
    <>
      <Section title={t('parent.chores')}>
        <Card>
          <Metric
            label={t('today.choresUnpaid')}
            value={formatMoney(s.chores.unpaidGrosze, lang)}
            detail={t('parent.choresUnpaid', { points: formatInteger(s.chores.unpaidPoints, lang) })}
            tone="positive"
          />
        </Card>
      </Section>
      <Section title={t('parent.payouts')}>
        <Card padding={s.chores.payouts.length === 0 ? 'md' : 'none'}>
          {s.chores.payouts.length === 0 ? (
            <EmptyState title={t('parent.noPayouts')} />
          ) : (
            <List label={t('parent.payouts')}>
              {s.chores.payouts.map((p) => (
                <ListRow
                  key={p.id}
                  leading={
                    <IconTile tone="positive">
                      <Wallet />
                    </IconTile>
                  }
                  title={formatMoney(p.grosze, lang)}
                  meta={[
                    p.createdAt ? formatShortDate(p.createdAt, lang) : '',
                    p.fromISO && p.toISO
                      ? t('parent.payoutPeriod', { from: formatDayMonth(p.fromISO, lang), to: formatDayMonth(p.toISO, lang) })
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={t('units.points', { points: formatInteger(p.points, lang) })}
                />
              ))}
            </List>
          )}
        </Card>
      </Section>
    </>
  );
}

function Purchases({ s }: { s: ParentSummary }) {
  const lang = locale();
  return (
    <Section title={t('parent.purchases')}>
      <Card padding={s.recentPurchases.length === 0 ? 'md' : 'none'}>
        {s.recentPurchases.length === 0 ? (
          <EmptyState title={t('parent.noPurchases')} />
        ) : (
          <List label={t('parent.purchases')}>
            {s.recentPurchases.map((p) => (
              <ListRow
                key={p.id}
                leading={
                  <IconTile tone="warning">
                    <ShoppingBag />
                  </IconTile>
                }
                title={p.description || t('parent.purchases')}
                meta={t('parent.purchaseMeta', {
                  date: p.at ? formatShortDate(p.at, lang) : '—',
                  points: formatInteger(p.pointsCost, lang),
                })}
                value={formatMoney(p.grosze, lang)}
                valueTone="negative"
              />
            ))}
          </List>
        )}
      </Card>
    </Section>
  );
}

function Activities({ s, names }: { s: ParentSummary; names: ReadonlyMap<string, string> }) {
  return (
    <>
      <Section title={t('parent.top')}>
        <Card padding={s.topThisWeek.length === 0 ? 'md' : 'none'}>
          {s.topThisWeek.length === 0 ? (
            <EmptyState title={t('parent.noTop')} />
          ) : (
            <List label={t('parent.top')}>
              {s.topThisWeek.map((top, i) => (
                <ListRow
                  key={top.type}
                  leading={
                    <IconTile>
                      <span class="parent-rank numeric">{i + 1}</span>
                    </IconTile>
                  }
                  title={top.name}
                  meta={t('stats.topCount', { count: top.count })}
                  value={t('units.pointsGained', { points: top.points })}
                  valueTone="positive"
                />
              ))}
            </List>
          )}
        </Card>
      </Section>
      <Section title={t('parent.recent')}>
        <Card padding={s.recentActivities.length === 0 ? 'md' : 'none'}>
          {s.recentActivities.length === 0 ? (
            <EmptyState title={t('parent.noRecent')} />
          ) : (
            <List label={t('parent.recent')}>
              {s.recentActivities.map(({ activity }) => (
                <ActivityRow key={activity.id} activity={activity} names={names} />
              ))}
            </List>
          )}
        </Card>
      </Section>
    </>
  );
}

function Loading() {
  return (
    <Card>
      <Skeleton lines={4} />
    </Card>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <EmptyState
        title={t('parent.loadFailed')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('parent.retry')}
          </Button>
        }
      />
    </Card>
  );
}

export default function ParentPage() {
  const current = session.value;
  const email = current.status === 'signedIn' ? current.user.email : '';
  // Looked up again on every visit, so a link the child just made shows up.
  useEffect(() => findParentChildren(email, true), [email]);
  const state = parentChildren.value;
  const kids = state?.email === email ? state.children : undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const child = Array.isArray(kids) ? (kids.find((k) => k.uid === picked) ?? kids[0]) : undefined;
  useEffect(() => {
    if (child) loadChildData(child);
  }, [child?.uid]);

  const data = childData.value;
  const input = child && data !== null && data.uid === child.uid ? data.input : undefined;
  const now = new Date();
  const todayKey = utcDayKey(now);
  const summary = input && input !== 'error' ? parentSummary(input, now) : undefined;

  return (
    <Page>
      <Stack>
        <p class="parent-note">
          <Eye aria-hidden="true" class="parent-note__icon" />
          {t('parent.readOnly')}
        </p>
        {kids === undefined && <Loading />}
        {kids === 'error' && <Failed onRetry={() => findParentChildren(email, true)} />}
        {Array.isArray(kids) && kids.length === 0 && (
          <Card>
            <EmptyState title={t('parent.noChildren')} body={t('parent.noChildrenBody', { email })} />
          </Card>
        )}
        {child && Array.isArray(kids) && (
          <>
            <ChildSwitch kids={kids} uid={child.uid} onPick={setPicked} />
            {input === 'error' && <Failed onRetry={() => loadChildData(child)} />}
            {input === undefined && <Loading />}
            {summary && input && input !== 'error' && (
              <>
                <PointsCard s={summary} />
                <Charts s={summary} todayKey={todayKey} />
                <Goals s={summary} />
                <Chores s={summary} />
                {summary.moneyBalance !== null && (
                  <Card>
                    <Metric label={t('parent.money')} value={formatMoney(summary.moneyBalance, locale())} />
                  </Card>
                )}
                <Purchases s={summary} />
                <Activities s={summary} names={input.activityNames} />
              </>
            )}
          </>
        )}
      </Stack>
    </Page>
  );
}
