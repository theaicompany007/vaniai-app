import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/settings/members/accept-invite
 * Body: { token: string }
 * Consumes the invite and adds the current user to the org with the invited role.
 * Uses session only (user may not have an org yet).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { token?: string };
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: invite, error: inviteErr } = await admin
    .from('pending_invites')
    .select('id, email, org_id, role, expires_at')
    .eq('token', token)
    .single();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invite not found or invalid' }, { status: 404 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    await admin.from('pending_invites').delete().eq('id', invite.id);
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
  }

  const { error: insertErr } = await admin.from('org_memberships').insert({
    org_id: invite.org_id,
    user_id: user.userId,
    role: invite.role,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'You are already a member of this organization' }, { status: 400 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await admin.from('pending_invites').delete().eq('id', invite.id);

  return NextResponse.json({ success: true, org_id: invite.org_id });
}
