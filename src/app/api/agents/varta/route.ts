/**
 * Varta — Document Generator Agent
 * Creates pitch decks, proposals, briefs, and case studies using KB context + account signals.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { agentLoop, type AgentTool } from '@/lib/agents';
import { searchKB } from '@/lib/kb';
import { generatePitchPptx } from '@/lib/pptx';
import { checkUsageLimit } from '@/lib/usage';

const SYSTEM_PROMPT = `You are Varta, a document generation agent for B2B IT sales teams.
You create professional, tailored sales documents: pitch decks, proposals, briefs, and case studies.

Document creation process:
1. First, query the knowledge base for company capabilities, case studies, and service info
2. Get any existing signals for the target account
3. Generate the document in structured markdown with ## headings for each section

Document types and their sections:

PITCH DECK (## sections = slides):
## Executive Summary
## About [Client Company]
## Challenges We're Addressing
## Our Solution
## Why Us
## Case Studies & Proof Points
## Implementation Approach
## Investment & Next Steps

PROPOSAL:
## Executive Summary
## Understanding Your Needs
## Proposed Solution
## Technical Approach
## Timeline & Milestones
## Team & Credentials
## Investment
## Terms & Conditions

BRIEF (1-pager):
## Opportunity Overview
## Solution Fit
## Key Differentiators
## Recommended Next Step

CASE STUDY:
## Client Challenge
## Our Approach
## Solution Delivered
## Results & Impact
## Testimonial

After generating the document content, save it using save_document.`;

const VARTA_TOOLS: AgentTool[] = [
  {
    name: 'query_knowledge_base',
    description: 'Search the company knowledge base for relevant information.',
    parameters: {
      query: { type: 'string', description: 'What to search for in the KB (e.g. "case studies fintech", "cloud migration capabilities")' },
    },
    required: ['query'],
  },
  {
    name: 'get_account_signals',
    description: 'Get buying signals for a specific account from the database.',
    parameters: {
      account: { type: 'string', description: 'Account/company name to get signals for' },
    },
    required: ['account'],
  },
  {
    name: 'save_document',
    description: 'Save the generated document to the database.',
    parameters: {
      title: { type: 'string', description: 'Document title' },
      type: { type: 'string', description: 'Document type: Pitch, Proposal, Brief, or Case Study' },
      content: { type: 'string', description: 'Full document content in markdown format' },
      generate_pptx: { type: 'string', description: 'true if this should also be generated as a PPTX file' },
    },
    required: ['title', 'type', 'content'],
  },
];

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const usage = await checkUsageLimit(ctx.orgId, 'documents');
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Document limit reached. Upgrade your plan. Remaining: ${usage.remaining}` },
      { status: 429 }
    );
  }

  const { account, document_type = 'Pitch', instructions } = await req.json();
  if (!account) return NextResponse.json({ error: 'Missing account name' }, { status: 400 });

  const admin = getSupabaseAdmin();
  let savedDoc: { id: string; title: string; download_url?: string } | null = null;

  const userMessage = `Create a ${document_type} document for ${account}.
${instructions ? `Additional instructions: ${instructions}` : ''}
Start by querying the knowledge base for our capabilities and case studies, then get any signals for this account.`;

  try {
    await agentLoop({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: VARTA_TOOLS,
      executeTool: async (name, input) => {
        if (name === 'query_knowledge_base') {
          const results = await searchKB(ctx.orgId, input.query as string, 5);
          if (results.length === 0) return 'No matching knowledge found. Use general industry knowledge.';
          return results.join('\n\n---\n\n');
        }

        if (name === 'get_account_signals') {
          const { data } = await admin
            .from('signals')
            .select('title, summary, score, tag, ai_relevance')
            .eq('org_id', ctx.orgId)
            .ilike('company', `%${input.account}%`)
            .order('score', { ascending: false })
            .limit(5);

          if (!data || data.length === 0) return 'No signals found for this account.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'save_document') {
          const title = input.title as string;
          const type = input.type as string;
          const content = input.content as string;
          const shouldPptx = input.generate_pptx === 'true' || (type === 'Pitch' || type === 'Proposal');

          const { data: doc, error } = await admin
            .from('documents')
            .insert({
              org_id: ctx.orgId,
              title,
              type,
              content,
              status: 'Draft',
              generated_by: 'Varta',
            })
            .select('id, title')
            .single();

          if (error || !doc) return `Error saving: ${error?.message ?? 'Unknown'}`;

          let downloadUrl: string | null = null;
          if (shouldPptx && content) {
            try {
              const buffer = await generatePitchPptx(title, content);
              const path = `${ctx.orgId}/documents/${doc.id}.pptx`;
              await admin.storage.from('org-files').upload(path, buffer, {
                contentType:
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                upsert: true,
              });
              const { data: signed } = await admin.storage
                .from('org-files')
                .createSignedUrl(path, 3600);
              downloadUrl = signed?.signedUrl ?? null;
            } catch (e) {
              console.error('PPTX error:', e);
            }
          }

          savedDoc = { id: doc.id, title: doc.title, download_url: downloadUrl ?? undefined };
          return JSON.stringify({ success: true, document_id: doc.id, download_url: downloadUrl });
        }

        return 'Unknown tool';
      },
    });

    const result = savedDoc as { id: string; title: string; download_url?: string } | null;
    return NextResponse.json({
      document_id: result?.id ?? null,
      title: result?.title ?? null,
      download_url: result?.download_url ?? null,
    });
  } catch (e) {
    console.error('Varta agent error:', e);
    return NextResponse.json({ error: 'Document generation failed' }, { status: 500 });
  }
}
