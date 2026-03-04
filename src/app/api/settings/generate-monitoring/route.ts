/**
 * POST /api/settings/generate-monitoring
 * Generates suggested monitoring keywords, industries, and signal types
 * based on the org's company profile.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';

type Provider = 'anthropic' | 'openai' | 'gemini';
const PROVIDER = (process.env.LLM_PROVIDER ?? 'anthropic') as Provider;

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
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(prompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return res.choices[0]?.message?.content ?? '';
}

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

async function generateWithLLM(prompt: string): Promise<string> {
  const all: Provider[] = ['anthropic', 'openai', 'gemini'];
  const order: Provider[] = [PROVIDER, ...all.filter(p => p !== PROVIDER)];
  const hasKey: Record<Provider, boolean> = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_AI_API_KEY,
  };
  const callers = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini };
  for (const provider of order) {
    if (!hasKey[provider]) continue;
    try { return await callers[provider](prompt); }
    catch (e) { console.warn(`generate-monitoring: ${provider} failed`, e); }
  }
  throw new Error('No LLM provider available.');
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  // Load the org's company profile for context
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from('organizations')
    .select('name, profile')
    .eq('id', ctx.orgId)
    .single();

  const p = ((org?.profile ?? {}) as Record<string, unknown>);
  const services: string[] = Array.isArray(p.services) ? p.services as string[] : [];
  const targetIndustry: string[] = Array.isArray(p.target_industry) ? p.target_industry as string[] : [];
  const targetPersonas: string[] = Array.isArray(p.target_personas) ? p.target_personas as string[] : [];
  const description = typeof p.description === 'string' ? p.description.slice(0, 500) : '';
  const companyName = org?.name ?? 'our company';

  // Also accept any partial existing rules from client as hints
  const body = await req.json().catch(() => ({})) as {
    existing_keywords?: string[];
    existing_industries?: string[];
    existing_personas?: string[];
  };

  const prompt = `
You are helping configure an AI-powered B2B sales signal monitoring system for a company.

Company: ${companyName}
${description ? `About: ${description}` : ''}
${services.length ? `Services: ${services.join(', ')}` : ''}
${targetIndustry.length ? `Target industries: ${targetIndustry.join(', ')}` : ''}
${targetPersonas.length ? `Target personas: ${targetPersonas.join(', ')}` : ''}
${body.existing_keywords?.length ? `Existing keywords hint: ${body.existing_keywords.join(', ')}` : ''}
${body.existing_industries?.length ? `Existing industries hint: ${body.existing_industries.join(', ')}` : ''}
${body.existing_personas?.length ? `Existing personas hint: ${body.existing_personas.join(', ')}` : ''}

Generate monitoring rules so the system can automatically surface relevant buying signals from news.

Return a JSON object with EXACTLY these fields:
{
  "keywords": ["keyword1", "keyword2", ...],
  "industries": ["industry1", "industry2", ...],
  "personas": ["Job Title 1", "Job Title 2", ...],
  "signal_types": ["signal_type1", ...]
}

Rules:
- keywords: 8-12 specific terms/phrases to monitor in news (e.g. technology terms, business events, product names relevant to what this company sells). Mix broad and specific.
- industries: 4-8 industries from this list only: FMCG, Banking, Healthcare, Retail, Manufacturing, Technology, E-commerce, Automotive, Telecom, Education, Insurance, Pharma, Logistics, Media, Financial Services, Real Estate, Energy, Government
- personas: 4-8 senior job titles this company should track for leadership change signals (e.g. "CIO", "CTO", "CDO", "Head of Digital"). These are the decision-makers most likely to buy what this company sells.
- signal_types: select ALL that apply from: Funding, Expansion, Leadership, Tech Adoption, M&A, Regulatory, Challenges, Business Initiatives

Return ONLY valid JSON. No markdown, no explanation.
`.trim();

  try {
    const text = await generateWithLLM(prompt);
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(clean);
    return NextResponse.json({
      keywords:     Array.isArray(result.keywords)     ? result.keywords     : [],
      industries:   Array.isArray(result.industries)   ? result.industries   : [],
      personas:     Array.isArray(result.personas)     ? result.personas     : [],
      signal_types: Array.isArray(result.signal_types) ? result.signal_types : [],
    });
  } catch (e) {
    console.error('generate-monitoring error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to generate' },
      { status: 500 }
    );
  }
}
