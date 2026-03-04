/**
 * Vaahan — Pipeline Strategist Agent
 * Analyzes the sales pipeline and provides prioritized recommendations.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { agentLoop, type AgentTool } from '@/lib/agents';

const SYSTEM_PROMPT = `You are Vaahan, a pipeline strategy advisor for B2B IT sales teams.
You analyze the sales pipeline, correlate with buying signals, and recommend prioritized actions.

Your analysis framework:
1. **Priority Deals** — Opportunities with recent high-score signals, long time in early stages
2. **At-Risk Deals** — Deals stagnating in later stages, no recent activity
3. **Quick Wins** — Small/medium deals close to closing that need a final push
4. **Signal Opportunities** — Accounts with strong signals but no open opportunity yet

For each recommendation provide:
- The opportunity/account name
- Why it's prioritized (specific signal or pipeline metric)
- Recommended next action (specific, actionable)
- Suggested talking points or email hook

Format output as structured markdown with these four sections.`;

const VAAHAN_TOOLS: AgentTool[] = [
  {
    name: 'get_opportunities',
    description: 'Get all pipeline opportunities with stage and age information.',
    parameters: {
      stage: { type: 'string', description: 'Filter by stage (optional)' },
    },
    required: [],
  },
  {
    name: 'get_hot_signals',
    description: 'Get recent high-score buying signals.',
    parameters: {
      min_score: { type: 'number', description: 'Minimum signal score (default 3.5)' },
      limit: { type: 'number', description: 'Number of signals to return (default 10)' },
    },
    required: [],
  },
  {
    name: 'update_opportunity_stage',
    description: 'Update the stage of an opportunity.',
    parameters: {
      opportunity_id: { type: 'string', description: 'Opportunity ID to update' },
      stage: { type: 'string', description: 'New stage value' },
    },
    required: ['opportunity_id', 'stage'],
  },
];

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { message, update_stage } = await req.json();
  const admin = getSupabaseAdmin();

  const userMessage = message ?? 'Analyze our current pipeline and provide prioritized recommendations. Show priority deals, at-risk deals, quick wins, and signal-based opportunities.';

  try {
    const analysis = await agentLoop({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: VAAHAN_TOOLS,
      executeTool: async (name, input) => {
        if (name === 'get_opportunities') {
          let query = admin
            .from('opportunities')
            .select('id, name, account, stage, owner, industry, people, created_at')
            .eq('org_id', ctx.orgId)
            .order('created_at', { ascending: false });

          if (input.stage) {
            query = query.eq('stage', input.stage as string);
          }

          const { data } = await query;
          if (!data || data.length === 0) return 'No opportunities in pipeline.';

          // Add days-in-stage approximation
          const enriched = data.map((opp) => ({
            ...opp,
            days_since_created: Math.floor(
              (Date.now() - new Date(opp.created_at).getTime()) / 86400000
            ),
          }));

          return JSON.stringify(enriched, null, 2);
        }

        if (name === 'get_hot_signals') {
          const { data } = await admin
            .from('signals')
            .select('company, title, summary, score, tag, ai_relevance, created_at')
            .eq('org_id', ctx.orgId)
            .gte('score', (input.min_score as number) ?? 3.5)
            .order('score', { ascending: false })
            .limit((input.limit as number) ?? 10);

          if (!data || data.length === 0) return 'No hot signals found.';
          return JSON.stringify(data, null, 2);
        }

        if (name === 'update_opportunity_stage' && update_stage) {
          const { error } = await admin
            .from('opportunities')
            .update({ stage: input.stage })
            .eq('id', input.opportunity_id)
            .eq('org_id', ctx.orgId);

          if (error) return `Error updating: ${error.message}`;
          return JSON.stringify({ success: true, updated_id: input.opportunity_id, new_stage: input.stage });
        }

        return 'Tool not available';
      },
    });

    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('Vaahan agent error:', e);
    return NextResponse.json({ error: 'Pipeline agent failed' }, { status: 500 });
  }
}
