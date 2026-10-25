import { getDb } from '@/lib/db';
import { parseLeadFilters } from '@/lib/export-filters';
import { countLeads } from '@/lib/leads-repository';
import { requireStaff } from '@/lib/require-staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Staff only: number of stored leads (footer "(N saved)"). Same optional filters as the export. */
export async function GET(request: Request) {
  const denied = await requireStaff();
  if (denied) return denied;

  const filters = parseLeadFilters(new URL(request.url).searchParams);
  if ('error' in filters) return Response.json({ error: filters.error }, { status: 400 });

  const count = await countLeads(await getDb(), filters);
  return Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
