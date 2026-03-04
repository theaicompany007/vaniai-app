import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  const loginUrl = new URL('/auth/login', req.url);

  // Fast path: if no Supabase auth cookie exists, skip the API call entirely.
  // Supabase stores the session as sb-<project-ref>-auth-token (or chunked as …-0, …-1).
  const hasAuthCookie = req.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );
  if (!hasAuthCookie) {
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard: if env vars are missing, redirect rather than crash.
  if (!supabaseUrl || !supabaseAnon) {
    console.error('[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    // Supabase unreachable or returned non-JSON — treat as unauthenticated.
    console.error('[proxy] Auth check failed:', err);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/home/:path*',
    '/research/:path*',
    '/settings/:path*',
  ],
};
