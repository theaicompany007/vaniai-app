import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('research_sessions')
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
  const { name, query, result } = body;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('research_sessions')
    .insert({ name, query, result, org_id: ctx.orgId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('research_sessions')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
