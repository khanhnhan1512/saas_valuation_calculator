'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { IDLE_RESET_MS } from '@/config/valuation-config';
import { useCalculatorState } from '@/hooks/use-calculator-state';
import { useIdleReset } from '@/hooks/use-idle-reset';
import { useKioskParams } from '@/hooks/use-kiosk-params';
import { useKioskServiceWorker } from '@/hooks/use-kiosk-service-worker';
import { useLeadQueueSync } from '@/hooks/use-lead-queue';
import { enqueueLead } from '@/lib/lead-queue-storage';
import { flushQueue } from '@/lib/lead-queue-sync';
import { validateLead } from '@/lib/lead-validation';
import { createUuid } from '@/lib/uuid';
import { estimate, resolveSelection } from '@/lib/valuation';
import { ResultCard } from '@/components/result/result-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import layout from '@/components/layout/page-layout.module.css';
import { ArrStepCard } from './arr-step-card';
import { LeadFormCard } from './lead-form-card';

const STACKED_QUERY = '(max-width: 879.98px)';

export function CalculatorApp({ aspenCard }: { aspenCard: ReactNode }) {
  const [state, dispatch] = useCalculatorState();
  const [submitCount, setSubmitCount] = useState(0);
  const { source, kiosk } = useKioskParams();
  const { values, error, result, formKey } = state;
  useLeadQueueSync();
  useKioskServiceWorker(kiosk);

  const submit = (honeypot: string) => {
    const message = validateLead(values);
    if (message) return dispatch({ type: 'fail', message });
    const selection = resolveSelection(values.selection)!;
    dispatch({ type: 'unlock', result: estimate(values.arr!, selection.category, selection.industry) });
    // Write-ahead: the lead is stored on the device first, then sent; the result never waits on the network.
    enqueueLead({ ...values, id: createUuid(), submittedAt: new Date().toISOString(), source, websiteUrl: honeypot });
    setSubmitCount((n) => n + 1);
    void flushQueue();
    // Stacked layout (phones): the result sits below the form, so bring it into view.
    if (window.matchMedia(STACKED_QUERY).matches) {
      requestAnimationFrame(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }));
    }
  };

  const reset = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    dispatch({ type: 'reset' });
    window.scrollTo(0, 0);
  }, [dispatch]);

  useIdleReset(kiosk && result != null, IDLE_RESET_MS, reset);

  return (
    <div className={layout.page}>
      <SiteHeader />
      <main className={layout.columns}>
        <div className={`${layout.column} ${layout.leftColumn}`} key={formKey}>
          <ArrStepCard
            arr={values.arr}
            selection={values.selection}
            disabled={result != null}
            onArrChange={(arr) => dispatch({ type: 'setArr', arr })}
            onSelectionChange={(selection) => dispatch({ type: 'setSelection', selection })}
          />
          <LeadFormCard
            values={values}
            error={error}
            submitted={result != null}
            onText={(field, value) => dispatch({ type: 'setText', field, value })}
            onNextMove={(nextMove) => dispatch({ type: 'setNextMove', nextMove })}
            onSubmit={submit}
          />
        </div>
        <div className={`${layout.column} ${layout.rightColumn}`}>
          <ResultCard result={result} onReset={reset} />
          {aspenCard}
        </div>
      </main>
      <SiteFooter kiosk={kiosk} submitCount={submitCount} />
    </div>
  );
}
