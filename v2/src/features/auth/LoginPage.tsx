// Login (docs/v2/PLAN.md 9.1, stage 1e): e-mail+password and Google, into the
// same accounts as v1. Creating an account stays in v1, which writes the profile.
// Loaded as its own chunk: only signed-out visitors need it.
import { useState } from 'preact/hooks';
import { language, t } from '@/i18n';
import type { AuthErrorKey } from '@/services/auth-errors';
import { login, loginWithGoogle, requestPasswordReset, type AuthResult } from '@/services/auth';
import { Button } from '@/ui/components/Button';
import { TextField } from '@/ui/components/Fields';
import './auth.css';

type Pending = 'email' | 'google' | 'reset' | null;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  /** The address a reset link went to (shown until the next attempt). */
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<AuthResult>) => {
    setPending(kind);
    setError(null);
    setResetSentTo(null);
    const result = await action();
    // On success the session changes and the app replaces this screen.
    if (!result.ok) {
      setError(result.error);
      setPending(null);
    }
  };

  /** "Nie pamiętam hasła": a link to the address in the field; the screen stays. */
  const reset = async () => {
    const address = email.trim();
    setPending('reset');
    setError(null);
    setResetSentTo(null);
    const result = await requestPasswordReset(address, language.value);
    setPending(null);
    if (result.ok) setResetSentTo(address);
    else setError(result.error);
  };

  return (
    <main class="auth">
      <div class="auth__panel">
        <p class="auth__wordmark">{t('app.name')}</p>
        <h1 class="auth__title">{t('auth.title')}</h1>
        <p class="auth__intro">{t('auth.intro')}</p>

        <form
          class="auth__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) void run('email', () => login(email, password));
          }}
        >
          <TextField label={t('auth.email')} type="email" autoComplete="email" value={email} onInput={setEmail} />
          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onInput={setPassword}
          />
          <button
            type="button"
            class="auth__forgot"
            aria-busy={pending === 'reset' || undefined}
            disabled={pending !== null}
            onClick={() => void reset()}
          >
            {t('auth.forgot')}
          </button>
          {error && (
            <p class="auth__error" role="alert">
              {t(error)}
            </p>
          )}
          {resetSentTo && (
            <p class="auth__note" role="status">
              {t('auth.resetSent', { email: resetSentTo })}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block busy={pending === 'email'} disabled={pending !== null}>
            {t('auth.submit')}
          </Button>
        </form>

        <p class="auth__or">{t('auth.or')}</p>
        <Button
          size="lg"
          block
          busy={pending === 'google'}
          disabled={pending !== null}
          onClick={() => void run('google', loginWithGoogle)}
        >
          {t('auth.google')}
        </Button>

        <p class="auth__footer">
          {t('auth.noAccount')} <a href="../index.html">{t('auth.register')}</a>
        </p>
      </div>
    </main>
  );
}
