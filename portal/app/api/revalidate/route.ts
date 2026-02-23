import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/source';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  const expectedSecret = process.env.REVALIDATE_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  let body: { repo?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — revalidate everything
  }

  invalidateCache();

  revalidatePath('/', 'layout');
  revalidatePath('/docs', 'layout');

  if (body.repo) {
    const slug = body.repo
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    revalidatePath(`/docs/${slug}`, 'layout');
  }

  return NextResponse.json({
    revalidated: true,
    now: Date.now(),
    repo: body.repo ?? 'all',
  });
}
