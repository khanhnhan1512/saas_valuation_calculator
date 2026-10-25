import type { CSSProperties } from 'react';
import { COPY } from '@/config/site-copy';
import { formatAxisMultiple, formatMoney, formatMultiple } from '@/lib/formatters';
import { rangeAxis, type Estimate } from '@/lib/valuation';
import styles from './value-range-line.module.css';

/** Track with a teal band from low to high multiple and three markers (midpoint taller). */
export function ValueRangeLine({ result }: { result: Estimate }) {
  const axis = rangeAxis(result.rawLow, result.rawMid, result.rawHigh);
  const markers = [
    { key: 'low', pct: axis.lowPct, value: result.lowValue, label: COPY.markerLow, multiple: result.lowMultiple },
    { key: 'mid', pct: axis.midPct, value: result.midValue, label: COPY.markerMid, multiple: result.midMultiple },
    { key: 'high', pct: axis.highPct, value: result.highValue, label: COPY.markerHigh, multiple: result.highMultiple },
  ];

  return (
    <div className={styles.rangeLine}>
      <div className={styles.track}>
        <div
          className={styles.band}
          style={{ '--lo': `${axis.lowPct}%`, '--hi': `${axis.highPct}%` } as CSSProperties}
        />
        {markers.map((m) => (
          <span
            key={m.key}
            className={`${styles.tick} ${m.key === 'mid' ? styles.tickMid : ''}`}
            style={{ left: `${m.pct}%` }}
          />
        ))}
      </div>
      <div className={styles.rangeLabels}>
        <span className={styles.axisEnd}>{formatAxisMultiple(axis.min)}</span>
        {markers.map((m) => (
          <span
            key={m.key}
            className={`${styles.markerLabel} ${m.key === 'mid' ? styles.markerMid : ''}`}
            style={{ left: `${m.pct}%` }}
          >
            <strong>{formatMoney(m.value)}</strong>
            <span>
              {m.label} &middot; {formatMultiple(m.multiple)}
            </span>
          </span>
        ))}
        <span className={`${styles.axisEnd} ${styles.axisEndRight}`}>{formatAxisMultiple(axis.max)}</span>
      </div>
    </div>
  );
}
