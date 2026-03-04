import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/settings/members/transfer-ownership
 * Body: { new_owner_user_id: string }
 * Only current Owner can transfer. Sets org.owner_user_id and updates both memberships (old owner -> admin, new owner -> owner).
 */
export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const admin = getSupabaseAdmin();
  const { data: myMembership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single();

  if ((myMembership?.role as string) !== 'owner') {
    return NextResponse.json({ error: 'Only the Owner can transfer ownership' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { new_owner_user_id?: string };
  const newOwnerId = body.new_owner_user_id;
  if (!newOwnerId) return NextResponse.json({ error: 'new_owner_user_id is required' }, { status: 400 });

  if (newOwnerId === ctx.userId) {
    return NextResponse.json({ error: 'You are already the owner' }, { status: 400 });
  }

  const { data: newOwnerMembership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', newOwnerId)
    .single();

  if (!newOwnerMembership) {
    return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
  }

  await admin.from('org_memberships').update({ role: 'admin' }).eq('org_id', ctx.orgId).eq('user_id', ctx.userId);
  await admin.from('org_memberships').update({ role: 'owner' }).eq('org_id', ctx.orgId).eq('user_id', newOwnerId);
  await admin.from('organizations').update({ owner_user_id: newOwnerId }).eq('id', ctx.orgId);

  return NextResponse.json({ success: true });
}
