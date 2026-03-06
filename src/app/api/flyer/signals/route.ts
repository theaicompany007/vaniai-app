import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCreatorOrgId } from '@/lib/usage';

/**
 * GET /api/flyer/signals
 * Returns signals for the creator org (CREATOR_ORG_SLUG, e.g. rajvins@theaicompany.co's org).
 * Used by the flyer page so it always shows the creator's data without requiring the viewer to be logged in.
 */
export async function GET() {
  const creatorOrgId = await getCreatorOrgId();
  if (!creatorOrgId) {
    return NextResponse.json([]);
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('signals')
    .select('*')
    .eq('org_id', creatorOrgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
