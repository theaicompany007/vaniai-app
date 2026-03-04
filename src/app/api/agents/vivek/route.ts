/**
 * Vivek — Deep Research Agent
 * Performs multi-step company/market research and saves research sessions.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { agentLoop, searchWeb, type AgentTool } from '@/lib/agents';
import { checkUsageLimit } from '@/lib/usage';

const SYSTEM_PROMPT = `You are Vivek, a deep research analyst agent for B2B IT sales teams.
You perform comprehensive company and market research to help sales teams understand their target accounts.

Your research framework:
1. Company Overview — size, industry, revenue, leadership team
2. Technology Stack — current IT infrastructure, tools, cloud providers
3. Digital Initiatives — ongoing transformation programs, AI/GenAI adoption
4. Pain Points — operational challenges, recent news about struggles
5. Buying Signals — funding, expansion, leadership change, regulatory pressure
6. Our Service Fit — which of our services (AI/GenAI, Cloud, ERP, Digital Transformation, Data Analytics) are most relevant and why
7. Key Decision Makers & Entry Points — see rules below

ENTRY POINTS RULES (strictly follow):
- You MUST list a minimum of 3 decision makers. Aim for 5.
- Include the CEO/MD, CTO/CDO/CIO, Head of Digital/IT, CMO, and any VP of Technology or Strategy.
- Search specifically by name — do not just list generic titles.
- For each person, use EXACTLY this format on its own line:
  **Full Name (Job Title)**: One sentence on why they are the right contact and the conversation angle.
- After listing contacts, search for their LinkedIn profile URLs. If found, add: LinkedIn: https://linkedin.com/in/...
- Always include the most senior technology or digital decision maker, even if they are less publicly known than the CEO.

Format your research as a structured markdown report with clear section headers (##).
Be specific, cite sources, and focus on actionable insights for the sales team.

IMPORTANT: You MUST call save_research with the complete report before finishing. This is required.`;

const VIVEK_TOOLS: AgentTool[] = [
  {
    name: 'search_company',
    description: 'Search for detailed information about a specific company.',
    parameters: {
      name: { type: 'string', description: 'Company name to research' },
      aspect: { type: 'string', description: 'Specific aspect to research: overview, technology, news, leadership, financials' },
    },
    required: ['name'],
  },
  {
    name: 'search_market',
    description: 'Search for market trends, competitors, or industry analysis.',
    parameters: {
      query: { type: 'string', description: 'Market research query' },
    },
    required: ['query'],
  },
  {
    name: 'get_existing_signals',
    description: 'Get existing signals for a company from our database.',
    parameters: {
      company: { type: 'string', description: 'Company name to search signals for' },
    },
    required: ['company'],
  },
  {
    name: 'save_research',
    description: 'Save the completed research session to the database. MUST be called after completing research.',
    parameters: {
      name: { type: 'string', description: 'Research session name/title' },
      query: { type: 'string', description: 'Original research query' },
      result: { type: 'string', description: 'Full research report in markdown format' },
    },
    required: ['name', 'query', 'result'],
  },
];

/** Build an org-context block to inject into system prompts. Includes profile + monitoring rules so the LLM has everything. */
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

    // Company Profile (ICP) + Monitoring Rules — prefer monitoring when set
    const personas: string[] = Array.isArray(monitoring.personas) ? monitoring.personas as string[]
      : Array.isArray(p.target_personas) ? p.target_personas as string[] : [];
    const industries: string[] = Array.isArray(monitoring.industries) ? monitoring.industries as string[]
      : Array.isArray(p.target_industry) ? p.target_industry as string[] : [];
    const keywords: string[] = Array.isArray(monitoring.keywords) ? monitoring.keywords as string[] : [];
    const signalTypes: string[] = Array.isArray(monitoring.signal_types) ? monitoring.signal_types as string[] : [];

    const lines: string[] = [`OUR COMPANY CONTEXT (use this to tailor research and recommendations):`];
    if (data.name) lines.push(`- Company: ${data.name}`);
    if (urls.length) lines.push(`- Website(s): ${urls.join(', ')}`);
    if (ourIndustries) lines.push(`- Our industries: ${ourIndustries}`);
    if (description) lines.push(`- About us: ${description.slice(0, 400)}`);
    if (services.length) lines.push(`- Our services: ${services.join(', ')}`);
    if (personas.length) lines.push(`- We sell to (target personas): ${personas.join(', ')}`);
    if (industries.length) lines.push(`- Target industries: ${industries.join(', ')}`);
    if (geography.length) lines.push(`- Target geography: ${geography.join(', ')}`);
    if (segment.length) lines.push(`- Target segment: ${segment.join(', ')}`);
    if (keywords.length) lines.push(`- Monitoring keywords: ${keywords.join(', ')}`);
    if (signalTypes.length) lines.push(`- Signal types we care about: ${signalTypes.join(', ')}`);
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

  const usage = await checkUsageLimit(ctx.orgId, 'agent_runs');
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Agent run limit reached. Upgrade your plan. Remaining: ${usage.remaining}` },
      { status: 429 }
    );
  }

  const { query, company, history } = await req.json() as {
    query: string;
    company?: string;
    history?: { role: string; content: string }[];
  };
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const admin = getSupabaseAdmin();
  let savedResearch: { id: string; result: string } | null = null;

  const userMessage = company
    ? `Research ${company} thoroughly. ${query}`
    : query;

  // Load org profile and build a context-aware system prompt
  const orgContext = await buildOrgContext(ctx.orgId);
  const dynamicSystem = orgContext
    ? `${SYSTEM_PROMPT}\n\n${orgContext}`
    : SYSTEM_PROMPT;

  try {
    // agentLoop returns the final text response from the LLM
    // Build message history for multi-turn context
    const priorMessages = (history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const agentFinalText = await agentLoop({
      system: dynamicSystem,
      messages: [...priorMessages, { role: 'user', content: userMessage }],
      tools: VIVEK_TOOLS,
      executeTool: async (name, input) => {
        if (name === 'search_company') {
          const aspect = input.aspect ?? '';
          // For leadership searches, include decision-maker-specific terms
          const q = aspect === 'leadership'
            ? `${input.name} CEO CTO CDO CIO MD "head of technology" "head of digital" leadership team 2024 2025`
            : `${input.name} company ${aspect} India enterprise technology 2025`;
          return await searchWeb(q);
        }

        if (name === 'search_market') {
          return await searchWeb(input.query as string);
        }

        if (name === 'get_existing_signals') {
          const { data } = await admin
            .from('signals')
            .select('title, summary, score, tag, created_at')
            .eq('org_id', ctx.orgId)
            .ilike('company', `%${input.company}%`)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!data || data.length === 0) return 'No existing signals found for this company.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'save_research') {
          const { data, error } = await admin
            .from('research_sessions')
            .insert({
              org_id: ctx.orgId,
              name: input.name,
              query: input.query,
              result: input.result,
            })
            .select('id, result')
            .single();

          if (error) return `Error saving: ${error.message}`;
          savedResearch = data;
          return JSON.stringify({ success: true, session_id: data?.id });
        }

        return 'Unknown tool';
      },
    });

    // Fallback: if LLM didn't call save_research, save the text response directly
    if (!savedResearch && agentFinalText && agentFinalText.length > 50) {
      const { data } = await admin
        .from('research_sessions')
        .insert({
          org_id: ctx.orgId,
          name: `Research: ${query.slice(0, 60)}`,
          query,
          result: agentFinalText,
        })
        .select('id, result')
        .single();

      if (data) savedResearch = data;
    }

    const research = savedResearch as { id: string; result: string } | null;
    return NextResponse.json({
      session_id: research?.id ?? null,
      result: research?.result ?? agentFinalText ?? 'Research completed but no content was returned.',
    });
  } catch (e) {
    console.error('Vivek agent error:', e);
    return NextResponse.json({ error: 'Research agent failed' }, { status: 500 });
  }
}
