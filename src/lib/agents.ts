export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

const ALLOWED: LLMProvider[] = ['anthropic', 'openai', 'gemini'];

/** LLM_PROVIDER can be comma-separated (e.g. anthropic,openai,gemini,perplexity). The first valid value is used. */
export function getLLMProvider(): LLMProvider {
  const raw = (process.env.LLM_PROVIDER ?? 'anthropic').trim();
  const first = raw.split(',')[0]?.trim().toLowerCase() ?? 'anthropic';
  return (ALLOWED.includes(first as LLMProvider) ? first : 'anthropic') as LLMProvider;
}

/** Ordered list for fallback: try first, on failure try next (e.g. anthropic then openai then gemini). */
export function getLLMProviderOrder(): LLMProvider[] {
  const raw = (process.env.LLM_PROVIDER ?? 'anthropic').trim();
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ordered: LLMProvider[] = [];
  for (const p of list) {
    if (ALLOWED.includes(p as LLMProvider) && !ordered.includes(p as LLMProvider)) {
      ordered.push(p as LLMProvider);
    }
  }
  return ordered.length ? ordered : ['anthropic'];
}

const PROVIDER = getLLMProvider();

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
  required: string[];
}

// ─── Provider Format Adapters ─────────────────────────────────────────

function toAnthropicTools(tools: AgentTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: 'object', properties: t.parameters, required: t.required },
  }));
}

function toOpenAITools(tools: AgentTool[]) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: t.parameters, required: t.required },
    },
  }));
}

function toGeminiTools(tools: AgentTool[]) {
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: t.parameters, required: t.required },
    })),
  }];
}

// ─── Main Agentic Loop ────────────────────────────────────────────────

export interface AgentLoopOptions {
  system: string;
  messages: { role: string; content: unknown }[];
  tools: AgentTool[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>;
  maxRounds?: number;
  provider?: LLMProvider;
}

export async function agentLoop(opts: AgentLoopOptions): Promise<string> {
  const providers = opts.provider ? [opts.provider] : getLLMProviderOrder();
  let lastErr: Error | null = null;
  for (const provider of providers) {
    try {
      switch (provider) {
        case 'openai':  return await runOpenAILoop(opts);
        case 'gemini':  return await runGeminiLoop(opts);
        default:        return await runAnthropicLoop(opts);
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`[agentLoop] ${provider} failed, trying next provider:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error('No LLM provider available.');
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────

async function runAnthropicLoop({ system, messages, tools, executeTool, maxRounds = 8 }: AgentLoopOptions): Promise<string> {
  let msgs = [...messages];
  for (let i = 0; i < maxRounds; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-5',
        max_tokens: 4096,
        system,
        messages: msgs,
        tools: toAnthropicTools(tools),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const msg = await res.json();

    if (msg.stop_reason === 'end_turn') {
      return (msg.content as Array<{ type: string; text?: string }>)
        .find((b) => b.type === 'text')?.text ?? '';
    }

    if (msg.stop_reason === 'tool_use') {
      msgs.push({ role: 'assistant', content: msg.content });
      const toolCalls = (msg.content as Array<{ type: string; id?: string; name?: string; input?: Record<string, unknown> }>)
        .filter((b) => b.type === 'tool_use');
      const results = await Promise.all(
        toolCalls.map(async (tc) => ({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: await executeTool(tc.name!, tc.input ?? {}),
        }))
      );
      msgs.push({ role: 'user', content: results });
    }
  }
  return 'Agent reached max rounds without final answer.';
}

// ─── OpenAI (GPT-4o) ─────────────────────────────────────────────────

async function runOpenAILoop({ system, messages, tools, executeTool, maxRounds = 8 }: AgentLoopOptions): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const msgs: unknown[] = [{ role: 'system', content: system }, ...messages];

  for (let i = 0; i < maxRounds; i++) {
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: msgs as Parameters<typeof client.chat.completions.create>[0]['messages'],
      tools: toOpenAITools(tools) as Parameters<typeof client.chat.completions.create>[0]['tools'],
    });
    const choice = res.choices[0];
    if (choice.finish_reason === 'stop') return choice.message.content ?? '';
    if (choice.finish_reason === 'tool_calls') {
      msgs.push(choice.message);
      for (const tc of choice.message.tool_calls ?? []) {
        // Cast to the standard tool-call shape (OpenAI union includes a custom variant without .function)
        const call = tc as { id: string; function: { name: string; arguments: string } };
        const result = await executeTool(call.function.name, JSON.parse(call.function.arguments));
        msgs.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }
  }
  return 'Agent reached max rounds without final answer.';
}

// ─── Google Gemini ────────────────────────────────────────────────────

async function runGeminiLoop({ system, messages, tools, executeTool, maxRounds = 8 }: AgentLoopOptions): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: toGeminiTools(tools) as any,
    systemInstruction: system,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content as string }],
  }));
  const chat = model.startChat({ history });
  let lastMessage = (messages.at(-1) as { content: string }).content;

  for (let i = 0; i < maxRounds; i++) {
    const result = await chat.sendMessage(lastMessage);
    const response = result.response;
    const functionCalls = response.functionCalls();
    if (!functionCalls?.length) return response.text();
    const toolResults = await Promise.all(
      functionCalls.map(async (fc) => ({
        functionResponse: {
          name: fc.name,
          response: { result: await executeTool(fc.name, fc.args as Record<string, unknown>) },
        },
      }))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const followup = await chat.sendMessage(toolResults as any);
    if (!followup.response.functionCalls()?.length) return followup.response.text();
    lastMessage = '';
  }
  return 'Agent reached max rounds without final answer.';
}

// ─── Web Search Helper (for Vigil + Vivek) ───────────────────────────

export async function searchWeb(query: string): Promise<string> {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[searchWeb] PERPLEXITY_API_KEY not set — using mock data');
    return generateMockSearchResult(query);
  }
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL ?? 'sonar',
        messages: [{ role: 'user', content: query }],
      }),
    });
    if (!res.ok) {
      console.warn(`[searchWeb] Perplexity returned ${res.status} — using mock data`);
      return generateMockSearchResult(query);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? generateMockSearchResult(query);
  } catch (err) {
    console.warn('[searchWeb] Perplexity fetch failed — using mock data:', err);
    return generateMockSearchResult(query);
  }
}

/**
 * Generates realistic B2B/enterprise mock search results based on query keywords.
 * Used as a graceful fallback when Perplexity is unavailable.
 */
function generateMockSearchResult(query: string): string {
  const q = query.toLowerCase();

  // ── Extract company name hint (first capitalised token or quoted phrase) ──
  const companyMatch = query.match(/["']([^"']+)["']/) ?? query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/);
  const company = companyMatch?.[1] ?? 'the organisation';

  // ── Routing: pick the most specific template ───────────────────────────

  // Funding / investment signals
  if (q.includes('funding') || q.includes('investment') || q.includes('raised') || q.includes('series')) {
    return `[Mock — Perplexity fallback]

${company} recently completed a Series B funding round, raising ₹320 crore (≈ $38 million) led by Sequoia Capital India with participation from Lightspeed and Tiger Global. The funds are earmarked for technology infrastructure modernisation, data platform expansion, and pan-India team growth. CEO commentary indicated plans to double engineering headcount and migrate legacy on-premise systems to cloud infrastructure over the next 18 months.

Sources (simulated): Economic Times Tech (Feb 2025), VCCircle, Startup India Register.`;
  }

  // Hiring / expansion signals
  if (q.includes('hiring') || q.includes('recruitment') || q.includes('headcount') || q.includes('expansion') || q.includes('opening')) {
    return `[Mock — Perplexity fallback]

${company} is actively hiring across technology and operations roles in 2025. LinkedIn job postings show 40+ open positions including Cloud Infrastructure Engineer, Data Engineer (Spark/Databricks), SAP S/4HANA Consultant, and Head of Digital Transformation. The company announced expansion into Pune and Hyderabad with new delivery centres. This hiring surge signals significant IT investment and platform modernisation initiatives in progress.

Sources (simulated): LinkedIn Jobs, Naukri.com, company careers page (Feb 2025).`;
  }

  // Leadership change signals
  if (q.includes('cto') || q.includes('cio') || q.includes('cdo') || q.includes('leadership') || q.includes('appointed') || q.includes('new ceo')) {
    return `[Mock — Perplexity fallback]

${company} appointed Anil Sharma as Chief Technology Officer in January 2025, joining from Wipro where he led the Enterprise Cloud practice. The new CTO has publicly stated priorities around AI/ML adoption, cloud-native modernisation, and building a composable data architecture. Separately, the company onboarded a Chief Digital Officer from McKinsey Digital with a mandate to digitise core operations and customer-facing channels within 24 months.

Sources (simulated): Business Standard, Economic Times CXO Moves (Jan 2025).`;
  }

  // Cloud / technology stack
  if (q.includes('cloud') || q.includes('aws') || q.includes('azure') || q.includes('gcp') || q.includes('infrastructure') || q.includes('technology stack')) {
    return `[Mock — Perplexity fallback]

${company} operates a hybrid cloud environment with primary workloads on AWS (ap-south-1 Mumbai region) and a portion of ERP/finance systems still on-premise. Their stack includes SAP ECC 6.0 (undergoing S/4HANA assessment), Microsoft 365, Salesforce CRM, and an internally built data warehouse on Redshift. The company recently issued an RFP for a Unified Data Platform and has evaluated Databricks, Snowflake, and Azure Synapse. Security and compliance posture is guided by ISO 27001 and RBI digital guidelines.

Sources (simulated): BuiltWith, LinkedIn Tech posts, IT leadership interviews (2024–2025).`;
  }

  // AI / GenAI adoption
  if (q.includes('ai') || q.includes('genai') || q.includes('artificial intelligence') || q.includes('machine learning') || q.includes('llm')) {
    return `[Mock — Perplexity fallback]

${company} launched an internal GenAI task force in Q3 2024, reporting directly to the CTO. Pilot use cases include AI-assisted customer service (co-pilot on agent desktops), document intelligence for KYC/onboarding, and predictive analytics for supply chain. The company has signed an MoU with Microsoft to leverage Azure OpenAI Service and is evaluating vendor partners for responsible AI governance. Budget allocation for AI/ML is reportedly ₹50–80 crore for FY2025–26.

Sources (simulated): YourStory, Inc42, Microsoft Partner Announcement (2024).`;
  }

  // ERP / SAP signals
  if (q.includes('erp') || q.includes('sap') || q.includes('oracle') || q.includes('digital transformation') || q.includes('s/4hana')) {
    return `[Mock — Perplexity fallback]

${company} is in the assessment phase for an ERP modernisation programme. Current systems include SAP ECC 6.0 for finance and procurement (end of mainstream maintenance 2027) and Oracle JD Edwards for manufacturing. A cross-functional steering committee has been formed to evaluate S/4HANA migration vs. cloud-native ERP alternatives. External consultants (Big 4) have been engaged for business case development. Implementation is tentatively scoped for 18–24 months starting Q2 2025.

Sources (simulated): SAP community posts, procurement notices, LinkedIn announcements (2024–2025).`;
  }

  // News / regulatory / pain points
  if (q.includes('regulation') || q.includes('compliance') || q.includes('gdpr') || q.includes('rbi') || q.includes('sebi') || q.includes('penalty') || q.includes('audit')) {
    return `[Mock — Perplexity fallback]

${company} faced a compliance review by SEBI in late 2024 related to data governance practices for customer financial records. The company has since initiated a Data Governance Transformation programme with a mandate to implement unified data lineage, automated PII detection, and real-time audit logging. IT leadership publicly committed to achieving full compliance by December 2025. This regulatory pressure is accelerating cloud migration timelines and creating urgent demand for data management platform investments.

Sources (simulated): SEBI notices, Business Line, CISO India interview (2024).`;
  }

  // Company overview / general research
  if (q.includes('overview') || q.includes('about') || q.includes('profile') || q.includes('revenue') || q.includes('size') || q.includes('employees')) {
    return `[Mock — Perplexity fallback]

${company} is a mid-to-large Indian enterprise with approximately 5,000–15,000 employees and estimated annual revenue of ₹2,000–8,000 crore. The company operates across manufacturing, financial services, and B2B services verticals with offices in Mumbai, Bengaluru, Delhi NCR, and Hyderabad. It is listed on BSE/NSE and has been growing at 15–20% CAGR over the past three years. Key subsidiaries include IT services and digital transformation arms. The company features in NASSCOM's top Indian enterprises list and has an active CSR and sustainability programme.

Sources (simulated): Annual Report 2023–24, Moneycontrol, Prowess IQ database.`;
  }

  // Market trends / industry analysis
  if (q.includes('market') || q.includes('trend') || q.includes('industry') || q.includes('sector') || q.includes('forecast') || q.includes('growth')) {
    return `[Mock — Perplexity fallback]

The Indian enterprise IT market is projected to reach $35 billion by 2027, growing at 12–14% CAGR. Key drivers include cloud adoption (35% of workloads by 2026), GenAI pilot programmes scaling to production (70% of CIOs plan AI budgets >$1M in 2025), and regulatory compliance demands (RBI's cloud framework, DPDP Act 2023). SAP S/4HANA migration and data platform modernisation are top spend categories. Managed services, cybersecurity, and AI/ML consulting are the fastest-growing segments. Mid-market enterprises (₹500–5,000 crore revenue) represent the highest-growth opportunity, driven by digitisation pressure from larger enterprise partners.

Sources (simulated): Gartner India, IDC APeJ, Nasscom Strategic Review 2025.`;
  }

  // Signals / buying intent (Vigil-style)
  if (q.includes('signal') || q.includes('buying') || q.includes('intent') || q.includes('opportunity') || q.includes('rfi') || q.includes('rfp')) {
    return `[Mock — Perplexity fallback]

${company} has shown multiple buying signals in recent months:
1. **RFP issued** for Cloud Managed Services (AWS + Azure) — vendor shortlist in progress (Q1 2025)
2. **Job postings** for 12 cloud/data roles indicate active platform buildout
3. **Leadership change**: New CTO with cloud-first mandate joined January 2025
4. **Event attendance**: CTO spoke at DataCon India 2025 on "AI-ready data infrastructure"
5. **Press release**: Partnership with Microsoft announced for Azure OpenAI pilot
6. **Budget signal**: FY2026 IT capex reportedly up 28% from prior year per industry contacts

Recommended entry point: CTO office / Head of Enterprise Architecture.

Sources (simulated): LinkedIn, company newsroom, industry event programmes (2025).`;
  }

  // ── Generic B2B fallback ───────────────────────────────────────────────
  return `[Mock — Perplexity fallback]

Research results for: "${query}"

${company} is an established Indian enterprise actively investing in digital transformation for FY2025–26. Key findings:

**Technology & Infrastructure**
The organisation operates a hybrid IT environment combining on-premise ERP (SAP ECC / Oracle) with selective cloud adoption on AWS and Azure. Cloud migration is a board-level priority with a dedicated Digital PMO established in 2024.

**AI & GenAI Adoption**
A formal GenAI Centre of Excellence was launched in Q3 2024 with use cases in customer experience, document automation, and predictive analytics. Azure OpenAI and Google Vertex AI are under evaluation.

**Buying Signals**
- Active hiring for cloud, data engineering, and AI/ML roles (40+ open positions)
- IT budget increased by 20–30% YoY for FY2025–26
- New technology leadership with modernisation mandate
- Vendor assessment RFPs expected in Q2 2025 for Data Platform and Managed Cloud

**Recommended Services Alignment**
- Cloud Infrastructure (AWS/Azure migration, FinOps)
- AI/GenAI consulting & implementation
- Data Analytics Platform (Databricks, Snowflake)
- ERP Modernisation (S/4HANA readiness assessment)

Sources (simulated): LinkedIn, company newsroom, industry trackers (2024–2025).`;
}
