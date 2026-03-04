import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { isValidEmail } from '@/lib/email-validate';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 * Sends a password reset email via Supabase. User clicks the link and is taken to /auth/update-password to set a new password.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/update-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, message: 'Check your email for a link to reset your password.' });
}
