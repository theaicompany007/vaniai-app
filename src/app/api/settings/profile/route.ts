import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

/** GET /api/settings/profile — return current user's profile from user_metadata */
export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  return NextResponse.json({
    first_name:  meta.first_name  ?? '',
    last_name:   meta.last_name   ?? '',
    designation: meta.designation ?? 'Consultant',
    timezone:    meta.timezone    ?? 'Asia/Calcutta',
    phone_code:  meta.phone_code  ?? '+91',
    phone:       meta.phone       ?? '',
    email:       user.email       ?? '',
    website:     meta.website     ?? '',
  });
}

/** PUT /api/settings/profile — save user profile to user_metadata */
export async function PUT(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { first_name, last_name, designation, timezone, phone_code, phone, website } = body;

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.updateUser({
    data: { first_name, last_name, designation, timezone, phone_code, phone, website },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
