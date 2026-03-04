import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email';
import { getSessionUser } from '@/lib/api-helpers';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { org_name?: string; company_website_url?: string };
    const org_name = typeof body.org_name === 'string' ? body.org_name.trim() : '';
    const company_website_url = typeof body.company_website_url === 'string' ? body.company_website_url.trim() : undefined;

    if (!org_name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check if user already has an org
    const { data: existing } = await admin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.userId)
      .single();

    if (existing) {
      return NextResponse.json({ org_id: existing.org_id });
    }

    const slug =
      org_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now();

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: org_name,
        slug,
        owner_user_id: user.userId,
        subscription_tier: 'starter',
        subscription_status: 'trial',
      })
      .select()
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: orgErr?.message ?? 'Failed to create org' }, { status: 500 });
    }

    const { error: memberErr } = await admin.from('org_memberships').insert({
      org_id: org.id,
      user_id: user.userId,
      role: 'owner',
    });

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    // Save company website to profile jsonb (non-fatal — requires migration 001 to be run)
    if (company_website_url) {
      // Wrap in Promise.resolve so we can safely .catch() the PromiseLike
      await Promise.resolve(
        admin
          .from('organizations')
          .update({ profile: { website_url: company_website_url } })
          .eq('id', org.id)
      ).catch(() => { /* migration may not have run yet — silently skip */ });
    }

    // Send welcome email (non-blocking)
    if (user.email) sendWelcomeEmail(user.email, org_name).catch(console.error);

    return NextResponse.json({ org_id: org.id });
  } catch (e) {
    console.error('create-org error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
