import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

/**
 * POST /api/auth/login
 * Server-side login — avoids CORS by keeping Supabase calls server-side.
 * Sets the session cookie so middleware can read it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Session cookies are set automatically by createServerClient's setAll handler.
    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    console.error('[/api/auth/login] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error — please try again' },
      { status: 500 }
    );
  }
}
