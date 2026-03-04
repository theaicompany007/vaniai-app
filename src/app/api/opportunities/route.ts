import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';
import { notifyOpportunityStage } from '@/lib/notifications';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const [oppsRes, contactsRes] = await Promise.all([
    supabase.from('opportunities').select('*').eq('org_id', ctx.orgId).order('created_at', { ascending: false }),
    supabase.from('contacts').select('account_id, company').eq('org_id', ctx.orgId),
  ]);

  if (oppsRes.error) return NextResponse.json({ error: oppsRes.error.message }, { status: 500 });

  const contacts = contactsRes.data ?? [];

  const result = (oppsRes.data ?? []).map((o) => {
    const count = contacts.filter((c) => {
      // Exact account_id match (highest priority)
      if (c.account_id && o.account_id && c.account_id === o.account_id) return true;
      // Company name match as fallback — works even when one side has account_id and other doesn't
      if (c.company && o.account) {
        const cLower = c.company.toLowerCase();
        const oLower = o.account.toLowerCase();
        return cLower.includes(oLower) || oLower.includes(cLower);
      }
      return false;
    }).length;

    return { ...o, people: count > 0 ? count : (o.people ?? 0) };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('opportunities')
    .insert({ ...body, org_id: ctx.orgId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const stageNew = updates.stage as string | undefined;

  let oldStage: string | undefined;
  if (stageNew !== undefined) {
    const { data: existing } = await supabase
      .from('opportunities')
      .select('stage, account')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();
    oldStage = existing?.stage as string | undefined;
  }

  const { data, error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (stageNew !== undefined && oldStage !== undefined && stageNew !== oldStage && data) {
    const admin = getSupabaseAdmin();
    const d = data as { account?: string; name?: string };
    const name = d.account ?? d.name ?? 'Opportunity';
    notifyOpportunityStage(admin, ctx.orgId, name, oldStage, stageNew).catch((e) =>
      console.error('notifyOpportunityStage:', e)
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
