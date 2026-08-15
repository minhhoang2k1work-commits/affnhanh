import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { stepHandlers } from '@/lib/flow/steps';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const project = await db.aIVideoProject.findFirst({ where: { id, userId: user.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.script) return NextResponse.json({ error: 'Project has no script' }, { status: 400 });
    await db.aIVideoProject.update({ where: { id: project.id }, data: { status: 'storyboarding', errorMessage: null } });
    await stepHandlers.llm_storyboard({ videoProjectId: project.id, script: project.script, stepConfig: {} });
    const scenes = await db.aIVideoScene.findMany({ where: { projectId: project.id }, orderBy: { sceneNumber: 'asc' } });
    const updatedProject = await db.aIVideoProject.findUnique({ where: { id: project.id }, select: { storyboard: true } });
    return NextResponse.json({ success: true, scenes, storyboard: updatedProject?.storyboard });
  } catch (error: any) {
    console.error('Error generating storyboard:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
