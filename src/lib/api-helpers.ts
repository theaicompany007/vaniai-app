import { NextResponse } from 'next/server';
import { getSupabaseServer } from './supabase';

export interface AuthContext {
  userId: string;
  orgId: string;
}

/**
 * Resolves the authenticated user + org from the request cookies.
 * Returns null and sends a 401/403 response if auth fails.
 */
export async function requireAuth(): Promise<{ ctx: AuthContext | null; response: Response | null }> {
  const supabase = await getSupabaseServer();

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error('[requireAuth] getUser failed:', err);
    return {
      ctx: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!user) {
    return {
      ctx: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return {
      ctx: null,
      response: NextResponse.json({ error: 'No organization found' }, { status: 403 }),
    };
  }

  return { ctx: { userId: user.id, orgId: membership.org_id }, response: null };
}

/**
 * Returns the current session user (no org required). Use for create-org and session checks.
 */
export async function getSessionUser(): Promise<
  { userId: string; email: string | null } | null
> {
  const supabase = await getSupabaseServer();
  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return null;
  }
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}
