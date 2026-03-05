import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';

/**
 * POST /api/settings/generate-profile
 * Body: { website_url: string }
 * Returns: { description, industry, services: string[], sales_triggers: [...] }
 *
 * Uses LLM_PROVIDER env var to choose provider (anthropic | openai | gemini).
 * Automatically falls back to the next available provider if the primary is not configured.
 */

type Provider = 'anthropic' | 'openai' | 'gemini';

const PROVIDER = (process.env.LLM_PROVIDER ?? 'anthropic') as Provider;

/** Fetch a URL and return stripped plain text (max ~8000 chars). */
async function scrapeUrl(url: string): Promise<string> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VaniBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Strip script/style blocks, then all HTML tags, collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return text.slice(0, 12000);
  } catch {
    return '';
  }
}

function buildPrompt(website_url: string, pageContent: string) {
  const contentSection = pageContent
    ? `\nHere is the actual text content scraped from the website:\n---\n${pageContent}\n---\n`
    : `\nNote: The website could not be fetched. Use your knowledge of the domain/company if available.\n`;

  return `
You are an AI assistant helping configure a sales intelligence tool for a company. The company can be in any industry (e.g. technology, energy, telecom, reputation management, retail, healthcare, conglomerate).

The user's company website is: ${website_url}
${contentSection}
Based on the above content, extract and return a JSON object with EXACTLY these fields:
{
  "company_name": "Official company name",
  "industry": "Primary industry — use whatever fits the website (e.g. Technology Consulting, Energy, Telecom, Reputation Management, FMCG, Manufacturing, Banking, Hospitality)",
  "description": "REQUIRED: Write EXACTLY 3 full paragraphs separated by \\n\\n. Each paragraph must be 3-5 sentences long.\\nParagraph 1 — Company overview: who they are, founding story or mission, what market problem they solve.\\nParagraph 2 — Products & services: specific named products/platforms, what they do, how they work, key capabilities.\\nParagraph 3 — Target market & differentiation: who they sell to (industries, company sizes, personas), why customers choose them, key outcomes/results they deliver.",
  "services": ["Specific service or product name 1", "Specific service 2", "Specific service 3", "Specific service 4", "Specific service 5", "Specific service 6"],
  "target_personas": ["Job Title 1", "Job Title 2", "Job Title 3", "Job Title 4"],
  "target_industry": ["Industry 1", "Industry 2", "Industry 3", "Industry 4"],
  "sales_triggers": [
    {"category": "CXO Hiring", "description": "Specific trigger relevant to this company's offerings"},
    {"category": "Business Expansion", "description": "Specific trigger relevant to this company's offerings"},
    {"category": "Tech Migration", "description": "Specific trigger relevant to this company's offerings"},
    {"category": "Challenges", "description": "Specific trigger relevant to this company's offerings"},
    {"category": "Business Initiatives", "description": "Specific trigger relevant to this company's offerings"}
  ]
}

CRITICAL RULES:
- description MUST be 3 paragraphs, each 3-5 sentences. Do NOT write a single paragraph.
- services must be specific named offerings from the website (not generic words like "Consulting").
- Return ONLY valid JSON. No markdown fences, no explanation text outside the JSON.
`.trim();
}

// ─── Anthropic ─────────────────────────────────────────────────────────────────
async function callAnthropic(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─── OpenAI ────────────────────────────────────────────────────────────────────
async function callOpenAI(prompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return res.choices[0]?.message?.content ?? '';
}

// ─── Gemini ────────────────────────────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' } as Record<string, unknown>,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── Provider waterfall ────────────────────────────────────────────────────────
async function generateWithLLM(prompt: string): Promise<string> {
  // Build provider order: preferred first, then fallbacks
  const all: Provider[] = ['anthropic', 'openai', 'gemini'];
  const order: Provider[] = [PROVIDER, ...all.filter(p => p !== PROVIDER)];

  const hasKey: Record<Provider, boolean> = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    gemini:    !!process.env.GOOGLE_AI_API_KEY,
  };

  const callers: Record<Provider, (p: string) => Promise<string>> = {
    anthropic: callAnthropic,
    openai:    callOpenAI,
    gemini:    callGemini,
  };

  const errors: string[] = [];
  for (const provider of order) {
    if (!hasKey[provider]) continue;
    try {
      return await callers[provider](prompt);
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : String(e)}`);
      console.warn(`generate-profile: ${provider} failed, trying next`, e);
    }
  }

  throw new Error(
    `All LLM providers failed or unconfigured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY.\n${errors.join('\n')}`
  );
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const hasAny =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY;

  if (!hasAny) {
    return NextResponse.json(
      { error: 'No LLM API key configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY.' },
      { status: 503 }
    );
  }

  // Accept either a single url or an array of urls
  const body = await req.json() as { website_url?: string; website_urls?: string[] };
  const urlList: string[] = body.website_urls?.length
    ? body.website_urls
    : body.website_url
      ? [body.website_url]
      : [];

  if (urlList.length === 0) {
    return NextResponse.json({ error: 'website_url required' }, { status: 400 });
  }

  try {
    // Scrape all URLs in parallel, concatenate content (primary URL first)
    const scraped = await Promise.all(urlList.map(scrapeUrl));
    const combined = scraped
      .map((content, i) => content ? `[${urlList[i]}]\n${content}` : '')
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20000); // cap total context to avoid LLM token overflow

    const text = await generateWithLLM(buildPrompt(urlList[0], combined));
    // Strip markdown code fences if the model added them despite instructions
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (e) {
    console.error('generate-profile error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to generate profile' },
      { status: 500 }
    );
  }
}
