import { getDb } from '@/lib/db';
import { parseLeadFilters } from '@/lib/export-filters';
import { buildLeadsWorkbook, exportFileName } from '@/lib/export-workbook';
import { listLeadsForExport } from '@/lib/leads-repository';
import { requireStaff } from '@/lib/require-staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Staff only: every lead as .xlsx, oldest first. Optional from, to (YYYY-MM-DD) and source filters. */
export async function GET(request: Request) {
  const denied = await requireStaff();
  if (denied) return denied;

  const filters = parseLeadFilters(new URL(request.url).searchParams);
  if ('error' in filters) {
    return Response.json({ error: filters.error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const rows = await listLeadsForExport(await getDb(), filters);
  const file = await buildLeadsWorkbook(rows);
  return new Response(file.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${exportFileName()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
