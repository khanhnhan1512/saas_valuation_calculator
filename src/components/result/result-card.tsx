import { COPY } from '@/config/site-copy';
import { formatMoney, formatMultiple } from '@/lib/formatters';
import { estimate, type Estimate } from '@/lib/valuation';
import styles from './result-card.module.css';
import { ValueRangeLine } from './value-range-line';

// Fixed sample shown blurred while locked, so the visitor's real numbers are never in the DOM early.
const SAMPLE = estimate(5_000_000, 'Other SaaS', null);

interface ResultCardProps {
  result: Estimate | null;
  onReset: () => void;
}

export function ResultCard({ result, onReset }: ResultCardProps) {
  const shown = result ?? SAMPLE;
  const low = formatMoney(shown.lowValue);
  const high = formatMoney(shown.highValue);
  const lowM = formatMultiple(shown.lowMultiple);
  const highM = formatMultiple(shown.highMultiple);

  return (
    <section id="result" className={styles.card} aria-label={COPY.resultKicker} data-card>
      <div
        className={`${styles.content} ${result ? '' : styles.blurred}`}
        aria-hidden={!result}
        inert={!result}
      >
        <p className={styles.kicker}>{COPY.resultKicker}</p>
        <p className={styles.headline}>
          {low} <span className={styles.joiner}>{COPY.rangeJoiner}</span> {high}
        </p>
        <p className={styles.basis}>{COPY.basisLine(lowM, highM)}</p>
        <ValueRangeLine result={shown} />
        <p className={styles.tilesHeading}>{COPY.tilesHeading}</p>
        <ul className={styles.tiles}>
          {COPY.tiles.map((tile) => (
            <li key={tile.big} className={styles.tile}>
              <strong>{tile.big}</strong>
              <span>{tile.small}</span>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.resetButton} onClick={onReset}>
          {COPY.resetButton} <span aria-hidden="true">&#8635;</span>
        </button>
      </div>

      {!result && (
        <div className={styles.lockOverlay}>
          <span className={styles.lockIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <p className={styles.lockTitle}>{COPY.lockedTitle}</p>
          <p className={styles.lockHint}>{COPY.lockedHint}</p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {result ? COPY.liveResult(low, high, lowM, highM) : ''}
      </p>
    </section>
  );
}
