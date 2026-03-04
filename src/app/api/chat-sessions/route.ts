/**
 * GET /api/chat-sessions?agent=Vidya → list chat sessions for org (for History panel)
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get('agent') ?? 'Vidya';

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('chat_sessions')
    .select('id, name, created_at')
    .eq('org_id', ctx.orgId)
    .eq('agent', agent)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
