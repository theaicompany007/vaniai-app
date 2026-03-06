import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  try {
    const supabase = await getSupabaseServer();

    // Fetch accounts first; contacts/opps counts are best-effort (don't 500 if they fail)
    const accountsRes = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    if (accountsRes.error) {
      return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });
    }

    const accounts = accountsRes.data ?? [];
    const contactCountMap: Record<string, number> = {};
    const oppCountMap: Record<string, number> = {};

    const [contactsRes, oppsRes, signalsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('account_id')
        .eq('org_id', ctx.orgId)
        .not('account_id', 'is', null),
      supabase
        .from('opportunities')
        .select('account_id')
        .eq('org_id', ctx.orgId)
        .not('account_id', 'is', null),
      supabase
        .from('signals')
        .select('company')
        .eq('org_id', ctx.orgId),
    ]);

    if (!contactsRes.error && contactsRes.data) {
      for (const c of contactsRes.data) {
        if (c.account_id) contactCountMap[c.account_id] = (contactCountMap[c.account_id] ?? 0) + 1;
      }
    }
    if (!oppsRes.error && oppsRes.data) {
      for (const o of oppsRes.data) {
        if (o.account_id) oppCountMap[o.account_id] = (oppCountMap[o.account_id] ?? 0) + 1;
      }
    }

    // Build signal count by company name (case-insensitive match to account name)
    const signalCountByCompany: Record<string, number> = {};
    if (!signalsRes.error && signalsRes.data) {
      for (const s of signalsRes.data) {
        const key = (s.company ?? '').trim().toLowerCase();
        if (key) signalCountByCompany[key] = (signalCountByCompany[key] ?? 0) + 1;
      }
    }

    const result = accounts.map((a) => {
      const accountKey = (a.name ?? '').trim().toLowerCase();
      const signal_count = signalCountByCompany[accountKey] ?? 0;
      return {
        ...a,
        contacts_count: contactCountMap[a.id] ?? 0,
        opp_count: oppCountMap[a.id] ?? 0,
        signal_count,
        insights: null as string | null, // Placeholder for future insights
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/accounts]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load accounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('accounts')
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
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
