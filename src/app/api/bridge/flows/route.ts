/**
 * Bridge Flow API — Kết nối AFF Flow Engine (DAG) ↔ AutoCut Workflow
 *
 * Cho phép AutoCut:
 *   - Liệt kê flow templates có sẵn
 *   - Trigger flow execution từ Desktop App
 *   - Theo dõi tiến trình flow runs
 *   - Nhận kết quả khi flow hoàn thành
 *
 * Cho phép AFF:
 *   - Gửi bước (step) cho AutoCut thực hiện (render, TTS local, etc.)
 *   - Nhận callback khi AutoCut hoàn thành bước
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Flow definition chia sẻ giữa AFF và AutoCut */
interface SharedFlowDefinition {
  id: string;
  name: string;
  description: string;
  /** Nguồn gốc: 'aff' (web DAG) hoặc 'autocut' (desktop node-graph) */
  source: 'aff' | 'autocut';
  /** Danh sách bước trong flow */
  steps: SharedFlowStep[];
  /** Flow có thể chạy cross-app không */
  crossAppCapable: boolean;
  /** Metadata */
  metadata: Record<string, unknown>;
}

interface SharedFlowStep {
  id: string;
  name: string;
  /** Loại bước — quyết định app nào thực hiện */
  type: FlowStepType;
  /** App nào thực hiện bước này */
  executor: 'aff' | 'autocut' | 'any';
  /** Dependencies — bước nào phải hoàn thành trước */
  dependsOn: string[];
  /** Cấu hình bước */
  config: Record<string, unknown>;
}

type FlowStepType =
  // AFF-native steps (DAG engine)
  | 'generate_script'       // OpenAI structured output
  | 'generate_storyboard'   // OpenAI continuity storyboard
  | 'generate_video_api'    // Veo/Kling/Runway API
  | 'generate_voice'        // TTS (ElevenLabs/Google/Fish)
  | 'generate_image'        // OpenAI image gen
  | 'assemble_video'        // FFmpeg assembly
  | 'publish_youtube'       // YouTube upload
  | 'scan_product'          // Shopee/TikTok scan
  // AutoCut-native steps (NLE engine)  
  | 'nle_import'            // Import clips vào NLE timeline
  | 'nle_render'            // Render NLE project (high quality)
  | 'flow_browser'          // Google Flow browser automation
  | 'chatgpt_browser'       // ChatGPT browser automation
  | 'tts_local'             // Google TTS local (gTTS)
  // Cross-app steps
  | 'bridge_transfer'       // Chuyển file/data giữa 2 app
  | 'wait_approval';        // Chờ user approve

/**
 * POST /api/bridge/flows
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'list_templates':
        return await handleListTemplates();
      case 'start_flow':
        return await handleStartFlow(body);
      case 'get_run_status':
        return await handleGetRunStatus(body);
      case 'update_step':
        return await handleUpdateStep(body);
      case 'list_active_runs':
        return await handleListActiveRuns();
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Bridge Flows] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Liệt kê flow templates có sẵn — cả AFF native và cross-app
 */
async function handleListTemplates() {
  // Lấy templates từ DB
  const dbTemplates = await db.flowTemplate.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      steps: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  // Map thành shared format
  const templates: SharedFlowDefinition[] = dbTemplates.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description || '',
    source: 'aff' as const,
    steps: mapAffSteps(t.steps as Record<string, unknown>[]),
    crossAppCapable: hasCrossAppSteps(t.steps as Record<string, unknown>[]),
    metadata: { createdAt: t.createdAt },
  }));

  // Thêm preset cross-app templates
  templates.push(
    {
      id: 'cross-app-full-pipeline',
      name: 'Full Pipeline (AFF → AutoCut)',
      description: 'Tạo kịch bản → Storyboard → Video AI → Voiceover → Import NLE → Render chất lượng cao',
      source: 'aff',
      crossAppCapable: true,
      steps: [
        { id: 'script', name: 'Tạo kịch bản', type: 'generate_script', executor: 'aff', dependsOn: [], config: {} },
        { id: 'storyboard', name: 'Tạo storyboard', type: 'generate_storyboard', executor: 'aff', dependsOn: ['script'], config: {} },
        { id: 'video', name: 'Tạo video AI', type: 'generate_video_api', executor: 'aff', dependsOn: ['storyboard'], config: {} },
        { id: 'voice', name: 'Tạo thuyết minh', type: 'generate_voice', executor: 'aff', dependsOn: ['script'], config: {} },
        { id: 'transfer', name: 'Chuyển sang AutoCut', type: 'bridge_transfer', executor: 'any', dependsOn: ['video', 'voice'], config: {} },
        { id: 'nle', name: 'Import vào NLE', type: 'nle_import', executor: 'autocut', dependsOn: ['transfer'], config: {} },
        { id: 'render', name: 'Render chất lượng cao', type: 'nle_render', executor: 'autocut', dependsOn: ['nle'], config: {} },
      ],
      metadata: { preset: true },
    },
    {
      id: 'cross-app-browser-flow',
      name: 'Browser Flow (AutoCut → AFF)',
      description: 'Google Flow browser → Thu thập video → Import AFF → Publish YouTube',
      source: 'autocut',
      crossAppCapable: true,
      steps: [
        { id: 'flow', name: 'Google Flow Automation', type: 'flow_browser', executor: 'autocut', dependsOn: [], config: {} },
        { id: 'transfer', name: 'Chuyển sang AFF', type: 'bridge_transfer', executor: 'any', dependsOn: ['flow'], config: {} },
        { id: 'assemble', name: 'Ghép video', type: 'assemble_video', executor: 'aff', dependsOn: ['transfer'], config: {} },
        { id: 'publish', name: 'Đăng YouTube', type: 'publish_youtube', executor: 'aff', dependsOn: ['assemble'], config: {} },
      ],
      metadata: { preset: true },
    }
  );

  return NextResponse.json({ success: true, templates, count: templates.length });
}

/**
 * Khởi chạy flow run mới
 */
async function handleStartFlow(body: {
  templateId?: string;
  projectId?: string;
  config?: Record<string, unknown>;
}) {
  const { templateId, projectId, config = {} } = body;

  if (!templateId) {
    return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
  }

  // Tìm template
  const template = await db.flowTemplate.findFirst({
    where: { id: templateId },
  });

  if (!template && !templateId.startsWith('cross-app-')) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Tạo flow run
  const flowRun = await db.flowRun.create({
    data: {
      userId: 'system',
      templateId: template?.id || templateId,
      videoProjectId: projectId || null,
      status: 'running',
      startedAt: new Date(),
    } as any,
  });

  return NextResponse.json({
    success: true,
    flowRun: {
      id: flowRun.id,
      flowId: (flowRun as any).flowId || flowRun.templateId,
      status: 'running',
      startedAt: flowRun.startedAt,
    },
  });
}

/**
 * Lấy trạng thái flow run
 */
async function handleGetRunStatus(body: { runId: string }) {
  const { runId } = body;
  if (!runId) {
    return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
  }

  const run = await db.flowRun.findUnique({
    where: { id: runId },
    include: {
      stepRuns: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          stepId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          outputData: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Flow run not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    run: {
      id: run.id,
      flowId: (run as any).flowId || run.templateId,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      steps: run.stepRuns,
    },
  });
}

/**
 * AutoCut cập nhật kết quả bước — khi AutoCut thực hiện xong một bước (render, TTS, etc.)
 */
async function handleUpdateStep(body: {
  runId: string;
  stepId: string;
  status: 'completed' | 'failed' | 'running';
  output?: Record<string, unknown>;
  error?: string;
}) {
  const { runId, stepId, status, output, error: errorMsg } = body;

  if (!runId || !stepId || !status) {
    return NextResponse.json({ error: 'Missing runId, stepId, or status' }, { status: 400 });
  }

  // Tìm hoặc tạo step run
  const existingStep = await db.flowStepRun.findFirst({
    where: { runId, stepId },
  });

  if (existingStep) {
    await db.flowStepRun.update({
      where: { id: existingStep.id },
      data: {
        status,
        completedAt: ['completed', 'failed'].includes(status) ? new Date() : undefined,
        outputData: (output as any) || undefined,
        errorMessage: errorMsg || undefined,
      },
    });
  } else {
    await db.flowStepRun.create({
      data: {
        runId,
        stepId,
        stepName: stepId,
        stepType: 'custom',
        status,
        startedAt: new Date(),
        completedAt: ['completed', 'failed'].includes(status) ? new Date() : undefined,
        outputData: (output as any) || undefined,
        errorMessage: errorMsg || undefined,
      },
    });
  }

  return NextResponse.json({ success: true, runId, stepId, status });
}

/**
 * Lấy danh sách flow runs đang chạy
 */
async function handleListActiveRuns() {
  const runs = await db.flowRun.findMany({
    where: { status: { in: ['running', 'paused'] } },
    include: {
      stepRuns: {
        select: { stepId: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({
    success: true,
    runs: runs.map((r) => ({
      id: r.id,
      flowId: (r as any).flowId || r.templateId,
      status: r.status,
      startedAt: r.startedAt,
      stepsCompleted: r.stepRuns.filter((s) => s.status === 'completed').length,
      stepsTotal: r.stepRuns.length,
    })),
  });
}

/**
 * GET /api/bridge/flows — AutoCut poll cho pending cross-app steps
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const executor = searchParams.get('executor') || 'autocut';

    // Tìm flow step runs đang pending mà AutoCut cần thực hiện
    const pendingSteps = await db.flowStepRun.findMany({
      where: {
        status: 'pending',
        run: { status: 'running' },
      },
      include: {
        run: {
          select: { id: true, templateId: true, videoProjectId: true, inputData: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      pendingSteps: pendingSteps.map((s) => ({
        stepRunId: s.id,
        stepId: s.stepId,
        runId: s.runId,
        flowId: s.run?.templateId,
        projectId: s.run?.videoProjectId,
        config: s.run?.inputData,
      })),
      count: pendingSteps.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---- Helper functions ----

function mapAffSteps(steps: Record<string, unknown>[]): SharedFlowStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((s, i) => ({
    id: (s.id as string) || `step-${i}`,
    name: (s.name as string) || `Step ${i + 1}`,
    type: (s.handler as FlowStepType) || 'generate_script',
    executor: determineExecutor(s.handler as string),
    dependsOn: Array.isArray(s.dependsOn) ? (s.dependsOn as string[]) : [],
    config: (s.config as Record<string, unknown>) || {},
  }));
}

function determineExecutor(handler: string): 'aff' | 'autocut' | 'any' {
  const autocutSteps = ['nle_import', 'nle_render', 'flow_browser', 'chatgpt_browser', 'tts_local'];
  const anySteps = ['bridge_transfer', 'wait_approval'];
  if (autocutSteps.includes(handler)) return 'autocut';
  if (anySteps.includes(handler)) return 'any';
  return 'aff';
}

function hasCrossAppSteps(steps: Record<string, unknown>[]): boolean {
  if (!Array.isArray(steps)) return false;
  return steps.some((s) => {
    const executor = determineExecutor(s.handler as string);
    return executor === 'autocut' || executor === 'any';
  });
}
