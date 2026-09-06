import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/bridge/video-exchange
 * Endpoint để AutoCut gửi/nhận video project data với AFF
 *
 * Cho phép:
 * - AutoCut lấy danh sách video clips đã tạo bởi AFF để import vào NLE Editor
 * - AutoCut thông báo video đã render xong để AFF cập nhật trạng thái
 * - Đồng bộ metadata giữa hai hệ thống
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // AutoCut yêu cầu lấy danh sách clips của 1 project để import vào timeline
      case 'get_project_clips': {
        const { projectId } = body;
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const project = await db.aIVideoProject.findUnique({
          where: { id: projectId },
          include: {
            scenes: {
              orderBy: { sceneNumber: 'asc' },
            },
          },
        });

        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          project: {
            affProjectId: project.id,
            title: project.title,
            description: project.productDescription || '',
            style: project.style || '',
            language: project.language || 'vi',
            status: project.status,
            scenes: project.scenes.map((scene) => ({
              index: scene.sceneNumber,
              title: '',
              narration: scene.narration || '',
              visualPrompt: scene.visualPrompt || '',
              duration: scene.duration || 5,
              cameraAngle: scene.cameraAngle || '',
              videoClipPath: scene.videoClipUrl || null,
              voiceoverPath: scene.voiceoverUrl || null,
              referenceImagePath: scene.referenceImageUrl || null,
            })),
            finalVideoPath: project.videoUrl || null,
            thumbnailPath: project.thumbnailUrl || null,
            metadata: {
              productName: project.title || null,
              youtubeVideoId: null,
              googleDriveFileId: null,
            },
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
          },
        });
      }

      // AutoCut thông báo đã render xong video với chất lượng cao
      case 'update_render_result': {
        const { projectId, finalVideoPath, thumbnailPath, renderInfo } = body;
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (finalVideoPath) updateData.videoUrl = finalVideoPath;
        if (thumbnailPath) updateData.thumbnailUrl = thumbnailPath;

        await db.aIVideoProject.update({
          where: { id: projectId },
          data: {
            ...updateData,
            // Lưu thông tin render từ AutoCut vào errorMessage/script hoặc status
            status: 'completed',
          },
        });

        return NextResponse.json({
          success: true,
          message: `Project ${projectId} updated with AutoCut render result`,
        });
      }

      // Lấy danh sách projects sẵn sàng để import vào AutoCut
      case 'list_ready_projects': {
        const { limit = 20, offset = 0 } = body;

        const projects = await db.aIVideoProject.findMany({
          where: {
            status: { in: ['completed', 'generating_video', 'assembling'] },
          },
          select: {
            id: true,
            title: true,
            status: true,
            style: true,
            videoUrl: true,
            thumbnailUrl: true,
            createdAt: true,
            updatedAt: true,
            scenes: { select: { id: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        });

        return NextResponse.json({
          success: true,
          projects: projects.map((p) => ({
            affProjectId: p.id,
            title: p.title,
            status: p.status,
            style: p.style,
            sceneCount: p.scenes.length,
            finalVideoPath: p.videoUrl,
            thumbnailPath: p.thumbnailUrl,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          })),
          total: projects.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Bridge] Video exchange error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
