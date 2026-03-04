import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWeeklyDigestForOrg } from '@/lib/notifications';

/**
 * GET /api/cron/weekly-digest
 * Call from Vercel Cron or external scheduler (e.g. weekly).
 * Optional: protect with CRON_SECRET header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const { data: orgs, error: orgsErr } = await admin
    .from('organizations')
    .select('id');

  if (orgsErr || !orgs?.length) {
    return NextResponse.json({ sent: 0, error: orgsErr?.message });
  }

  let sent = 0;
  for (const { id: orgId } of orgs) {
    try {
      const [signalsRes, oppsRes] = await Promise.all([
        admin.from('signals').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', sinceIso),
        admin.from('opportunities').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', sinceIso),
      ]);
      const signalsCount = signalsRes.count ?? 0;
      const opportunitiesUpdated = oppsRes.count ?? 0;
      await sendWeeklyDigestForOrg(admin, orgId, { signalsCount, opportunitiesUpdated });
      sent += 1;
    } catch (e) {
      console.error(`weekly-digest org ${orgId}:`, e);
    }
  }

  return NextResponse.json({ sent, total: orgs.length });
}
