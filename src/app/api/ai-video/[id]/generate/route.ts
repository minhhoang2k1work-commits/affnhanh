import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { FlowEngine } from '@/lib/flow/engine';
import { flowQueue } from '@/lib/flow/queue';
import { DEFAULT_FLOW_TEMPLATE_ID, ensureFlowTemplates } from '@/lib/flow/templates';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const body = await request.json();
    const templateId = body.templateId || DEFAULT_FLOW_TEMPLATE_ID;

    const project = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await ensureFlowTemplates();
    const engine = new FlowEngine();
    let flowRun = await db.flowRun.findUnique({ where: { videoProjectId: project.id }, include: { stepRuns: true } });
    if (!flowRun) {
      flowRun = await engine.startFlow(user.id, templateId, { projectId: project.id }, project.id);
    } else if (flowRun.status === 'failed') {
      await engine.retryFlow(flowRun.id);
      flowRun = (await db.flowRun.findUnique({ where: { id: flowRun.id }, include: { stepRuns: true } }))!;
    } else if (flowRun.status === 'completed') {
      return NextResponse.json({ error: 'Project already has a completed pipeline.' }, { status: 409 });
    }

    await flowQueue.enqueueFlow(flowRun.id);
    
    await db.aIVideoProject.update({
      where: { id: project.id },
      data: { status: 'scripting', errorMessage: null },
    });

    return NextResponse.json({ 
      success: true, 
      flowRunId: flowRun.id, 
      message: 'Pipeline started' 
    });
  } catch (error: any) {
    console.error('Error starting generation pipeline:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
