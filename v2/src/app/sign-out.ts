// Logging out ends the session in v1 too: both share one Firebase Auth session.
// The auth service is imported on demand, so Firebase stays out of the first-paint bundle.
import { t } from '@/i18n';
import { clearChatHistory } from '@/offline/chatHistory';
import { showToast } from '@/ui/toast';

export function signOut(): void {
  // The Ex-us conversation stays on this device only while someone is signed in (PLAN.md 6.10).
  clearChatHistory()
    .then(() => import('@/services/auth'))
    .then((auth) => auth.logout())
    .catch(() => showToast({ message: t('auth.errors.signOutFailed'), tone: 'negative' }));
}
