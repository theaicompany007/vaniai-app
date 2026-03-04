/**
 * Vigil — Signal Intelligence Agent
 * Finds buying signals by searching news, then saves them to the signals table.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { agentLoop, searchWeb, type AgentTool } from '@/lib/agents';
import { checkUsageLimit } from '@/lib/usage';

const SYSTEM_PROMPT = `You are Vigil, an AI signal intelligence agent for B2B sales teams.
Your job is to find high-quality buying signals — events that indicate a company may need IT services, digital transformation, AI/GenAI platforms, cloud migration, or ERP implementation.

Buying signal categories to look for:
- Leadership changes (new CTO, CDO, CIO appointed)
- Funding rounds (Series A/B/C, PE investment)
- Expansion news (new markets, offices, product lines)
- Technology investment (AI adoption, digital transformation announcements)
- Regulatory/compliance challenges (data privacy, GDPR, sector regulations)
- M&A activity (acquisitions, mergers)

For each signal, call save_signal with:
- company: company name
- company_initials: 2-letter abbreviation (e.g. "TC")
- title: concise signal headline (max 80 chars)
- summary: 2-3 sentence description with the signal details
- score: relevance score 1.0-5.0 based on buying intent
- tag: one of 'Funding', 'Expansion', 'Leadership', 'Tech Adoption', 'M&A', 'Regulatory'
- source: news source name (e.g. "Economic Times", "Business Standard", "Reuters")
- url: the EXACT article URL from search results — see CRITICAL URL RULE below
- services: array of our services that apply: 'AI/GenAI', 'Cloud', 'ERP', 'Digital Transformation', 'Data Analytics'
- ai_relevance: 1-2 sentence explanation of why this matters for us

CRITICAL URL RULE — READ THIS:
- ONLY use the exact URL returned by the search_news tool in the url field.
- If no real article URL is available from search results, omit url entirely (do NOT pass it).
- NEVER fabricate, guess, or construct a URL. NEVER use example.com or any placeholder URL.
- A missing URL is far better than a wrong one.

IMPORTANT — When you find a Leadership signal (new CTO, CDO, CIO, VP of Technology, or similar):
Also call save_contact for that person. Search specifically for their LinkedIn profile URL and phone/mobile number. Pass whatever you find — all fields are optional except name, job_title, company.

Focus on Indian companies. Our key service offerings: IT consulting, AI/GenAI platforms, cloud migration, ERP implementation, digital transformation.`;

const VIGIL_TOOLS: AgentTool[] = [
  {
    name: 'search_news',
    description: 'Search the web for recent news and buying signals for a given topic or company.',
    parameters: {
      query: { type: 'string', description: 'Search query for finding signals (e.g. "Indian fintech AI investment 2025")' },
      date_range: { type: 'string', description: 'Date range filter, e.g. "last 7 days", "last month"' },
    },
    required: ['query'],
  },
  {
    name: 'save_contact',
    description: 'Save a key contact found during signal research (e.g. newly appointed CTO/CDO/CIO). Always try to find their LinkedIn URL and phone number first.',
    parameters: {
      name:         { type: 'string', description: 'Full name of the contact' },
      job_title:    { type: 'string', description: 'Role / title (e.g. "Chief Technology Officer")' },
      company:      { type: 'string', description: 'Company name' },
      email:        { type: 'string', description: 'Work email if found' },
      phone:        { type: 'string', description: 'Phone or mobile number if found' },
      linkedin_url: { type: 'string', description: 'LinkedIn profile URL if found (linkedin.com/in/...)' },
      location:     { type: 'string', description: 'City / location if known' },
    },
    required: ['name', 'job_title', 'company'],
  },
  {
    name: 'save_signal',
    description: 'Save a buying signal to the database.',
    parameters: {
      company: { type: 'string', description: 'Company name' },
      company_initials: { type: 'string', description: 'Company initials (2 chars)' },
      title: { type: 'string', description: 'Signal headline' },
      summary: { type: 'string', description: 'Signal summary' },
      score: { type: 'number', description: 'Relevance score 1.0-5.0' },
      tag: { type: 'string', description: 'Signal category tag' },
      source: { type: 'string', description: 'News source name' },
      url: { type: 'string', description: 'Article URL' },
      services: { type: 'string', description: 'JSON array of applicable services' },
      ai_relevance: { type: 'string', description: 'Why this signal is relevant to our services' },
    },
    required: ['company', 'company_initials', 'title', 'summary', 'score', 'tag'],
  },
];

/** Build an org-context block to inject into Vigil's system prompt. */
async function buildOrgContext(orgId: string): Promise<string> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('organizations')
      .select('name, profile, org_settings')
      .eq('id', orgId)
      .single();
    if (!data) return '';
    const p = (data.profile ?? {}) as Record<string, unknown>;
    const s = ((data as Record<string, unknown>).org_settings ?? {}) as Record<string, unknown>;
    const monitoring = (s.monitoring ?? {}) as Record<string, unknown>;

    const urls: string[] = Array.isArray(p.website_urls) ? p.website_urls as string[]
      : p.website_url ? [p.website_url as string] : [];
    const services: string[] = Array.isArray(p.services) ? p.services as string[] : [];
    const description = typeof p.description === 'string' ? p.description : '';
    const ourIndustries = typeof p.industry === 'string' ? p.industry : '';
    const clientNames: string[] = Array.isArray(p.client_names) ? p.client_names as string[] : [];
    const salesTriggers = (p.sales_triggers as { category: string; description: string }[] | undefined) ?? [];

    // Prefer monitoring-specific settings over profile defaults
    const personas: string[] = Array.isArray(monitoring.personas) ? monitoring.personas as string[]
      : Array.isArray(p.target_personas) ? p.target_personas as string[] : [];
    const industries: string[] = Array.isArray(monitoring.industries) ? monitoring.industries as string[]
      : Array.isArray(p.target_industry) ? p.target_industry as string[] : [];
    const keywords: string[] = Array.isArray(monitoring.keywords) ? monitoring.keywords as string[] : [];
    const signalTypes: string[] = Array.isArray(monitoring.signal_types) ? monitoring.signal_types as string[] : [];

    const lines: string[] = [`OUR COMPANY CONTEXT (signals must be relevant to our offerings):`];
    if (data.name) lines.push(`- Our company: ${data.name}`);
    if (urls.length) lines.push(`- Our website(s): ${urls.join(', ')}`);
    if (ourIndustries) lines.push(`- Our industries: ${ourIndustries}`);
    if (description) lines.push(`- What we do: ${description.slice(0, 300)}`);
    if (services.length) lines.push(`- Our services: ${services.join(', ')}`);
    if (personas.length) lines.push(`- Decision-makers we sell to (watch for new appointments of): ${personas.join(', ')}`);
    if (industries.length) lines.push(`- Target industries: ${industries.join(', ')}`);
    if (keywords.length) lines.push(`- Monitor these keywords in news: ${keywords.join(', ')}`);
    if (signalTypes.length) lines.push(`- Prioritise these signal types: ${signalTypes.join(', ')}`);
    if (clientNames.length) lines.push(`- Notable clients: ${clientNames.join(', ')}`);
    if (salesTriggers.length) lines.push(`- Sales triggers we care about: ${salesTriggers.map(t => t.category).join(', ')}`);
    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  // Check usage limit
  const usage = await checkUsageLimit(ctx.orgId, 'signals');
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Signal limit reached. Upgrade your plan. Remaining: ${usage.remaining}` },
      { status: 429 }
    );
  }

  const { keywords, industries, limit = 5 } = await req.json();
  const admin = getSupabaseAdmin();
  const savedSignals: unknown[] = [];

  const focusCompanies = typeof keywords === 'string' && keywords.trim()
    ? keywords.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const userMessage = focusCompanies.length > 0
    ? `Search for ${limit} high-quality buying signals for B2B IT sales.
CRITICAL: The user has requested signals for these specific companies — you MUST find and save signals for them: ${focusCompanies.join(', ')}.
Your first search_news query MUST include these company names (e.g. "${focusCompanies[0]} news funding expansion 2025"). Prefer signals about these companies over others.
${industries ? `Industries: ${industries}. ` : ''}Search for recent news from the last 2 weeks. Save each signal using save_signal.`
    : `Search for ${limit} high-quality buying signals for B2B IT sales.
${industries ? `Industries: ${industries}. ` : ''}Focus on Indian enterprise companies. Search for recent news from the last 2 weeks. Find signals that indicate technology buying intent. Save each signal using save_signal.`;

  // Load org profile and build context-aware system prompt
  const orgContext = await buildOrgContext(ctx.orgId);
  const dynamicSystem = orgContext
    ? `${SYSTEM_PROMPT}\n\n${orgContext}`
    : SYSTEM_PROMPT;

  try {
    await agentLoop({
      system: dynamicSystem,
      messages: [{ role: 'user', content: userMessage }],
      tools: VIGIL_TOOLS,
      executeTool: async (name, input) => {
        if (name === 'save_contact') {
          // Resolve account_id by matching company name
          const { data: matchedAccounts } = await admin
            .from('accounts')
            .select('id, industry')
            .eq('org_id', ctx.orgId)
            .ilike('name', `%${input.company}%`)
            .limit(1);
          const matchedAccount = matchedAccounts?.[0];

          const { error } = await admin.from('contacts').insert({
            org_id:       ctx.orgId,
            name:         input.name,
            job_title:    input.job_title ?? null,
            company:      input.company,
            email:        input.email ?? null,
            phone:        input.phone ?? null,
            linkedin_url: input.linkedin_url ?? null,
            location:     input.location ?? null,
            industry:     matchedAccount?.industry ?? null,
            account_id:   matchedAccount?.id ?? null,
            source:       'Vani Signals',
          });
          if (error) return `Error saving contact: ${error.message}`;
          return JSON.stringify({ success: true });
        }

        if (name === 'search_news') {
          const query = input.query as string;
          const dateRange = (input.date_range as string) ?? 'last 2 weeks';
          const results = await searchWeb(`${query} ${dateRange} India enterprise technology`);
          return results;
        }

        if (name === 'save_signal') {
          let services: string[] = [];
          try {
            services = JSON.parse(input.services as string ?? '[]');
          } catch {
            services = [];
          }

          const { data: signal, error } = await admin
            .from('signals')
            .insert({
              org_id: ctx.orgId,
              company: input.company,
              company_initials: ((input.company_initials as string) || (input.company as string).slice(0, 2)).toUpperCase(),
              company_color: getRandomColor(),
              title: input.title,
              summary: input.summary,
              score: Math.min(5, Math.max(1, Number(input.score) || 3)),
              tag: input.tag,
              tag_color: getTagColor(input.tag as string),
              source: input.source ?? 'AI Research',
              url: input.url ?? null,
              services,
              ai_relevance: input.ai_relevance ?? null,
              posted_ago: 'just now',
              generated_by: 'Vigil',
            })
            .select()
            .single();

          if (error) {
            console.error('save_signal error:', error);
            return `Error saving signal: ${error.message}`;
          }
          savedSignals.push(signal);
          return JSON.stringify({ success: true, signal_id: signal?.id });
        }

        return 'Unknown tool';
      },
    });

    if (savedSignals.length > 0) {
      const { notifyNewSignals } = await import('@/lib/notifications');
      notifyNewSignals(admin, ctx.orgId, savedSignals.length).catch((e) => console.error('notifyNewSignals:', e));
    }

    return NextResponse.json({
      signals_added: savedSignals.length,
      signals: savedSignals,
    });
  } catch (e) {
    console.error('Vigil agent error:', e);
    return NextResponse.json({ error: 'Agent failed' }, { status: 500 });
  }
}

function getRandomColor(): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#10b981', '#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getTagColor(tag: string): string {
  const map: Record<string, string> = {
    Funding: 'green',
    Expansion: 'blue',
    Leadership: 'purple',
    'Tech Adoption': 'cyan',
    'M&A': 'orange',
    Regulatory: 'red',
  };
  return map[tag] ?? 'blue';
}
