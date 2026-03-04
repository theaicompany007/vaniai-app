import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get('agent') ?? 'Vidya';
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const sessionId = searchParams.get('session_id');

  const supabase = await getSupabaseServer();
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('agent', agent)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else {
    query = query.is('session_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { role, content, agent = 'Vidya' } = body;

  if (!role || !content) {
    return NextResponse.json({ error: 'Missing role or content' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ role, content, agent, org_id: ctx.orgId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get('agent');

  const supabase = await getSupabaseServer();
  let query = supabase.from('chat_messages').delete().eq('org_id', ctx.orgId);
  if (agent) query = query.eq('agent', agent);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
