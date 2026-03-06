import OpenAI from 'openai';
import { getSupabaseAdmin } from './supabase';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Embedding ────────────────────────────────────────────────────────

export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    input: text.slice(0, 8000), // cap to avoid token limit errors
  });
  return res.data[0].embedding;
}

// ─── Chunking ─────────────────────────────────────────────────────────

function splitIntoChunks(text: string, maxLength = 2000): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + p).length > maxLength && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += p + '\n\n';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 50);
}

// ─── Add to KB ────────────────────────────────────────────────────────

export async function addToKB(
  orgId: string,
  collectionName: string,
  content: string,
  sourceFile?: string
): Promise<{ chunksAdded: number }> {
  const admin = getSupabaseAdmin();

  // Ensure collection exists
  const { data: col, error: colErr } = await admin
    .from('kb_collections')
    .upsert({ org_id: orgId, name: collectionName }, { onConflict: 'org_id,name' })
    .select()
    .single();

  if (colErr || !col) throw new Error(`Failed to create/get collection: ${colErr?.message}`);

  const chunks = splitIntoChunks(content);
  let added = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await embed(chunk);
      await admin.from('knowledge_chunks').insert({
        org_id: orgId,
        collection_id: col.id,
        content: chunk,
        embedding: JSON.stringify(embedding),
        source_file: sourceFile ?? 'Manual entry',
      });
      added++;
    } catch (e) {
      console.error('Failed to embed chunk:', e);
    }
  }

  return { chunksAdded: added };
}

// ─── Search KB ────────────────────────────────────────────────────────

export async function searchKB(
  orgId: string,
  query: string,
  topK = 5
): Promise<string[]> {
  try {
    const admin = getSupabaseAdmin();
    const queryEmbedding = await embed(query);

    const { data, error } = await admin.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_org_id: orgId,
      match_threshold: 0.65,
      match_count: topK,
    });

    if (error) {
      console.error('KB search error:', error);
      return [];
    }

    return (data ?? []).map((r: { content: string }) => r.content);
  } catch (e) {
    console.error('searchKB failed:', e);
    return [];
  }
}
