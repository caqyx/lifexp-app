// Module registry (docs/v2/PLAN.md 4.4). Navigation, routes and — later —
// onboarding, the module list in Settings and Ex-us commands are generated from
// this list: adding a module = one folder + one entry here.
import {
  BookOpen,
  CalendarDays,
  ChartLine,
  ClipboardCheck,
  Gamepad2,
  House,
  ListTodo,
  type LucideIcon,
  Megaphone,
  NotebookPen,
  Palette,
  Settings,
  Sparkles,
  Target,
  Users,
  Wallet,
} from 'lucide-preact';
import type { ComponentType } from 'preact';
import { isModuleOn, type ModuleChoice, type OptionalModule } from '@/domain/modules';
import { matchPath, type RouteParams, type RouteProps } from '@/lib/route-match';
import { preloadTasks } from '@/stores/tasks';
import { preloadToday } from '@/stores/today';

export type ModuleId =
  | 'today'
  | 'tasks'
  | 'goals'
  | 'chores'
  | 'money'
  | 'notes'
  | 'calendar'
  | 'stats'
  | 'games'
  | 'reader'
  | 'reports'
  | 'settings'
  | 'exus'
  | 'parent'
  | 'gallery';

/**
 * Sections of the menu, in the order they are listed (owner: things that go
 * together sit together). Planning first; what earns and spends money; what is
 * written and read; play; and at the bottom the person's overview and the app
 * itself, Statistics next to Settings. A section whose modules are all off is not
 * shown. A new module only names its section here (e.g. a calendar: 'plan').
 */
export const NAV_SECTIONS = ['plan', 'money', 'writing', 'fun', 'system'] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export interface FeatureDef {
  id: ModuleId;
  labelKey: `nav.${ModuleId}`;
  /** Hash route patterns; the first one is where navigation points. */
  paths: readonly [string, ...string[]];
  /** Shown next to the label, never instead of it (PLAN.md 7.1, D9). */
  icon: LucideIcon;
  /**
   * Where the menu lists it: its section and its place there (ascending).
   * null = reachable, but not listed in the menu (e.g. Ex-us has its own button).
   */
  nav: { section: NavSection; order: number } | null;
  /** Also in the phone tab bar (D10), in this order; the "+" sits after the second. */
  tab?: number;
  /** Stage of docs/v2/PLAN.md 9 that builds the module; shown until it exists. */
  stage: string;
  /** The person can turn it off in Settings (domain/modules); absent = always there. */
  optional?: OptionalModule;
  /** The module's screen, loaded on first visit. Absent = "coming soon". */
  view?: () => Promise<{ default: ComponentType<RouteProps> }>;
  /** Fetches the code the screen asks for as soon as it mounts (its stores' repositories); see preloadRoute. */
  preload?: () => void;
  /**
   * Sibling views of one screen, switched by its ViewSwitch. Moving between them is
   * not a new screen: the switch slides and only the content below changes.
   */
  views?: readonly string[];
  /**
   * 'parent': listed only for a parent, i.e. an e-mail some child entered as
   * parentEmail (stores/parent). The route itself stays reachable and explains.
   */
  audience?: 'parent';
  /**
   * Route patterns shown full screen, without the menu, the tab bar and the top bar
   * (the reader's reading view): the screen brings its own way back.
   */
  bare?: readonly string[];
}

export const FEATURES: readonly FeatureDef[] = [
  {
    id: 'today',
    labelKey: 'nav.today',
    icon: House,
    paths: ['/today', '/today/activity'],
    nav: { section: 'plan', order: 10 },
    tab: 1,
    stage: '2',
    view: () => import('@/features/today/TodayPage'),
    // Today's own sources and its task card (always on Today since q-ui-2).
    preload: () => {
      preloadToday();
      preloadTasks();
    },
  },
  {
    id: 'tasks',
    labelKey: 'nav.tasks',
    icon: ListTodo,
    paths: ['/tasks', '/tasks/new'],
    nav: { section: 'plan', order: 20 },
    stage: '3a',
    view: () => import('@/features/tasks/TasksPage'),
  },
  {
    id: 'calendar',
    labelKey: 'nav.calendar',
    optional: 'calendar',
    icon: CalendarDays,
    paths: ['/calendar', '/calendar/week', '/calendar/day', '/calendar/categories', '/calendar/new'],
    nav: { section: 'plan', order: 25 },
    stage: 'c-1',
    view: () => import('@/features/calendar/CalendarModule'),
    views: ['/calendar', '/calendar/week', '/calendar/day', '/calendar/categories'],
  },
  {
    id: 'goals',
    labelKey: 'nav.goals',
    icon: Target,
    paths: ['/goals'],
    nav: { section: 'plan', order: 30 },
    stage: '3d',
    view: () => import('@/features/goals/GoalsPage'),
  },
  {
    id: 'chores',
    labelKey: 'nav.chores',
    optional: 'chores',
    icon: ClipboardCheck,
    paths: ['/chores', '/chores/new', '/chores/defs'],
    nav: { section: 'money', order: 10 },
    tab: 2,
    stage: '3b',
    view: () => import('@/features/chores/ChoresModule'),
    views: ['/chores', '/chores/defs'],
  },
  {
    id: 'money',
    labelKey: 'nav.money',
    optional: 'money',
    icon: Wallet,
    paths: ['/money', '/money/new', '/money/loans', '/money/settings'],
    nav: { section: 'money', order: 20 },
    tab: 3,
    stage: '3c',
    view: () => import('@/features/money/MoneyModule'),
    views: ['/money', '/money/loans', '/money/settings'],
  },
  {
    id: 'notes',
    labelKey: 'nav.notes',
    optional: 'notes',
    icon: NotebookPen,
    paths: ['/notes', '/notes/:id'],
    nav: { section: 'writing', order: 10 },
    stage: '3a',
    view: () => import('@/features/notes/NotesModule'),
  },
  {
    id: 'stats',
    labelKey: 'nav.stats',
    optional: 'stats',
    icon: ChartLine,
    paths: ['/stats', '/stats/history'],
    nav: { section: 'system', order: 30 },
    stage: '2',
    view: () => import('@/features/stats/StatsModule'),
    views: ['/stats', '/stats/history'],
  },
  {
    id: 'games',
    labelKey: 'nav.games',
    optional: 'games',
    icon: Gamepad2,
    paths: ['/games', '/games/:id'],
    nav: { section: 'fun', order: 10 },
    stage: 'g',
    view: () => import('@/features/games/GamesModule'),
  },
  {
    id: 'reader',
    labelKey: 'nav.reader',
    optional: 'reader',
    icon: BookOpen,
    paths: ['/reader', '/reader/:id'],
    nav: { section: 'writing', order: 20 },
    stage: 'r',
    view: () => import('@/features/reader/ReaderModule'),
    bare: ['/reader/:id'],
  },
  {
    id: 'reports',
    labelKey: 'nav.reports',
    icon: Megaphone,
    paths: ['/reports', '/reports/broadcasts', '/reports/updates'],
    nav: { section: 'system', order: 20 },
    stage: '4',
    view: () => import('@/features/reports/ReportsModule'),
    views: ['/reports', '/reports/broadcasts', '/reports/updates'],
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    paths: ['/settings/:section?'],
    nav: { section: 'system', order: 40 },
    stage: '4',
    view: () => import('@/features/settings/SettingsModule'),
  },
  {
    id: 'exus',
    labelKey: 'nav.exus',
    optional: 'aichat',
    icon: Sparkles,
    paths: ['/exus'],
    nav: null,
    stage: '5',
    view: () => import('@/features/exus/ExusPage'),
  },
  {
    id: 'parent',
    labelKey: 'nav.parent',
    icon: Users,
    paths: ['/parent'],
    nav: { section: 'system', order: 10 },
    stage: '6',
    audience: 'parent',
    view: () => import('@/features/parent/ParentPage'),
  },
  // Not in the menu: a preview of the ui/ components in every theme.
  {
    id: 'gallery',
    labelKey: 'nav.gallery',
    icon: Palette,
    paths: ['/ui'],
    nav: null,
    stage: '1c',
    view: () => import('@/features/gallery/GalleryPage'),
  },
];

export const DEFAULT_PATH = '/today';

/**
 * Where the menu and the tab bar take a module: its first path without route
 * params ("/settings/:section?" → "/settings"). The pattern itself is no address:
 * opened as one, ":section" read as a section name.
 */
export function featurePath(feature: FeatureDef): string {
  return '/' + feature.paths[0].split('/').filter((part) => part && !part.startsWith(':')).join('/');
}

export function featureHref(feature: FeatureDef): string {
  return `#${featurePath(feature)}`;
}

/** Everything on: what a list shows before the profile says otherwise. */
const ALL_ON: ModuleChoice = { enabledModules: null, disabledModules: null };

/** The module is there for this person (not turned off in Settings). */
export function featureOn(feature: FeatureDef, choice: ModuleChoice = ALL_ON): boolean {
  return feature.optional === undefined || isModuleOn(feature.optional, choice);
}

function listedFor(feature: FeatureDef, choice: ModuleChoice, parent: boolean): boolean {
  return feature.nav !== null && featureOn(feature, choice) && (feature.audience !== 'parent' || parent);
}

/** The modules a section lists for this person, in order. */
export function navItems(section: NavSection, choice: ModuleChoice = ALL_ON, parent = false): FeatureDef[] {
  return FEATURES.filter((f) => f.nav?.section === section && listedFor(f, choice, parent)).sort(
    (a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0),
  );
}

export interface NavGroup {
  section: NavSection;
  labelKey: `nav.sections.${NavSection}`;
  items: FeatureDef[];
}

/** The menu: its sections in order, each with what it lists; empty sections are left out. */
export function navSections(choice: ModuleChoice = ALL_ON, parent = false): NavGroup[] {
  return NAV_SECTIONS.map((section) => ({
    section,
    labelKey: `nav.sections.${section}` as const,
    items: navItems(section, choice, parent),
  })).filter((group) => group.items.length > 0);
}

/** How many modules the phone tab bar holds besides "+" and Menu (D10). */
const TAB_COUNT = 3;

/**
 * Modules in the phone tab bar, in order (D10). A tab whose module is off gives its
 * place to the next module of the menu that is on (in menu order, leaving out the
 * account and app section), so the bar stays full.
 */
export function tabItems(choice: ModuleChoice = ALL_ON): FeatureDef[] {
  const tabs = FEATURES.filter((f) => f.tab !== undefined && featureOn(f, choice)).sort(
    (a, b) => (a.tab ?? 0) - (b.tab ?? 0),
  );
  const next = NAV_SECTIONS.filter((section) => section !== 'system').flatMap((section) => navItems(section, choice));
  for (const f of next) {
    if (tabs.length >= TAB_COUNT) break;
    if (!tabs.includes(f)) tabs.push(f);
  }
  return tabs;
}

export interface ResolvedRoute {
  feature: FeatureDef;
  params: RouteParams;
  /** The pattern of feature.paths that matched. */
  pattern: string;
}

/** The route is shown full screen, outside the app shell (FeatureDef.bare). */
export function isBareRoute(route: ResolvedRoute): boolean {
  return route.feature.bare?.includes(route.pattern) ?? false;
}

/** Two paths that are views of the same screen (FeatureDef.views), so not a new screen. */
export function isViewSwitch(from: string | null, to: string): boolean {
  if (from === null || from === to) return false;
  return FEATURES.some((f) => f.views?.includes(from) && f.views.includes(to));
}

export function resolveRoute(path: string): ResolvedRoute | null {
  for (const feature of FEATURES) {
    for (const pattern of feature.paths) {
      const params = matchPath(pattern, path);
      if (params) return { feature, params, pattern };
    }
  }
  return null;
}

/**
 * Starts downloading a screen's chunk (and what it imports) before it is shown, e.g.
 * the first screen while the profile loads (docs/v2/PERF.md). LazyView then finds the
 * module loaded; a failure is left to LazyView's own retry.
 */
export function preloadRoute(path: string): void {
  const route = resolveRoute(path) ?? resolveRoute(DEFAULT_PATH);
  route?.feature.view?.().catch(() => undefined);
  route?.feature.preload?.();
}

/**
 * The screens one tap away on a phone (the tab bar, D10): fetched when the browser is
 * idle after the first screen, so the first switch to them does not wait for the network.
 */
export function preloadTabs(choice: ModuleChoice): void {
  // A chunk that fails to load reloads the page (app/pwa.ts reloadOnStaleChunk): not for a mere prefetch.
  if (!navigator.onLine) return;
  for (const feature of tabItems(choice)) feature.view?.().catch(() => undefined);
}
