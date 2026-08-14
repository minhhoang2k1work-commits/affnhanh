import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { stepHandlers } from '@/lib/flow/steps';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const project = await db.aIVideoProject.findFirst({ where: { id, userId: user.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await db.aIVideoProject.update({ where: { id: project.id }, data: { status: 'scripting', errorMessage: null } });
    const result = await stepHandlers.llm_script({ videoProjectId: project.id, stepConfig: {} });
    return NextResponse.json({ success: true, script: result.script });
  } catch (error: any) {
    console.error('Error generating script:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
