import { getSupabaseAdmin } from './supabase';

export type UsageFeature = 'signals' | 'agent_runs' | 'documents';

const PLAN_LIMITS: Record<string, Record<UsageFeature, number>> = {
  starter:    { signals: 50,  agent_runs: 20,  documents: 10  },
  pro:        { signals: 500, agent_runs: 200, documents: 100 },
  enterprise: { signals: -1,  agent_runs: -1,  documents: -1  },
  trial:      { signals: 20,  agent_runs: 10,  documents: 5   },
};

/** Resolve org id for the creator org (matches CREATOR_ORG_SLUG). Used by flyer to load creator's signals. */
export async function getCreatorOrgId(): Promise<string | null> {
  const identifiers = (process.env['CREATOR_ORG_SLUG'] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (identifiers.length === 0) return null;
  const admin = getSupabaseAdmin();
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, slug, profile')
    .limit(200);
  if (!orgs?.length) return null;
  const match = orgs.find((org) => isCreatorOrg(org));
  return match?.id ?? null;
}

/** Check if org matches CREATOR_ORG_SLUG (unlimited usage). Used by Settings to show status. */
export function isCreatorOrg(org: { slug?: string; name?: string; profile?: unknown }): boolean {
  const identifiers = (process.env['CREATOR_ORG_SLUG'] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (identifiers.length === 0) return false;
  const orgName = (org?.name ?? '').toLowerCase();
  const orgNameNorm = orgName.replace(/\s+/g, '').replace(/-/g, '');
  const orgSlugBase = (org?.slug ?? '').replace(/-?\d{10,}$/, '').toLowerCase().replace(/-/g, '');
  const profile = (org?.profile ?? {}) as { website_url?: string };
  const website = ((profile.website_url ?? '') + '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return identifiers.some((id) => {
    const idNorm = id.replace(/\s+/g, '').replace(/-/g, '');
    return orgName.includes(id) || orgNameNorm.includes(idNorm) || orgSlugBase.includes(idNorm) || website.includes(id);
  });
}

export async function checkUsageLimit(
  orgId: string,
  feature: UsageFeature
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  // process.env['X'] avoids build-time replacement; container .env is read at runtime
  if (process.env['BYPASS_USAGE_LIMITS'] === 'true') {
    return { allowed: true, remaining: -1, limit: -1 };
  }

  const admin = getSupabaseAdmin();

  const { data: org } = await admin
    .from('organizations')
    .select('subscription_tier, subscription_status, slug, name, profile')
    .eq('id', orgId)
    .single();

  if (isCreatorOrg(org ?? {})) return { allowed: true, remaining: -1, limit: -1 };

  const tier = org?.subscription_tier ?? 'starter';
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter;
  const limit = limits[feature];

  if (limit === -1) return { allowed: true, remaining: -1, limit: -1 };

  // Count usage this calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let count = 0;
  if (feature === 'signals') {
    const { count: c } = await admin
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfMonth.toISOString());
    count = c ?? 0;
  } else if (feature === 'documents') {
    const { count: c } = await admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfMonth.toISOString());
    count = c ?? 0;
  } else if (feature === 'agent_runs') {
    // Count chat messages (agent responses) + research sessions this month
    const { count: chatCount } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'assistant')
      .gte('created_at', startOfMonth.toISOString());
    const { count: researchCount } = await admin
      .from('research_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfMonth.toISOString());
    count = (chatCount ?? 0) + (researchCount ?? 0);
  }

  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}
