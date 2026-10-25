'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { COPY } from '@/config/site-copy';
import { NEXT_MOVES, NEXT_MOVE_OTHER } from '@/config/valuation-config';
import type { TextField } from '@/hooks/use-calculator-state';
import { applyFormatted } from '@/lib/caret-format';
import type { LeadFormValues } from '@/lib/lead-validation';
import { formatPhoneInput } from '@/lib/phone-format';
import styles from './form-controls.module.css';
import formStyles from './lead-form-card.module.css';

interface LeadFormCardProps {
  values: LeadFormValues;
  error: string | null;
  submitted: boolean;
  onText: (field: TextField, value: string) => void;
  onNextMove: (nextMove: string) => void;
  onSubmit: (honeypot: string) => void;
}

// Non-semantic names plus autocomplete="off" keep browsers from offering the previous visitor's details.
const FIELDS: Array<{ field: TextField; label: string; type: string; extra?: object }> = [
  { field: 'firstName', label: COPY.firstName, type: 'text', extra: { autoCapitalize: 'words', maxLength: 100 } },
  { field: 'lastName', label: COPY.lastName, type: 'text', extra: { autoCapitalize: 'words', maxLength: 100 } },
  { field: 'company', label: COPY.company, type: 'text', extra: { autoCapitalize: 'words', maxLength: 200 } },
  { field: 'email', label: COPY.email, type: 'email', extra: { autoCapitalize: 'none', maxLength: 254 } },
  {
    field: 'phone',
    label: COPY.phone,
    type: 'tel',
    extra: { inputMode: 'tel', placeholder: COPY.phonePlaceholder, maxLength: 20 },
  },
];

export function LeadFormCard({ values, error, submitted, onText, onNextMove, onSubmit }: LeadFormCardProps) {
  const handleText = (field: TextField) => (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (field !== 'phone') return onText(field, input.value);
    const formatted = formatPhoneInput(input.value);
    applyFormatted(input, formatted, input.value.slice(0, input.selectionStart ?? 0));
    onText('phone', formatted);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trap = new FormData(e.currentTarget).get('website_url');
    onSubmit(typeof trap === 'string' ? trap : '');
  };

  return (
    <form
      className={`${styles.card} ${formStyles.card}`}
      aria-labelledby="step2-heading"
      autoComplete="off"
      // POST, never GET: if scripts ever fail to load, details must not end up in the URL.
      method="post"
      noValidate
      onSubmit={handleSubmit}
      data-card
    >
      <div className={styles.stepHeader}>
        <span className={styles.stepBadge} aria-hidden="true">2</span>
        <h2 id="step2-heading" className={styles.stepHeading}>
          {COPY.step2Heading}
        </h2>
        <span className={styles.stepHint}>{COPY.step2Hint}</span>
      </div>

      <fieldset className={formStyles.fieldset} disabled={submitted}>
        <div className={formStyles.fieldGrid}>
          {FIELDS.map(({ field, label, type, extra }) => (
            <div key={field} className={formStyles[field]}>
              <label className={styles.label} htmlFor={`lead-${field}`}>
                {label} <span className={styles.required}>*</span>
              </label>
              <input
                id={`lead-${field}`}
                name={`f-${field}`}
                className={styles.input}
                type={type}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={values[field]}
                onChange={handleText(field)}
                {...extra}
              />
            </div>
          ))}
        </div>

        <p id="next-move-label" className={styles.label}>
          {COPY.nextMoveLabel} <span className={styles.required}>*</span>
        </p>
        <div className={`${styles.chips} ${formStyles.nextMoves}`} role="group" aria-labelledby="next-move-label">
          {NEXT_MOVES.map((move) => (
            <button
              key={move}
              type="button"
              className={styles.chip}
              aria-pressed={values.nextMove === move}
              onClick={() => onNextMove(move)}
            >
              {move}
            </button>
          ))}
          {values.nextMove === NEXT_MOVE_OTHER && (
            <input
              className={`${styles.input} ${formStyles.otherInput}`}
              name="f-other"
              type="text"
              autoComplete="off"
              autoFocus
              maxLength={100}
              aria-label={COPY.nextMoveOtherLabel}
              placeholder={COPY.nextMoveOtherPlaceholder}
              value={values.nextMoveOther}
              onChange={handleText('nextMoveOther')}
            />
          )}
        </div>

        {/* Bot trap: hidden from people and assistive tech, bots tend to fill it. */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="website_url">Website</label>
          <input id="website_url" name="website_url" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </fieldset>

      <button type="submit" className={styles.button} disabled={submitted}>
        {submitted ? COPY.buttonDone : COPY.button}
      </button>
      <p className={styles.error} role="alert">
        {error}
      </p>
    </form>
  );
}
