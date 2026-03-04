/**
 * Outreach Message Generator
 * Generates personalised Email / LinkedIn / WhatsApp messages using signal context.
 * Single LLM call — no tools needed.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';

type Channel = 'email' | 'linkedin' | 'whatsapp';

const CHANNEL_PROMPTS: Record<Channel, string> = {
  email: `You are a B2B sales writer. Write a personalised cold outreach EMAIL for the sales rep below.

Format your response as valid JSON with two fields:
{
  "subject": "<compelling subject line, max 60 chars>",
  "message": "<email body, 3 short paragraphs, ends with a specific CTA>"
}

Rules:
- Open with the specific trigger event (the signal)
- Para 1: acknowledge the trigger/signal with a specific detail
- Para 2: briefly introduce the product/service and how it's relevant to THEIR situation
- Para 3: soft CTA asking for a 20-min call — no pressure
- Professional but warm tone. No buzzwords. No "I hope this email finds you well."
- Keep total under 150 words`,

  linkedin: `You are a B2B sales writer. Write a short LinkedIn connection request NOTE.

Format your response as valid JSON:
{ "message": "<the note, max 250 characters>" }

Rules:
- First line: reference the specific trigger (hiring, funding, leadership change, etc.)
- Briefly mention why you're reaching out
- End with a question to open dialogue
- Ultra-concise. No pitching. Human tone. No "I came across your profile."`,

  whatsapp: `You are a B2B sales writer. Write a short WhatsApp introductory message.

Format your response as valid JSON:
{ "message": "<message, max 150 characters>" }

Rules:
- Very conversational, almost informal
- One sentence hook referencing the signal
- One sentence about the value
- End with a simple "?" to invite a reply`,
};

async function callLLM(prompt: string, userContent: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? 'openai';

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 512,
        system: prompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await res.json();
    return (data.content as Array<{ type: string; text?: string }>)
      .find((b) => b.type === 'text')?.text ?? '';
  }

  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: prompt });
    const result = await model.generateContent(userContent);
    return result.response.text();
  }

  // Default: OpenAI
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  });
  return res.choices[0].message.content ?? '';
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { company, title, summary, aiRelevance, services, tag, type } = await req.json() as {
    company: string;
    title: string;
    summary?: string;
    aiRelevance?: string;
    services?: string[];
    tag?: string;
    type: Channel;
  };

  if (!company || !type) {
    return NextResponse.json({ error: 'Missing company or type' }, { status: 400 });
  }

  const validTypes: Channel[] = ['email', 'linkedin', 'whatsapp'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  // Build context for the LLM
  const context = [
    `Company: ${company}`,
    `Signal/Trigger: ${title}`,
    tag ? `Signal type: ${tag}` : '',
    summary ? `Summary: ${summary.slice(0, 300)}` : '',
    aiRelevance ? `Why it's relevant: ${aiRelevance.slice(0, 200)}` : '',
    services?.length ? `Our services relevant to them: ${services.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  try {
    const raw = await callLLM(CHANNEL_PROMPTS[type], context);

    // Parse JSON from LLM response
    let parsed: Record<string, string> = {};
    try {
      // Handle potential markdown code fence wrapping
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw as message
      return NextResponse.json({ message: raw.trim() });
    }

    return NextResponse.json({
      subject: parsed.subject ?? undefined,
      message: parsed.message ?? raw.trim(),
    });
  } catch (err) {
    console.error('[outreach] LLM error:', err);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
