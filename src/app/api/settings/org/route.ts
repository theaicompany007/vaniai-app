import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer } from '@/lib/supabase';

/** GET /api/settings/org — return org name + profile jsonb */
export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, profile, org_settings')
    .eq('id', ctx.orgId)
    .single();

  if (error) {
    // If profile column doesn't exist yet (migration not run), fallback gracefully
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      const { data: basic } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', ctx.orgId)
        .single();
      return NextResponse.json({ id: basic?.id, name: basic?.name ?? '', profile: {}, org_settings: {} });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id:           data.id,
    name:         data.name ?? '',
    profile:      (data as Record<string, unknown>).profile ?? {},
    org_settings: (data as Record<string, unknown>).org_settings ?? {},
  });
}

/** PUT /api/settings/org — update org name + profile jsonb */
export async function PUT(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { name, profile, org_settings } = body as {
    name?: string;
    profile?: Record<string, unknown>;
    org_settings?: Record<string, unknown>;
  };

  const supabase = await getSupabaseServer();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (profile !== undefined) updates.profile = profile;
  if (org_settings !== undefined) updates.org_settings = org_settings;

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
