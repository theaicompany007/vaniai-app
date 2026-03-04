/**
 * Research Sessions — list endpoint
 * GET /api/research-sessions  → returns last 20 sessions for the org
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('research_sessions')
    .select('id, name, query, created_at')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
