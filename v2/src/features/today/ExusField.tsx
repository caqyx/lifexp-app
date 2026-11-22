// "Napisz do Ex-us albo wpisz /" on Today (docs/v2/PLAN.md 6.10): the text goes to
// the Ex-us screen, which sends it through the same engine as its own field. It is
// handed over in memory (stores/exusFocus), never through the URL or the history.
import { Send } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { t } from '@/i18n';
import type { Navigate } from '@/lib/route-match';
import { handOverToExus } from '@/stores/exusFocus';
import { Button } from '@/ui/components/Button';
import { TextField } from '@/ui/components/Fields';
import { Card } from '@/ui/components/Layout';

export function ExusField({ navigate }: { navigate: Navigate }) {
  const [text, setText] = useState('');
  return (
    <Card>
      <form
        class="today-exus"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const message = text.trim();
          if (!message) return;
          handOverToExus(message);
          setText('');
          navigate('/exus');
        }}
      >
        {/* The field across, then the hint with the send button beside it: two rows, not three. */}
        <TextField label={t('today.exus.label')} value={text} onInput={setText} placeholder={t('exus.placeholder')} autoComplete="off" />
        <p class="today-exus__hint">{t('today.exus.hint')}</p>
        <Button type="submit" variant="secondary" aria-label={t('today.exus.send')}>
          <Send aria-hidden="true" />
          {t('today.exus.sendShort')}
        </Button>
      </form>
    </Card>
  );
}
