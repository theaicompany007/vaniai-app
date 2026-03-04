import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addToKB } from '@/lib/kb';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let content = '';
    let sourceFile: string | undefined;
    let collectionName = 'General';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      collectionName = (formData.get('collection') as string) || 'General';
      const file = formData.get('file') as File | null;
      const text = formData.get('text') as string | null;

      if (file) {
        sourceFile = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload raw file to Supabase Storage
        const admin = getSupabaseAdmin();
        const storagePath = `${ctx.orgId}/kb/${Date.now()}-${file.name}`;
        await admin.storage.from('org-files').upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

        // Extract text based on file type
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // pdf-parse ESM build may or may not expose .default — handle both
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfMod = (await import('pdf-parse')) as any;
          const pdfParse = pdfMod.default ?? pdfMod;
          content = (await pdfParse(buffer)).text;
        } else if (
          file.name.endsWith('.docx') ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          const mammoth = await import('mammoth');
          content = (await mammoth.extractRawText({ buffer })).value;
        } else {
          // TXT, MD, or any text file
          content = buffer.toString('utf-8');
        }
      } else if (text) {
        content = text;
        sourceFile = 'Manual entry';
      }
    } else {
      // JSON body
      const body = await req.json();
      content = body.content ?? body.text ?? '';
      collectionName = body.collection ?? 'General';
      sourceFile = body.source_file ?? 'Manual entry';
    }

    if (!content.trim()) {
      return NextResponse.json({ error: 'No content to add' }, { status: 400 });
    }

    const { chunksAdded } = await addToKB(ctx.orgId, collectionName, content, sourceFile);

    return NextResponse.json({
      success: true,
      chunks_added: chunksAdded,
      collection: collectionName,
      source_file: sourceFile,
    });
  } catch (e) {
    console.error('KB add error:', e);
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 });
  }
}
