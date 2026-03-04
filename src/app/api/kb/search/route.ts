import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { searchKB } from '@/lib/kb';

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { query, top_k = 5 } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  try {
    const results = await searchKB(ctx.orgId, query, top_k);
    return NextResponse.json({ results, count: results.length });
  } catch (e) {
    console.error('KB search error:', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
