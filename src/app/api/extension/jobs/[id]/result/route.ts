import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/extension/jobs/[id]/result'>,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const job = await db.extensionJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'Extension job not found' }, { status: 404 });

    const error = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : null;
    const result = body.result == null ? null : JSON.stringify(body.result);
    await db.extensionJob.update({
      where: { id },
      data: {
        status: error ? 'failed' : 'completed',
        result,
        errorMessage: error,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to update extension job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
