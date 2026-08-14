import { NextResponse } from 'next/server';
import { flowQueue } from '@/lib/flow/queue';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const configured = process.env.FLOW_WORKER_SECRET;
  if (!configured) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${configured}`;
}

async function runWorker(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const queued = await flowQueue.enqueuePendingFlows();
  return NextResponse.json({ success: true, queued, queue: flowQueue.getQueueStatus() });
}

export const GET = runWorker;
export const POST = runWorker;
