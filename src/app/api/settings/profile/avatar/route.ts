import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase';

const AVATARS_BUCKET = 'avatars';

/**
 * POST /api/settings/profile/avatar
 * Upload a profile photo. Expects multipart/form-data with field "file" (image).
 * Stores in Supabase Storage bucket "avatars" at {userId}/avatar.{ext}.
 * If the "avatars" bucket does not exist, it is created (public) and the upload is retried.
 */
export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 });
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'webp';
  const path = `${ctx.userId}/avatar.${ext}`;

  const admin = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  let uploadError: { message?: string } | null = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    }).then((r) => r.error);

  if (uploadError) {
    const isBucketMissing = uploadError.message?.includes('Bucket not found') ||
      (uploadError as { statusCode?: string }).statusCode === '404';
    if (isBucketMissing) {
      const { error: createErr } = await admin.storage.createBucket(AVATARS_BUCKET, {
        public: true,
      });
      if (!createErr) {
        uploadError = (await admin.storage.from(AVATARS_BUCKET).upload(path, buffer, {
          contentType: file.type,
          upsert: true,
        })).error;
      }
    }
  }

  if (uploadError) {
    console.error('Avatar upload error:', uploadError);
    return NextResponse.json(
      { error: uploadError.message || 'Upload failed. Ensure bucket "avatars" exists and is public.' },
      { status: 500 }
    );
  }

  const { data: urlData } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const avatar_url = urlData.publicUrl;

  // Return immediately so the client gets 200 + URL without waiting for metadata update.
  // This avoids ECONNRESET/aborted when the connection closes during a slow updateUser.
  const supabase = await getSupabaseServer();
  void supabase.auth.updateUser({ data: { avatar_url } }).then(({ error: updateError }) => {
    if (updateError) console.error('Avatar metadata update failed:', updateError.message);
  });

  return NextResponse.json({ avatar_url });
}
