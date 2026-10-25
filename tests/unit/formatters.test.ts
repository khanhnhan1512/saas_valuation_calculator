import { describe, expect, it } from 'vitest';
import { formatArrInput, formatMoney, parseArrDigits } from '@/lib/formatters';
import { arrToSlider, sliderToArr } from '@/lib/arr-slider-scale';

describe('formatMoney', () => {
  it.each([
    [750_000, '$750K'],
    [9_157_500, '$9.2M'],
    [1_240_000_000, '$1.24B'],
    [999_499, '$999K'],
    [999_500, '$1.0M'],
    [999_949_999, '$999.9M'],
    [999_950_000, '$1.00B'],
    [250_000, '$250K'],
    [50_000_000, '$50.0M'],
    [500, '$500'],
  ])('%i -> %s', (value, text) => expect(formatMoney(value)).toBe(text));
});

describe('ARR input', () => {
  it.each([
    ['5000000', 5_000_000],
    ['5,000,000', 5_000_000],
    ['$ 4,000,000', 4_000_000],
    ['abc', null],
    ['', null],
    ['0', null],
    ['000', null],
    ['007', 7],
    ['4.5', 4],
    ['$4,000,000.50', 4_000_000],
    ['6000000000', 5_000_000_000],
    ['99999999999999999999999', 5_000_000_000],
  ])('parseArrDigits(%j) -> %j', (text, value) => expect(parseArrDigits(text)).toBe(value));

  it('formats with thousands separators', () => {
    expect(formatArrInput(4_000_000)).toBe('4,000,000');
    expect(formatArrInput(null)).toBe('');
  });
});

describe('log slider', () => {
  it('ends map to $250K and $50M', () => {
    expect(sliderToArr(0)).toBe(250_000);
    expect(sliderToArr(1000)).toBe(50_000_000);
    expect(arrToSlider(100_000)).toBe(0);
    expect(arrToSlider(60_000_000)).toBe(1000);
  });

  it.each([1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000])(
    'round trips %i within the snap step',
    (arr) => {
      const back = sliderToArr(arrToSlider(arr));
      expect(Math.abs(back - arr) / arr).toBeLessThan(0.01);
    },
  );

  it('is monotonic', () => {
    let prev = 0;
    for (let p = 0; p <= 1000; p += 1) {
      const v = sliderToArr(p);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
