'use client';

import type { ChangeEvent, CSSProperties } from 'react';
import { COPY } from '@/config/site-copy';
import {
  ARR_CHIPS,
  DROPDOWN_OPTIONS,
  SLIDER_MAX,
  SLIDER_MIN,
  SLIDER_STEPS,
} from '@/config/valuation-config';
import { arrToSlider, sliderToArr } from '@/lib/arr-slider-scale';
import { applyFormatted } from '@/lib/caret-format';
import { formatArrInput, formatMoney, formatShortMoney, parseArrDigits } from '@/lib/formatters';
import styles from './form-controls.module.css';
import arrStyles from './arr-step-card.module.css';

interface ArrStepCardProps {
  arr: number | null;
  selection: string;
  disabled: boolean;
  onArrChange: (arr: number | null) => void;
  onSelectionChange: (selection: string) => void;
}

const SLIDER_IDLE_POSITION = SLIDER_STEPS / 2;

export function ArrStepCard({ arr, selection, disabled, onArrChange, onSelectionChange }: ArrStepCardProps) {
  const onArrInput = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const next = parseArrDigits(input.value);
    applyFormatted(input, formatArrInput(next), input.value.slice(0, input.selectionStart ?? 0));
    onArrChange(next);
  };

  const sliderPosition = arr == null ? SLIDER_IDLE_POSITION : arrToSlider(arr);
  const fill = `${(sliderPosition / SLIDER_STEPS) * 100}%`;

  return (
    <section className={styles.card} aria-labelledby="step1-heading" data-card>
      <div className={styles.stepHeader}>
        <span className={styles.stepBadge} aria-hidden="true">1</span>
        <h2 id="step1-heading" className={styles.stepHeading}>
          {COPY.step1Heading}
        </h2>
      </div>

      <div className={arrStyles.arrField}>
        <span className={arrStyles.dollar} aria-hidden="true">$</span>
        <input
          id="arr"
          name="f-arr"
          className={arrStyles.arrInput}
          type="text"
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={COPY.arrLabel}
          placeholder={COPY.arrPlaceholder}
          value={formatArrInput(arr)}
          onChange={onArrInput}
          disabled={disabled}
        />
      </div>

      <input
        className={arrStyles.slider}
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={sliderPosition}
        style={{ '--fill': fill } as CSSProperties}
        aria-label={COPY.sliderLabel}
        aria-valuetext={arr == null ? undefined : formatMoney(arr)}
        onChange={(e) => onArrChange(sliderToArr(Number(e.target.value)))}
        disabled={disabled}
      />
      <div className={arrStyles.sliderEnds} aria-hidden="true">
        <span>{formatShortMoney(SLIDER_MIN)}</span>
        <span>{formatShortMoney(SLIDER_MAX)}</span>
      </div>

      <div className={`${styles.chips} ${arrStyles.quickPicks}`}>
        {ARR_CHIPS.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.chip}
            aria-pressed={arr === value}
            onClick={() => onArrChange(value)}
            disabled={disabled}
          >
            {formatShortMoney(value)}
          </button>
        ))}
      </div>

      <label className={styles.label} htmlFor="selection">
        {COPY.dropdownLabel} <span className={styles.required}>*</span>
      </label>
      <select
        id="selection"
        name="f-selection"
        className={styles.select}
        autoComplete="off"
        required
        value={selection}
        onChange={(e) => onSelectionChange(e.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          {COPY.dropdownPlaceholder}
        </option>
        {DROPDOWN_OPTIONS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </section>
  );
}
