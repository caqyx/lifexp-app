// Ex-us AI state for this session (docs/v2/PLAN.md 6.9, 6.10): the budget bar and
// whether this account has AI at all. In memory only: a new session asks again.
import { signal } from '@preact/signals';
import type { AiUsage } from '@/domain/exus/ai';

/** The latest usage from exusTurn; null = no AI answer yet this session (the bar is hidden). */
export const aiUsage = signal<AiUsage | null>(null);

/** The account (uid) the server said has no AI access; its plain text is answered without a call. */
export const aiDeniedFor = signal<string | null>(null);
