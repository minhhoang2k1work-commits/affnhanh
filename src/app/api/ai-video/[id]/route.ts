import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const project = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
      include: {
        scenes: { orderBy: { sceneNumber: 'asc' } },
        flowRun: {
          include: { stepRuns: { orderBy: { startedAt: 'asc' } } }
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const driveRecord = await db.video.findFirst({
      where: { userId: user.id, platform: 'GOOGLE_DRIVE', note: { contains: project.id } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({
      success: true,
      project: {
        ...project,
        storage: {
          googleDrive: driveRecord?.targetUrl
            ? { url: driveRecord.targetUrl, recordId: driveRecord.id, savedAt: driveRecord.updatedAt }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const body = await request.json();
    
    const existing = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updated = await db.aIVideoProject.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    
    const existing = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await db.aIVideoProject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
