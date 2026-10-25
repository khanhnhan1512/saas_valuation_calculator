// Re-formats a text input while keeping the caret after the same number of digits,
// so typing in the middle of "(647) 451-5164" or "4,000,000" does not jump to the end.

function caretAfterDigits(text: string, digitCount: number): number {
  if (digitCount === 0) return text.startsWith('(') && text.length > 0 ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) seen += 1;
    if (seen === digitCount) return i + 1;
  }
  return text.length;
}

export function applyFormatted(input: HTMLInputElement, formatted: string, rawBeforeCaret: string) {
  const digitsBefore = rawBeforeCaret.replace(/\D/g, '').length;
  const pos = caretAfterDigits(formatted, digitsBefore);
  // Only move the caret while the field is focused (iOS scrolls to inputs on setSelectionRange).
  if (document.activeElement !== input) return;
  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      // Some input types (email) do not support selection ranges.
    }
  });
}
