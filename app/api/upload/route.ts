import { put } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// POST with JSON body: generate client token for direct browser upload
// POST with FormData: legacy server-side upload
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  // JSON request = generate client token
  if (contentType.includes('application/json')) {
    try {
      const { filename, contentType: fileContentType } = await request.json();
      const token = await generateClientTokenFromReadWriteToken({
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        pathname: filename,
        allowedContentTypes: [fileContentType || 'video/*'],
      });
      return NextResponse.json({ token });
    } catch (error) {
      console.error('[Upload] Token error:', error);
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }

  // FormData request = server-side upload (fallback)
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
