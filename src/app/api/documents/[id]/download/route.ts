import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/documents/[id]/download
 * Returns a signed URL for the document's PPTX file (if it exists in storage).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single();

  if (docError || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const path = `${doc.org_id}/documents/${doc.id}.pptx`;
  const admin = getSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from('org-files')
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Download not available (no PPTX generated for this document)' }, { status: 404 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
