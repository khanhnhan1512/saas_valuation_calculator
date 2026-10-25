'use client';

import { COPY } from '@/config/site-copy';
import { useFailedCount, useQueuedCount } from '@/hooks/use-lead-queue';
import { useStaffLeadCount } from '@/hooks/use-staff-lead-count';
import styles from './page-layout.module.css';

interface SiteFooterProps {
  /** Booth mode: show the queued count, and the export link to signed-in staff. */
  kiosk: boolean;
  /** Changes after each submit so the staff count refreshes. */
  submitCount: number;
}

export function SiteFooter({ kiosk, submitCount }: SiteFooterProps) {
  const queued = useQueuedCount();
  const failed = useFailedCount();
  const saved = useStaffLeadCount(kiosk, `${submitCount}:${queued}`);

  return (
    <footer className={styles.footer}>
      <p className={styles.finePrint}>{COPY.finePrint}</p>
      {kiosk && (saved != null || queued > 0 || failed > 0) && (
        <p className={styles.staffArea}>
          {/* Spec: the export link is shown only to a signed-in staff user (count endpoint answers). */}
          {saved != null && (
            <>
              <span>{COPY.staffLabel}</span>
              <a href="/staff">{COPY.exportLink}</a>
              <span>{COPY.savedCount(saved)}</span>
            </>
          )}
          {queued > 0 && <span className={styles.queued}>{COPY.queuedCount(queued)}</span>}
          {failed > 0 && <span className={styles.failed}>{COPY.failedCount(failed)}</span>}
        </p>
      )}
    </footer>
  );
}
