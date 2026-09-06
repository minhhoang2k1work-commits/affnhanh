/**
 * Bridge Video Pipeline API — Kết nối AFF Video Project ↔ AutoCut NLE Editor
 *
 * Endpoints:
 *   POST /api/bridge/render - AutoCut nhận job render / AFF gửi job render
 *   GET  /api/bridge/render - Lấy render queue status
 *
 * Flow:
 *   1. AFF tạo video project (scenes, clips, voiceover)
 *   2. AFF gửi render job → AutoCut NLE queue
 *   3. AutoCut render chất lượng cao (FFmpeg + NLE effects)
 *   4. AutoCut callback → AFF update kết quả render
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Format trao đổi giữa AFF scenes → AutoCut NLE timeline */
interface NLETimelineExport {
  projectId: string;
  projectName: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  targetFps: number;
  targetResolution: { width: number; height: number };
  tracks: NLETrack[];
  /** Metadata cho AutoCut NLE */
  metadata: {
    source: 'aff';
    createdAt: string;
    style?: string;
    language?: string;
    productName?: string;
  };
}

interface NLETrack {
  type: 'video' | 'audio' | 'subtitle' | 'effect';
  name: string;
  clips: NLEClip[];
}

interface NLEClip {
  id: string;
  /** Thời điểm bắt đầu trên timeline (giây) */
  startTime: number;
  /** Thời lượng clip (giây) */
  duration: number;
  /** URL nguồn (có thể là local path hoặc URL) */
  sourceUrl: string;
  /** Điểm cắt trong file nguồn */
  inPoint: number;
  outPoint: number;
  /** Metadata bổ sung */
  label?: string;
  sceneNumber?: number;
  /** Video clip properties */
  transform?: {
    scale?: number;
    x?: number;
    y?: number;
    rotation?: number;
    opacity?: number;
  };
  /** Audio properties */
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  /** Transition với clip tiếp theo */
  transition?: {
    type: 'crossfade' | 'dip_to_black' | 'slide' | 'none';
    duration: number;
  };
}

/**
 * POST /api/bridge/render
 *
 * Actions:
 *   - export_timeline: Xuất AFF project → NLE timeline format
 *   - submit_render: AFF gửi render job cho AutoCut
 *   - update_render_status: AutoCut cập nhật tiến trình render
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'export_timeline':
        return await handleExportTimeline(body);
      case 'submit_render':
        return await handleSubmitRender(body);
      case 'update_render_status':
        return await handleUpdateRenderStatus(body);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Bridge Render] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Xuất AFF video project → NLE timeline format cho AutoCut import
 */
async function handleExportTimeline(body: { projectId: string }) {
  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const project = await db.aIVideoProject.findUnique({
    where: { id: projectId },
    include: { scenes: { orderBy: { sceneNumber: 'asc' } } },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const portrait = (project as any).aspectRatio === '9:16';
  let currentTime = 0;

  // Video track — từ các scene clips
  const videoClips: NLEClip[] = [];
  const audioClips: NLEClip[] = [];
  const subtitleClips: NLEClip[] = [];

  for (const scene of project.scenes) {
    const duration = scene.duration || 5;

    // Video clip
    if (scene.videoClipUrl) {
      videoClips.push({
        id: `scene-${scene.sceneNumber}-video`,
        startTime: currentTime,
        duration,
        sourceUrl: scene.videoClipUrl,
        inPoint: 0,
        outPoint: duration,
        label: `Scene ${scene.sceneNumber}`,
        sceneNumber: scene.sceneNumber,
        transition: {
          type: 'crossfade',
          duration: 0.5,
        },
      });
    }

    // Voiceover audio
    if (scene.voiceoverUrl) {
      audioClips.push({
        id: `scene-${scene.sceneNumber}-voice`,
        startTime: currentTime,
        duration,
        sourceUrl: scene.voiceoverUrl,
        inPoint: 0,
        outPoint: duration,
        label: `Narration ${scene.sceneNumber}`,
        sceneNumber: scene.sceneNumber,
        volume: 1.0,
        fadeIn: 0.1,
        fadeOut: 0.2,
      });
    }

    // Subtitle text
    if (scene.narration?.trim()) {
      subtitleClips.push({
        id: `scene-${scene.sceneNumber}-sub`,
        startTime: currentTime,
        duration,
        sourceUrl: '', // Inline text
        inPoint: 0,
        outPoint: duration,
        label: scene.narration.slice(0, 100),
        sceneNumber: scene.sceneNumber,
      });
    }

    currentTime += duration;
  }

  const timeline: NLETimelineExport = {
    projectId: project.id,
    projectName: project.title,
    aspectRatio: ((project as any).aspectRatio as NLETimelineExport['aspectRatio']) || '9:16',
    targetFps: 30,
    targetResolution: {
      width: portrait ? 1080 : 1920,
      height: portrait ? 1920 : 1080,
    },
    tracks: [
      { type: 'video', name: 'V1 — AI Video Clips', clips: videoClips },
      { type: 'audio', name: 'A1 — Voiceover', clips: audioClips },
      { type: 'subtitle', name: 'S1 — Narration', clips: subtitleClips },
    ],
    metadata: {
      source: 'aff',
      createdAt: new Date().toISOString(),
      style: project.style || undefined,
      language: project.language || 'vi',
      productName: project.title,
    },
  };

  return NextResponse.json({ success: true, timeline });
}

/**
 * AFF gửi render job → AutoCut queue
 */
async function handleSubmitRender(body: {
  projectId: string;
  priority?: 'low' | 'normal' | 'high';
  renderSettings?: {
    codec?: string;
    quality?: string;
    resolution?: string;
    fps?: number;
    format?: string;
  };
}) {
  const { projectId, priority = 'normal', renderSettings } = body;

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const project = await db.aIVideoProject.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Lưu render request vào DB (status: pending)
  // AutoCut sẽ poll endpoint này để lấy job
  await db.aIVideoProject.update({
    where: { id: projectId },
    data: {
      status: 'rendering',
    },
  });

  return NextResponse.json({
    success: true,
    renderJob: {
      projectId,
      status: 'pending',
      priority,
      renderSettings: renderSettings || {
        codec: 'h264',
        quality: 'high',
        resolution: '1080p',
        fps: 30,
        format: 'mp4',
      },
      submittedAt: new Date().toISOString(),
    },
  });
}

/**
 * AutoCut cập nhật tiến trình render
 */
async function handleUpdateRenderStatus(body: {
  projectId: string;
  status: 'rendering' | 'completed' | 'failed';
  progress?: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  renderInfo?: Record<string, unknown>;
}) {
  const { projectId, status, progress, outputUrl, thumbnailUrl, error: errorMsg, renderInfo } = body;

  if (!projectId || !status) {
    return NextResponse.json({ error: 'Missing projectId or status' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status };

  if (status === 'completed') {
    if (outputUrl) updateData.videoUrl = outputUrl;
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    updateData.status = 'completed';
  }

  if (status === 'failed' && errorMsg) {
    updateData.errorMessage = errorMsg;
  }

  if (renderInfo) {
    updateData.renderSettings = renderInfo;
  }

  await db.aIVideoProject.update({
    where: { id: projectId },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    projectId,
    status,
    progress,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * GET /api/bridge/render — AutoCut poll cho pending render jobs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    const pendingJobs = await db.aIVideoProject.findMany({
      where: { status: 'rendering' },
      select: {
        id: true,
        title: true,
        style: true,
        language: true,
        updatedAt: true,
        scenes: { select: { id: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      pendingJobs: pendingJobs.map((job) => ({
        projectId: job.id,
        title: job.title,
        aspectRatio: '9:16',
        style: job.style,
        language: job.language,
        sceneCount: job.scenes.length,
        renderSettings: undefined,
        submittedAt: job.updatedAt.toISOString(),
      })),
      count: pendingJobs.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
