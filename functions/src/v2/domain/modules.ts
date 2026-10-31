// GENERATED from v2/src/domain/modules.ts by `npm run gen:shared-domain --prefix v2`. Do not edit here:
// change v2/src/domain/modules.ts and regenerate (a v2 test fails while this copy is stale).
// Which modules the person uses (v1 MODULE_REGISTRY and users.enabledModules;
// docs/v2/PLAN.md 5.4 M3, 2.3 B9). A module turned off disappears from the menu,
// the tab bar, "+" and Today; its data stays and comes back when it is turned on.

/**
 * Modules that can be turned off, under v1's ids; 'aichat' (v1's chat) is Ex-us in
 * v2. Today, Tasks, Goals and Settings are always there.
 */
export const OPTIONAL_MODULES = ['chores', 'money', 'notes', 'stats', 'games', 'aichat', 'reader'] as const;
export type OptionalModule = (typeof OPTIONAL_MODULES)[number];

/**
 * Modules that are off until the person turns them on (the book reader). They live
 * in their own field, optInModules, so v1's enabledModules never sees an id it does
 * not know, and an account that never chose has them off.
 */
export const OPT_IN_MODULES = ['reader'] as const satisfies readonly OptionalModule[];

/** The modules on by default: the first-run survey offers these, and disabledModules lists the ones turned off. */
export const DEFAULT_ON_MODULES = OPTIONAL_MODULES.filter((m) => !isOptIn(m));

/** v1's modules, in v1's order: v1 reads only enabledModules, so for these it stays the truth while v1 is in use. */
const V1_MODULES = ['chores', 'money', 'games', 'stats', 'notes', 'aichat'] as const;

export interface ModuleChoice {
  /** v1's list of modules turned on; null = never chosen (everything on, as in v1). */
  enabledModules: readonly string[] | null;
  /** M3: modules turned off, written by v2 next to enabledModules; null = not written yet. */
  disabledModules: readonly string[] | null;
  /** Opt-in modules turned on (v2 only); absent or null = none. */
  optInModules?: readonly string[] | null;
}

function isOptIn(id: string): boolean {
  return (OPT_IN_MODULES as readonly string[]).includes(id);
}

function isV1Module(id: string): boolean {
  return (V1_MODULES as readonly string[]).includes(id);
}

export function isModuleOn(id: string, { enabledModules, disabledModules, optInModules }: ModuleChoice): boolean {
  if (isOptIn(id)) return (optInModules ?? []).includes(id);
  if (isV1Module(id)) {
    if (enabledModules === null) return true;
    // B9: the survey before 24.08 offered the Planner, which Notes replaced; an
    // account that chose the Planner then has Notes, not a hidden notebook.
    if (id === 'notes' && enabledModules.includes('planner')) return true;
    return enabledModules.includes(id);
  }
  // Other modules v1 does not know: on unless turned off, so a new module is on.
  return !(disabledModules ?? []).includes(id);
}

/**
 * The profile fields after turning one module on or off: enabledModules for v1 (the
 * Planner, gone from v1, is dropped, its Notes kept) and the whole list of what is
 * off as disabledModules (M3), which takes over once v1 is retired; the opt-in
 * modules that are on as optInModules.
 */
export function toggleModule(
  choice: ModuleChoice,
  id: OptionalModule,
  on: boolean,
): { enabledModules: string[]; disabledModules: string[]; optInModules: string[] } {
  const after = (m: string) => (m === id ? on : isModuleOn(m, choice));
  return {
    enabledModules: V1_MODULES.filter(after),
    disabledModules: DEFAULT_ON_MODULES.filter((m) => !after(m)),
    optInModules: OPT_IN_MODULES.filter(after),
  };
}

/**
 * v1 saveOnboarding(): the first-run survey, everything ticked unless the person
 * unticked it. It offers only the modules on by default; opt-in ones wait for Settings.
 */
export function surveyModules(on: readonly OptionalModule[]): { enabledModules: string[]; disabledModules: string[] } {
  return {
    enabledModules: V1_MODULES.filter((m) => on.includes(m)),
    disabledModules: DEFAULT_ON_MODULES.filter((m) => !on.includes(m)),
  };
}
