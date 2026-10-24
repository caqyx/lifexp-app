// One pipeline for every Ex-us command (docs/v2/PLAN.md 6.6): the risk policy
// (domain/exus/policy) decides, the handler (handlers.ts) runs, and what it
// returns is turned into the reply, the failure toast and the undo entry. The
// write does not wait for the server: the reply comes at once and a rejected
// save shows a toast. A write with undo goes on this session's stack and on the
// toast "Cofnij"; both reach the same entry, so it is undone once.
import type { CommandSpec } from '@/domain/exus/commands';
import { t } from '@/i18n';
import { dismissToast, showToast } from '@/ui/toast';
import { HANDLERS, type HandlerContext } from './handlers';

/** Runs the command; resolves to the reply. `say` answers later, when the toast "Cofnij" is pressed. */
export async function runCommand(
  spec: CommandSpec,
  args: Record<string, unknown>,
  ctx: HandlerContext,
  say: (text: string) => void,
): Promise<string> {
  const { reply, write, undo } = await HANDLERS[spec.id].run(args, ctx);
  if (write) {
    write.saved.catch(() => showToast({ message: write.failed, tone: 'negative' }));
  }
  if (undo) {
    let toastId = 0;
    const entry = ctx.undo.push({
      what: undo.what,
      // Undone with /cofnij: the toast's "Cofnij" would do nothing now, so it goes.
      run: () => {
        dismissToast(toastId);
        return undo.run();
      },
    });
    toastId = showToast({
      message: write?.toast ?? t('exus.saved'),
      tone: 'positive',
      action: {
        label: t('ui.undo'),
        onAction: () => {
          const taken = ctx.undo.take(entry.id);
          if (!taken) return;
          say(t('exus.undoneWhat', { what: taken.what }));
          taken.run().catch(() => showToast({ message: t('exus.undoFailed'), tone: 'negative' }));
        },
      },
    });
  } else if (write?.toast) {
    showToast({ message: write.toast, tone: 'positive' });
  }
  return reply;
}

/** The confirmation's text for a destructive command: its effect, or what the command is. */
export function effectOf(spec: CommandSpec, args: Record<string, unknown>, ctx: HandlerContext): string {
  return HANDLERS[spec.id].effect?.(args, ctx) ?? t(`exus.commands.${spec.id}`);
}
