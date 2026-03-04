import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';
import { generatePitchPptx } from '@/lib/pptx';

export async function GET() {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { title, type = 'Pitch', content, status = 'Draft', generate_pptx } = body;

  const supabase = await getSupabaseServer();
  const { data: doc, error } = await supabase
    .from('documents')
    .insert({ title, type, content, status, org_id: ctx.orgId, generated_by: 'Varta' })
    .select()
    .single();

  if (error || !doc) return NextResponse.json({ error: error?.message ?? 'Failed to create' }, { status: 500 });

  // Optionally generate a PPTX for pitch/proposal docs
  let downloadUrl: string | null = null;
  if (generate_pptx && content && (type === 'Pitch' || type === 'Proposal')) {
    try {
      const admin = getSupabaseAdmin();
      const buffer = await generatePitchPptx(title, content);
      const path = `${ctx.orgId}/documents/${doc.id}.pptx`;
      await admin.storage.from('org-files').upload(path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      });
      const { data: signed } = await admin.storage
        .from('org-files')
        .createSignedUrl(path, 3600);
      downloadUrl = signed?.signedUrl ?? null;
    } catch (e) {
      console.error('PPTX generation error:', e);
    }
  }

  return NextResponse.json({ ...doc, download_url: downloadUrl }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
