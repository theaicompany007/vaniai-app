import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase';
import { isValidEmail } from '@/lib/email-validate';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/**
 * POST /api/settings/members/send-password-reset
 * Body: { email: string }
 * Owner or Admin can send a password reset email to a member of the org (by email). Useful for invited users who forgot password.
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

  const myRole = myMembership?.role as string | undefined;
  if (myRole !== 'owner' && myRole !== 'admin') {
    return NextResponse.json({ error: 'Only Owner or Admin can send password reset' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });

  const { data: memberships } = await admin.from('org_memberships').select('user_id').eq('org_id', ctx.orgId);
  const userIds = (memberships ?? []).map((m) => m.user_id);
  let isMember = false;
  for (const uid of userIds) {
    try {
      const { data: { user } } = await admin.auth.admin.getUserById(uid);
      if (user?.email?.toLowerCase() === email) {
        isMember = true;
        break;
      }
    } catch { /* skip */ }
  }
  if (!isMember) {
    return NextResponse.json({ error: 'No member found with this email in your organization' }, { status: 404 });
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/update-password`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: 'Password reset email sent.' });
}
