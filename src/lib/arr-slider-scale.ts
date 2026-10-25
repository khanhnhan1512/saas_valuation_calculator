// Logarithmic slider between $250K and $50M, mapped to integer steps 0..SLIDER_STEPS.
import { SLIDER_MAX, SLIDER_MIN, SLIDER_STEPS } from '@/config/valuation-config';

const LN_MIN = Math.log(SLIDER_MIN);
const LN_MAX = Math.log(SLIDER_MAX);

/** Rounds slider values to friendly amounts so dragging never shows $4,013,877. */
function snap(value: number): number {
  const step = value < 1_000_000 ? 10_000 : value < 10_000_000 ? 50_000 : 250_000;
  return Math.round(value / step) * step;
}

export function sliderToArr(position: number): number {
  const t = Math.min(Math.max(position, 0), SLIDER_STEPS) / SLIDER_STEPS;
  const value = snap(Math.exp(LN_MIN + t * (LN_MAX - LN_MIN)));
  return Math.min(Math.max(value, SLIDER_MIN), SLIDER_MAX);
}

export function arrToSlider(arr: number): number {
  const clamped = Math.min(Math.max(arr, SLIDER_MIN), SLIDER_MAX);
  return Math.round((SLIDER_STEPS * (Math.log(clamped) - LN_MIN)) / (LN_MAX - LN_MIN));
}
