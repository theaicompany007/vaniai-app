import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_code', req.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth_failed', req.url));
  }

  // For Google OAuth: check if org already exists, create if not
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', data.user.id)
    .single();

  if (!existing) {
    const displayName = data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'My Org';
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const { data: org } = await admin.from('organizations').insert({
      name: displayName,
      slug,
      owner_user_id: data.user.id,
      subscription_tier: 'starter',
      subscription_status: 'trial',
    }).select().single();

    if (org) {
      await admin.from('org_memberships').insert({
        org_id: org.id,
        user_id: data.user.id,
        role: 'owner',
      });
      if (data.user.email) {
        await sendWelcomeEmail(data.user.email, displayName);
      }
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
}
