import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { FlowEngine } from '@/lib/flow/engine';
import { flowQueue } from '@/lib/flow/queue';

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status');

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      db.flowRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          videoProject: { select: { title: true, id: true } },
        },
      }),
      db.flowRun.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      runs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching flow runs:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { templateId, inputData, videoProjectId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const template = await db.flowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const engine = new FlowEngine();
    const runData = await engine.startFlow(
      user.id,
      templateId,
      inputData || {},
      videoProjectId,
    );

    await flowQueue.enqueueFlow(runData.id);

    return NextResponse.json({ success: true, run: runData }, { status: 201 });
  } catch (error: any) {
    console.error('Error starting flow run:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
