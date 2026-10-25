import { describe, expect, it } from 'vitest';
import { DROPDOWN_OPTIONS } from '@/config/valuation-config';
import { formatAxisMultiple, formatMoney, formatMultiple } from '@/lib/formatters';
import { estimate, rangeAxis, resolveSelection, sizeFactor } from '@/lib/valuation';

// Expected numbers are written out from the spec tables, not read from config.
const SPEC_CATEGORIES: Array<[string, number]> = [
  ['DevOps & IT Management', 5.3],
  ['ERP & Supply Chain', 4.6],
  ['Security', 4.4],
  ['Financial Applications', 3.4],
  ['Human Capital Management', 3.2],
  ['Analytics & Data Management', 2.5],
  ['Sales & Marketing', 2.4],
  ['Communications & Collaboration', 2.0],
  ['Other SaaS', 2.7],
];
const SPEC_INDUSTRIES: Array<[string, number]> = [
  ['Healthcare', 0.1],
  ['Financial Services', 0.1],
  ['Real Estate', 0],
  ['Government', 0],
  ['Retail', 0],
  ['Energy', 0],
  ['Life Sciences', 0],
  ['Education', -0.1],
  ['Hospitality', -0.1],
  ['Manufacturing', -0.1],
  ['Other industry', -0.1],
];

function run(label: string, arr: number) {
  const sel = resolveSelection(label)!;
  return estimate(arr, sel.category, sel.industry);
}

describe('worked examples (acceptance)', () => {
  it('Healthcare, $4M ARR', () => {
    const r = run('Healthcare', 4_000_000);
    expect([r.lowMultiple, r.midMultiple, r.highMultiple]).toEqual([1.95, 2.29, 2.63]);
    expect([r.lowValue, r.midValue, r.highValue]).toEqual([7_783_875, 9_157_500, 10_531_125]);
    expect([r.lowValue, r.midValue, r.highValue].map(formatMoney)).toEqual(['$7.8M', '$9.2M', '$10.5M']);
    expect(formatMultiple(r.midMultiple)).toBe('2.29x');
  });

  it('Sales & Marketing, $4M ARR', () => {
    const r = run('Sales & Marketing', 4_000_000);
    expect(r.midMultiple).toBe(1.35);
    expect([r.lowMultiple, r.highMultiple]).toEqual([1.15, 1.55]);
    expect([r.lowValue, r.midValue, r.highValue]).toEqual([4_590_000, 5_400_000, 6_210_000]);
    expect([r.lowValue, r.midValue, r.highValue].map(formatMoney)).toEqual(['$4.6M', '$5.4M', '$6.2M']);
  });
});

describe('size factor bands use "to under"', () => {
  it.each([
    [250_000, 0.65],
    [999_999, 0.65],
    [1_000_000, 0.7],
    [2_999_999, 0.7],
    [3_000_000, 0.75],
    [6_999_999, 0.75],
    [7_000_000, 0.8],
    [14_999_999, 0.8],
    [15_000_000, 0.85],
    [5_000_000_000, 0.85],
  ])('%i -> %f', (arr, factor) => expect(sizeFactor(arr)).toBe(factor));

  it('$3,000,000 uses 0.75 and $2,999,999 uses 0.70 in the estimate', () => {
    expect(run('Other SaaS', 3_000_000).rawMid).toBeCloseTo(2.7 * 0.75 * 0.75, 12);
    expect(run('Other SaaS', 2_999_999).rawMid).toBeCloseTo(2.7 * 0.75 * 0.7, 12);
  });
});

describe('every dropdown option', () => {
  it.each(SPEC_INDUSTRIES)('industry %s uses 3.7x with tier adjustment %f', (label, adj) => {
    const sel = resolveSelection(label)!;
    expect(sel).toEqual({ category: 'Industry-specific', industry: label });
    expect(run(label, 4_000_000).rawMid).toBeCloseTo(3.7 * 0.75 * 0.75 * (1 + adj), 12);
  });

  it.each(SPEC_CATEGORIES)('category %s uses %f with no adjustment', (label, multiple) => {
    expect(resolveSelection(label)).toEqual({ category: label, industry: null });
    expect(run(label, 4_000_000).rawMid).toBeCloseTo(multiple * 0.75 * 0.75, 12);
  });

  it('a software category ignores any industry passed in', () => {
    const r = estimate(4_000_000, 'Security', 'Healthcare');
    expect(r.rawMid).toBeCloseTo(4.4 * 0.75 * 0.75, 12);
  });

  it('lists 11 industries then 9 categories in spec order', () => {
    expect(DROPDOWN_OPTIONS).toHaveLength(20);
    expect(DROPDOWN_OPTIONS.slice(0, 11)).toEqual(SPEC_INDUSTRIES.map(([l]) => l));
    expect(DROPDOWN_OPTIONS[11]).toBe('DevOps & IT Management');
    expect(DROPDOWN_OPTIONS[12]).toBe('ERP & Supply Chain');
  });

  it('rejects unknown labels', () => {
    expect(resolveSelection('')).toBeNull();
    expect(resolveSelection('Industry-specific')).toBeNull();
    expect(resolveSelection('toString')).toBeNull();
  });
});

describe('low and high are 15% either side of the midpoint', () => {
  it('values come from the unrounded multiple', () => {
    const r = run('Healthcare', 4_000_000);
    expect(r.lowValue).toBe(Math.round(r.rawMid * 0.85 * 4_000_000));
    expect(r.lowValue).not.toBe(Math.round(r.lowMultiple * 4_000_000));
  });
});

describe('range line axis', () => {
  it('Healthcare $4M axis is 1.6x to 2.9x with fixed marker positions', () => {
    const r = run('Healthcare', 4_000_000);
    const axis = rangeAxis(r.rawLow, r.rawMid, r.rawHigh);
    expect(formatAxisMultiple(axis.min)).toBe('1.6x');
    expect(formatAxisMultiple(axis.max)).toBe('2.9x');
    expect(axis.lowPct).toBeCloseTo(23.68, 2);
    expect(axis.midPct).toBeCloseTo(50, 6);
    expect(axis.highPct).toBeCloseTo(76.32, 2);
  });

  it('never goes below 0', () => {
    expect(rangeAxis(0.1, 0.5, 2).min).toBe(0);
  });
});
