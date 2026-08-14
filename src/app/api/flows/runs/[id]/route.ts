import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { FlowEngine } from '@/lib/flow/engine';
import { flowQueue } from '@/lib/flow/queue';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const run = await db.flowRun.findFirst({
      where: { id, userId: user.id },
      include: {
        template: true,
        stepRuns: { orderBy: { startedAt: 'asc' } },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, run });
  } catch (error: any) {
    console.error('Error fetching flow run:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const body = await request.json();
    const { action } = body;

    const run = await db.flowRun.findFirst({
      where: { id, userId: user.id },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const engine = new FlowEngine();
    let updatedRun;
    switch (action) {
      case 'pause':
        await engine.pauseFlow(run.id);
        break;
      case 'resume':
        await engine.resumeFlow(run.id);
        await flowQueue.enqueueFlow(run.id);
        break;
      case 'cancel':
        await engine.cancelFlow(run.id);
        break;
      case 'retry':
        await engine.retryFlow(run.id);
        await flowQueue.enqueueFlow(run.id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    updatedRun = await db.flowRun.findFirst({
      where: { id: run.id },
      include: { stepRuns: true },
    });

    return NextResponse.json({ success: true, run: updatedRun });
  } catch (error: any) {
    console.error('Error updating flow run:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
