import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

/**
 * GET /api/auth/session
 * Returns current user and org (if any). Use to redirect users with no org to complete-setup.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await getSupabaseServer();
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id, role')
    .eq('user_id', user.userId)
    .limit(1)
    .single();

  const role = membership?.role as string | undefined;
  return NextResponse.json({
    userId: user.userId,
    email: user.email,
    orgId: membership?.org_id ?? null,
    role: role ?? null,
  });
}
