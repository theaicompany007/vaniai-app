import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Browser/client-side — createBrowserClient stores session in COOKIES (not just localStorage)
// so the Next.js middleware (which reads cookies) can see the session after login/signup.
export const supabase = createBrowserClient(url, anon);

// Server client for API routes — reads request cookies for session
export async function getSupabaseServer() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

// Admin client — bypasses RLS, only use in trusted server contexts
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase server env vars');
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Helper: resolve org_id for the current authenticated user
export async function getOrgId(): Promise<string | null> {
  try {
    const db = await getSupabaseServer();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;
    const { data } = await db.from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single();
    return data?.org_id ?? null;
  } catch {
    return null;
  }
}
