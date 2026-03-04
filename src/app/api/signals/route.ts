import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';
import { notifySignalScoreUpdate } from '@/lib/notifications';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('signals')
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
    .from('signals')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof updates.score === 'number' && data) {
    const company = (data.company as string) ?? 'Signal';
    const admin = getSupabaseAdmin();
    notifySignalScoreUpdate(admin, ctx.orgId, company, updates.score).catch((e) =>
      console.error('notifySignalScoreUpdate:', e)
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
    .from('signals')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
