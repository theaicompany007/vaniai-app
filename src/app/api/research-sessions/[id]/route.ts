/**
 * Research Sessions — single session endpoint
 * GET /api/research-sessions/:id  → returns full session including result markdown
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('research_sessions')
    .select('id, name, query, result, created_at')
    .eq('org_id', ctx.orgId)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}
