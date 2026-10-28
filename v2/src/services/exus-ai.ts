// One Ex-us turn with the AI (docs/v2/PLAN.md 6.9): the request goes to exusTurn,
// and what it says about the budget and access is kept for the session
// (stores/exusAi). The backend writes no LifeXP data; actions come back as
// proposals for the chat to show.
import { AiError, type AiTurnRequest, type AiTurnResponse } from '@/domain/exus/ai';
import { aiDeniedFor, aiUsage } from '@/stores/exusAi';

export async function askExus(uid: string, request: AiTurnRequest): Promise<AiTurnResponse> {
  const online = navigator.onLine;
  let data: typeof import('@/data/functions');
  try {
    data = await import('@/data/functions');
  } catch {
    // The chunk could not load (offline on a first visit).
    throw new AiError(online ? 'unavailable' : 'network');
  }
  try {
    const response = await data.callExusTurn(request, online);
    aiUsage.value = response.usage;
    return response;
  } catch (error) {
    if (error instanceof AiError) {
      if (error.kind === 'no-access') aiDeniedFor.value = uid;
      if (error.kind === 'budget' && error.usage) aiUsage.value = error.usage;
      throw error;
    }
    throw new AiError('failed');
  }
}

/** The server said this account has no AI: the next message is answered without a call. */
export const aiDenied = (uid: string): boolean => aiDeniedFor.value === uid;
