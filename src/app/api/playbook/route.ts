import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

/** GET /api/playbook — current org's playbook (if any) */
export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('playbooks')
    .select('company, industry, steps, started_at')
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (error) {
    // Table may not exist yet (migration not run) — return null so UI shows empty state
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json(null);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);
  }

  const row = data as { company: string; industry: string; steps: Record<string, string>; started_at: string };
  return NextResponse.json({
    company:   row.company ?? '',
    industry:  row.industry ?? '',
    steps:     row.steps ?? {},
    startedAt: row.started_at ?? new Date().toISOString(),
  });
}

/** PUT /api/playbook — upsert current org's playbook */
export async function PUT(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json() as {
    company: string;
    industry: string;
    steps: Record<string, string>;
    startedAt: string;
  };

  const { company, industry, steps, startedAt } = body;
  if (company == null || industry == null || !steps || !startedAt) {
    return NextResponse.json({ error: 'Missing company, industry, steps, or startedAt' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('playbooks')
    .upsert(
      {
        org_id:     ctx.orgId,
        company:    String(company),
        industry:   String(industry),
        steps:      steps,
        started_at: startedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/playbook — clear current org's playbook */
export async function DELETE() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('playbooks')
    .delete()
    .eq('org_id', ctx.orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
