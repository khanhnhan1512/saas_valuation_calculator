// Builds the staff Excel export (spec "Excel export"): one sheet, oldest first, fixed formats.
import ExcelJS from 'exceljs';
import { EVENT_TIMEZONE } from '@/config/valuation-config';
import type { ExportRow } from './leads-repository';

const SHEET_NAME = 'SaaS North Leads';
const MONEY = '$#,##0';
const MULTIPLE = '0.00"x"';
const DATE_TIME = 'yyyy-mm-dd hh:mm';

const COLUMNS: Array<{ header: string; key: keyof ExportRow; width: number; numFmt?: string }> = [
  { header: 'Submitted', key: 'submittedAt', width: 18, numFmt: DATE_TIME },
  { header: 'First Name', key: 'firstName', width: 14 },
  { header: 'Last Name', key: 'lastName', width: 14 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Company', key: 'company', width: 24 },
  { header: 'Next Move', key: 'nextMove', width: 24 },
  { header: 'ARR Entered', key: 'arr', width: 15, numFmt: MONEY },
  { header: 'Software Category', key: 'category', width: 26 },
  { header: 'Industry', key: 'industry', width: 18 },
  { header: 'Midpoint Multiple', key: 'midMultiple', width: 17, numFmt: MULTIPLE },
  { header: 'Low Value', key: 'lowValue', width: 15, numFmt: MONEY },
  { header: 'Midpoint Value', key: 'midValue', width: 15, numFmt: MONEY },
  { header: 'High Value', key: 'highValue', width: 15, numFmt: MONEY },
];

function torontoParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

/**
 * Excel dates have no time zone. Writing the Toronto wall-clock time as a UTC date makes
 * Excel show local event time (e.g. 2026-11-04 10:30) on any computer.
 */
export function toTorontoWallClock(date: Date): Date {
  const p = torontoParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

/** SaaS_North_Leads_YYYY-MM-DD.xlsx, dated in the event time zone. */
export function exportFileName(now = new Date()): string {
  const p = torontoParts(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `SaaS_North_Leads_${p.year}-${pad(p.month)}-${pad(p.day)}.xlsx`;
}

export async function buildLeadsWorkbook(rows: ExportRow[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMNS.map(({ header, key, width, numFmt }) => ({
    header,
    key,
    width,
    style: numFmt ? { numFmt } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    // A null industry (software category picked) leaves the cell truly empty.
    sheet.addRow({ ...row, submittedAt: toTorontoWallClock(row.submittedAt) });
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
