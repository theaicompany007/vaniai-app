import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isValidEmail } from '@/lib/email-validate';
import { sendInviteEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/**
 * POST /api/settings/members/invite
 * Body: { email: string, role?: 'member' | 'admin' }
 * Only Owner or Admin can invite.
 */
export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single();

  const role = membership?.role as string | undefined;
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only Owner or Admin can invite members' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string; role?: string };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const inviteRole = body.role === 'admin' ? 'admin' : 'member';

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });

  const { data: org } = await admin.from('organizations').select('name').eq('id', ctx.orgId).single();
  const orgName = org?.name ?? 'Your team';

  const { data: invite, error: insertErr } = await admin
    .from('pending_invites')
    .insert({
      email,
      org_id: ctx.orgId,
      role: inviteRole,
    })
    .select('token')
    .single();

  if (insertErr) {
    console.error('pending_invites insert error:', insertErr);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  const acceptUrl = `${APP_URL}/auth/accept-invite?token=${invite?.token ?? ''}`;
  let inviterName = 'A team admin';
  try {
    const { data: { user: inviter } } = await admin.auth.admin.getUserById(ctx.userId);
    const meta = (inviter?.user_metadata ?? {}) as Record<string, string>;
    const first = meta.first_name ?? meta.full_name ?? '';
    const last = meta.last_name ?? '';
    if (first || last) inviterName = `${first} ${last}`.trim();
    else if (inviter?.email) inviterName = inviter.email.split('@')[0];
  } catch { /* keep default */ }
  await sendInviteEmail(email, orgName, inviterName, acceptUrl, inviteRole);

  return NextResponse.json({ success: true, message: 'Invite sent' });
}
