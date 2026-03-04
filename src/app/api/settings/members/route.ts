import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/settings/members
 * Returns all members of the current user's organization.
 * Uses admin client to read auth.users for name/email details.
 */
export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const admin = getSupabaseAdmin();

  const { data: memberships, error } = await admin
    .from('org_memberships')
    .select('user_id, role, created_at')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const currentMembership = memberships?.find((m) => m.user_id === ctx.userId);
  const current_user_role = (currentMembership?.role as string) ?? 'member';
  const current_user_id = ctx.userId;

  if (!memberships?.length) return NextResponse.json({ members: [], current_user_role, current_user_id });

  // Resolve name + email for each member via admin auth API
  const members = await Promise.all(
    memberships.map(async (m) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(m.user_id);
        const meta = (user?.user_metadata ?? {}) as Record<string, string>;
        const firstName = meta.first_name ?? '';
        const lastName = meta.last_name ?? '';
        const name = firstName
          ? `${firstName} ${lastName}`.trim()
          : user?.email?.split('@')[0] ?? 'Unknown';
        return {
          user_id: m.user_id,
          name,
          email: user?.email ?? '',
          role: m.role as string,
          joined: m.created_at as string,
        };
      } catch {
        return {
          user_id: m.user_id,
          name: 'Unknown',
          email: '',
          role: m.role as string,
          joined: m.created_at as string,
        };
      }
    })
  );

  return NextResponse.json({ members, current_user_role, current_user_id });
}

/**
 * PATCH /api/settings/members
 * Body: { user_id: string, role: 'admin' | 'member' }
 * Owner can set any role (except change owner); Admin can set member only. Cannot change own role or owner's role.
 */
export async function PATCH(req: Request) {
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
    return NextResponse.json({ error: 'Only Owner or Admin can change roles' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { user_id?: string; role?: string };
  const targetUserId = body.user_id;
  const newRole = body.role === 'admin' ? 'admin' : 'member';

  if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

  const { data: targetRow } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', targetUserId)
    .single();

  if (!targetRow) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const targetRole = targetRow.role as string;
  if (targetRole === 'owner') {
    return NextResponse.json({ error: 'Cannot change Owner role. Use Transfer ownership instead.' }, { status: 400 });
  }
  if (targetUserId === ctx.userId) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }
  if (myRole === 'admin' && targetRole === 'admin') {
    return NextResponse.json({ error: 'Admin cannot change another Admin' }, { status: 403 });
  }

  const { error } = await admin
    .from('org_memberships')
    .update({ role: newRole })
    .eq('org_id', ctx.orgId)
    .eq('user_id', targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/settings/members?user_id=...
 * Remove a member from the org. Owner/Admin only; cannot remove owner or self.
 */
export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('user_id');
  if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: myMembership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single();

  const myRole = myMembership?.role as string | undefined;
  if (myRole !== 'owner' && myRole !== 'admin') {
    return NextResponse.json({ error: 'Only Owner or Admin can remove members' }, { status: 403 });
  }

  const { data: targetRow } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', targetUserId)
    .single();

  if (!targetRow) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  if ((targetRow.role as string) === 'owner') {
    return NextResponse.json({ error: 'Cannot remove Owner. Transfer ownership first.' }, { status: 400 });
  }
  if (targetUserId === ctx.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }
  if (myRole === 'admin' && (targetRow.role as string) === 'admin') {
    return NextResponse.json({ error: 'Admin cannot remove another Admin' }, { status: 403 });
  }

  const { error } = await admin
    .from('org_memberships')
    .delete()
    .eq('org_id', ctx.orgId)
    .eq('user_id', targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
