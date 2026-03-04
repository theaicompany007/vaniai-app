/**
 * Vidya — Knowledge Chat Agent
 * AI sales co-pilot with access to KB + live signal data. Streams responses.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase';
import { agentLoop, type AgentTool } from '@/lib/agents';
import { searchKB } from '@/lib/kb';

const SYSTEM_PROMPT = `You are Vidya, an intelligent AI sales co-pilot for the user's B2B sales team.
You have access to the company's knowledge base, live signal data, accounts, contacts, and opportunity pipeline.

Your capabilities:
- Answer questions about our services, capabilities, and case studies (use KB)
- Surface relevant buying signals for target accounts
- Analyze pipeline opportunities and suggest next actions
- Draft email openers and conversation starters for specific accounts
- Help prepare for sales meetings with relevant context

Always be specific, data-driven, and actionable. Reference actual signals, accounts, and KB data when available.
Keep responses concise and scannable with bullet points where appropriate.`;

const VIDYA_TOOLS: AgentTool[] = [
  {
    name: 'query_knowledge_base',
    description: 'Search the company knowledge base for information about our services, case studies, and capabilities.',
    parameters: {
      query: { type: 'string', description: 'What to search in the KB' },
    },
    required: ['query'],
  },
  {
    name: 'get_signals',
    description: 'Get buying signals for a specific company or all recent signals.',
    parameters: {
      company: { type: 'string', description: 'Company name to filter signals (optional)' },
      limit: { type: 'number', description: 'Number of signals to return (default 5)' },
    },
    required: [],
  },
  {
    name: 'get_opportunities',
    description: 'Get the current sales pipeline opportunities.',
    parameters: {
      stage: { type: 'string', description: 'Filter by stage: Discovery, Qualified, Proposal, Negotiation, Closed Won, Closed Lost' },
    },
    required: [],
  },
  {
    name: 'get_accounts',
    description: 'Get the list of target accounts, optionally filtering by watchlist status.',
    parameters: {
      watchlisted_only: { type: 'boolean', description: 'If true, return only watchlisted accounts' },
    },
    required: [],
  },
  {
    name: 'get_contacts',
    description: 'Get contacts from the CRM, optionally filtering by company or account.',
    parameters: {
      company: { type: 'string', description: 'Filter contacts by company name (optional)' },
    },
    required: [],
  },
];

/** Build org context (profile + monitoring) so Vidya can give tailored advice. */
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
    const geography: string[] = Array.isArray(p.target_geography) ? p.target_geography as string[] : [];
    const segment: string[] = Array.isArray(p.target_segment) ? p.target_segment as string[] : [];
    const salesTriggers = (p.sales_triggers as { category: string; description: string }[] | undefined) ?? [];

    const personas: string[] = Array.isArray(monitoring.personas) ? monitoring.personas as string[]
      : Array.isArray(p.target_personas) ? p.target_personas as string[] : [];
    const industries: string[] = Array.isArray(monitoring.industries) ? monitoring.industries as string[]
      : Array.isArray(p.target_industry) ? p.target_industry as string[] : [];
    const keywords: string[] = Array.isArray(monitoring.keywords) ? monitoring.keywords as string[] : [];
    const signalTypes: string[] = Array.isArray(monitoring.signal_types) ? monitoring.signal_types as string[] : [];

    const lines: string[] = ['CONTEXT ABOUT OUR COMPANY (use this to tailor your advice):'];
    if (data.name) lines.push(`- Company: ${data.name}`);
    if (urls.length) lines.push(`- Website(s): ${urls.join(', ')}`);
    if (ourIndustries) lines.push(`- Our industries: ${ourIndustries}`);
    if (description) lines.push(`- About us: ${description.slice(0, 400)}`);
    if (services.length) lines.push(`- Our services: ${services.join(', ')}`);
    if (personas.length) lines.push(`- We sell to (personas): ${personas.join(', ')}`);
    if (industries.length) lines.push(`- Target industries: ${industries.join(', ')}`);
    if (geography.length) lines.push(`- Target geography: ${geography.join(', ')}`);
    if (segment.length) lines.push(`- Target segment: ${segment.join(', ')}`);
    if (keywords.length) lines.push(`- Monitoring keywords: ${keywords.join(', ')}`);
    if (signalTypes.length) lines.push(`- Signal types we track: ${signalTypes.join(', ')}`);
    if (clientNames.length) lines.push(`- Notable clients: ${clientNames.join(', ')}`);
    if (salesTriggers.length) lines.push(`- Sales triggers: ${salesTriggers.map(t => `${t.category} — ${t.description}`).join('; ')}`);
    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { message, agent = 'Vidya' } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();

  // Load org context and build dynamic system prompt
  const orgContext = await buildOrgContext(ctx.orgId);
  const dynamicSystem = orgContext ? `${SYSTEM_PROMPT}\n\n${orgContext}` : SYSTEM_PROMPT;

  // Load recent conversation history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('org_id', ctx.orgId)
    .eq('agent', agent)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages = [
    ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Save user message
  await admin.from('chat_messages').insert({
    org_id: ctx.orgId,
    role: 'user',
    content: message,
    agent,
  });

  try {
    const reply = await agentLoop({
      system: dynamicSystem,
      messages,
      tools: VIDYA_TOOLS,
      executeTool: async (name, input) => {
        if (name === 'query_knowledge_base') {
          const results = await searchKB(ctx.orgId, input.query as string, 5);
          if (results.length === 0) return 'No relevant knowledge found. Answer from general knowledge.';
          return results.join('\n\n---\n\n');
        }

        if (name === 'get_signals') {
          let query = admin
            .from('signals')
            .select('company, title, summary, score, tag, ai_relevance, created_at')
            .eq('org_id', ctx.orgId)
            .order('created_at', { ascending: false })
            .limit((input.limit as number) ?? 5);

          if (input.company) {
            query = query.ilike('company', `%${input.company}%`);
          }

          const { data } = await query;
          if (!data || data.length === 0) return 'No signals found.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'get_opportunities') {
          let query = admin
            .from('opportunities')
            .select('name, account, stage, owner, industry, created_at')
            .eq('org_id', ctx.orgId)
            .order('created_at', { ascending: false });

          if (input.stage) {
            query = query.eq('stage', input.stage);
          }

          const { data } = await query;
          if (!data || data.length === 0) return 'No opportunities found.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'get_accounts') {
          let query = admin
            .from('accounts')
            .select('name, industry, website, is_watchlisted, created_at')
            .eq('org_id', ctx.orgId)
            .order('name');

          if (input.watchlisted_only) {
            query = query.eq('is_watchlisted', true);
          }

          const { data } = await query;
          if (!data || data.length === 0) return 'No accounts found.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'get_contacts') {
          let query = admin
            .from('contacts')
            .select('name, job_title, company, email, phone, linkedin_url, location, source')
            .eq('org_id', ctx.orgId)
            .order('name');

          if (input.company) {
            query = query.ilike('company', `%${input.company}%`);
          }

          const { data } = await query;
          if (!data || data.length === 0) return 'No contacts found.';
          return JSON.stringify(data, null, 2);
        }

        return 'Unknown tool';
      },
    });

    // Save assistant reply
    await admin.from('chat_messages').insert({
      org_id: ctx.orgId,
      role: 'assistant',
      content: reply,
      agent,
    });

    return NextResponse.json({ reply, agent });
  } catch (e) {
    console.error('Vidya agent error:', e);
    return NextResponse.json({ error: 'Chat agent failed' }, { status: 500 });
  }
}
