import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { isValidEmail } from '@/lib/email-validate';

/**
 * POST /api/auth/signup
 * Server-side signup — avoids CORS, sets session cookie immediately.
 * mailer_autoconfirm must be true in Supabase for data.session to be non-null.
 */
export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Signup failed — no user returned' }, { status: 400 });
  }

  // If mailer_autoconfirm is true, data.session is set and cookies are written.
  // If not, data.session is null and the user must confirm their email.
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    confirmed: !!data.session,
  });
}
