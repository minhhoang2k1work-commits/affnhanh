import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { changePost } from '@/lib/publishing/manager';
import { publishingFailure } from '@/lib/publishing/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser();
    await changePost(user.id, (await params).id, await request.json());
    return NextResponse.json({ success: true });
  } catch (error) { return publishingFailure(error); }
}
