import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data: collections, error } = await supabase
    .from('kb_collections')
    .select('*, knowledge_chunks(count)')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also get unique source files per collection
  const result = await Promise.all(
    (collections ?? []).map(async (col) => {
      const { data: chunks } = await supabase
        .from('knowledge_chunks')
        .select('source_file')
        .eq('collection_id', col.id)
        .not('source_file', 'is', null);

      const sourceFiles = [...new Set((chunks ?? []).map((c) => c.source_file).filter(Boolean))];
      const chunkCount = (col.knowledge_chunks as Array<{ count: number }> | undefined)?.[0]?.count ?? 0;

      return {
        id: col.id,
        name: col.name,
        org_id: col.org_id,
        created_at: col.created_at,
        chunk_count: chunkCount,
        source_files: sourceFiles,
      };
    })
  );

  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Get source files to clean up from storage
  const { data: chunks } = await admin
    .from('knowledge_chunks')
    .select('source_file')
    .eq('collection_id', id)
    .eq('org_id', ctx.orgId)
    .not('source_file', 'is', null);

  // Delete from storage (best-effort)
  if (chunks && chunks.length > 0) {
    const { data: storageFiles } = await admin.storage
      .from('org-files')
      .list(`${ctx.orgId}/kb`);

    if (storageFiles) {
      const sourceFiles = new Set(chunks.map((c) => c.source_file));
      const toDelete = storageFiles
        .filter((f) => sourceFiles.has(f.name))
        .map((f) => `${ctx.orgId}/kb/${f.name}`);

      if (toDelete.length > 0) {
        await admin.storage.from('org-files').remove(toDelete);
      }
    }
  }

  // Delete collection (cascades to knowledge_chunks via FK)
  const { error } = await admin
    .from('kb_collections')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
