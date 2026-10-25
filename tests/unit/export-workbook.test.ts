import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildLeadsWorkbook, exportFileName, toTorontoWallClock } from '@/lib/export-workbook';
import { parseLeadFilters } from '@/lib/export-filters';
import type { ExportRow } from '@/lib/leads-repository';

const ROWS: ExportRow[] = [
  {
    submittedAt: new Date('2026-11-04T15:30:00Z'),
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@northwind.io',
    phone: '(647) 451-5164',
    company: 'Northwind Health',
    nextMove: 'Selling the business',
    arr: 4_000_000,
    category: 'Industry-specific',
    industry: 'Healthcare',
    midMultiple: 2.29,
    lowValue: 7_783_875,
    midValue: 9_157_500,
    highValue: 10_531_125,
  },
  {
    submittedAt: new Date('2026-11-04T18:05:00Z'),
    firstName: 'Sam',
    lastName: 'Lee',
    email: 'sam@acme.io',
    phone: '(416) 555-0101',
    company: 'Acme',
    nextMove: 'Other: IPO prep',
    arr: 4_000_000,
    category: 'Sales & Marketing',
    industry: null,
    midMultiple: 1.35,
    lowValue: 4_590_000,
    midValue: 5_400_000,
    highValue: 6_210_000,
  },
];

async function readBack(rows: ExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const bytes = await buildLeadsWorkbook(rows);
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  return workbook;
}

describe('Excel export', () => {
  it('has the sheet, headers and formats from the spec', async () => {
    const wb = await readBack(ROWS);
    const sheet = wb.getWorksheet('SaaS North Leads')!;
    expect(sheet).toBeDefined();
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
      'Submitted', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Next Move', 'ARR Entered',
      'Software Category', 'Industry', 'Midpoint Multiple', 'Low Value', 'Midpoint Value', 'High Value',
    ]);
    const row = sheet.getRow(2);
    expect(row.getCell(8).value).toBe(4_000_000);
    expect(row.getCell(8).numFmt).toBe('$#,##0');
    expect(row.getCell(11).value).toBe(2.29);
    expect(row.getCell(11).numFmt).toBe('0.00"x"');
    for (const col of [12, 13, 14]) expect(row.getCell(col).numFmt).toBe('$#,##0');
    expect(row.getCell(12).value).toBe(7_783_875);
    expect(row.getCell(1).numFmt).toBe('yyyy-mm-dd hh:mm');
  });

  it('writes rows in the given (oldest first) order with Toronto local time', async () => {
    const sheet = (await readBack(ROWS)).getWorksheet('SaaS North Leads')!;
    expect(sheet.rowCount).toBe(3);
    // 15:30 UTC on Nov 4 2026 = 10:30 in Toronto (EST).
    expect((sheet.getRow(2).getCell(1).value as Date).toISOString()).toBe('2026-11-04T10:30:00.000Z');
    expect(sheet.getRow(3).getCell(2).value).toBe('Sam');
    expect(sheet.getRow(3).getCell(10).value).toBeNull();
    expect(sheet.getRow(3).getCell(7).value).toBe('Other: IPO prep');
  });

  it('exports an empty sheet with headers when there are no leads', async () => {
    const sheet = (await readBack([])).getWorksheet('SaaS North Leads')!;
    expect(sheet.rowCount).toBe(1);
  });

  it('handles daylight saving time', () => {
    // Oct 25 2026 is still EDT (UTC-4).
    expect(toTorontoWallClock(new Date('2026-10-25T16:00:00Z')).toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });

  it('names the file SaaS_North_Leads_YYYY-MM-DD.xlsx by Toronto date', () => {
    expect(exportFileName(new Date('2026-11-05T03:00:00Z'))).toBe('SaaS_North_Leads_2026-11-04.xlsx');
    expect(exportFileName(new Date('2026-11-05T15:00:00Z'))).toBe('SaaS_North_Leads_2026-11-05.xlsx');
  });
});

describe('export filters', () => {
  const parse = (q: string) => parseLeadFilters(new URLSearchParams(q));

  it('accepts empty and valid filters', () => {
    expect(parse('')).toEqual({ from: null, to: null, source: null });
    expect(parse('from=2026-11-04&to=2026-11-05&source=website')).toEqual({
      from: '2026-11-04',
      to: '2026-11-05',
      source: 'website',
    });
  });

  it.each(['from=2026-13-01', 'to=11/05/2026', 'from=2026-02-30', 'source=Bad Source'])('rejects %s', (q) => {
    expect(parse(q)).toHaveProperty('error');
  });
});
