import { db } from '@/lib/db';
import { stepHandlers } from './steps';
import { buildStepContext } from './context';
import { ensureFlowTemplates } from './templates';

const MAX_RETRIES = 3;
const STALE_STEP_MS = 30 * 60 * 1000;

type TemplateStep = {
  id: string;
  type: string;
  name?: string;
  config?: Record<string, unknown>;
  dependencies?: string[];
};

const PROJECT_STATUS_BY_STEP: Record<string, string> = {
  llm_script: 'scripting',
  llm_storyboard: 'storyboarding',
  generate_image: 'generating_images',
  generate_video: 'generating_video',
  generate_voice: 'generating_voiceover',
  assemble: 'assembling',
  upload_drive: 'archiving',
};

function parseSteps(value: unknown): TemplateStep[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error('Flow template steps must be an array.');
  return parsed as TemplateStep[];
}

export class FlowEngine {
  async startFlow(userId: string, templateId: string, inputData: any, videoProjectId?: string) {
    await ensureFlowTemplates();
    const template = await db.flowTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const stepsDefinition = parseSteps(template.steps);
    if (stepsDefinition.length === 0) throw new Error('Flow template has no steps.');

    return db.flowRun.create({
      data: {
        userId,
        templateId,
        videoProjectId,
        status: 'pending',
        inputData: inputData || {},
        stepRuns: {
          create: stepsDefinition.map((step) => ({
            stepId: step.id,
            stepType: step.type,
            stepName: step.name || step.type,
            status: 'pending',
          })),
        },
      },
      include: { stepRuns: true },
    });
  }

  async executeFlow(runId: string): Promise<void> {
    await this.recoverStaleSteps(runId);

    const initial = await db.flowRun.findUnique({ where: { id: runId } });
    if (!initial || ['completed', 'failed', 'cancelled', 'paused'].includes(initial.status)) return;

    if (initial.status === 'pending') {
      await db.flowRun.updateMany({
        where: { id: runId, status: 'pending' },
        data: { status: 'running', startedAt: initial.startedAt || new Date(), errorMessage: null },
      });
    }

    // Continue until a long-running/retrying step needs the worker to poll again.
    for (;;) {
      const run = await db.flowRun.findUnique({
        where: { id: runId },
        include: { stepRuns: true, template: true },
      });
      if (!run || run.status !== 'running') return;

      const templateSteps = parseSteps(run.template.steps);
      const order = new Map(templateSteps.map((step, index) => [step.id, index]));
      const sortedRuns = [...run.stepRuns].sort(
        (a, b) => (order.get(a.stepId) ?? 999) - (order.get(b.stepId) ?? 999),
      );
      const completedIds = new Set(sortedRuns.filter((step) => step.status === 'completed').map((step) => step.stepId));

      if (sortedRuns.length > 0 && sortedRuns.every((step) => step.status === 'completed')) {
        await this.completeFlow(runId, run.videoProjectId, sortedRuns);
        return;
      }

      const exhausted = sortedRuns.find((step) => step.status === 'failed' && step.retryCount >= MAX_RETRIES);
      if (exhausted) {
        await this.failFlow(runId, run.videoProjectId, exhausted.errorMessage || `${exhausted.stepName} failed`);
        return;
      }

      // A different worker owns the active step.
      if (sortedRuns.some((step) => step.status === 'running')) return;

      const now = Date.now();
      const runnableDefinition = templateSteps.find((definition) => {
        const stepRun = sortedRuns.find((candidate) => candidate.stepId === definition.id);
        if (!stepRun || !['pending', 'failed'].includes(stepRun.status) || stepRun.retryCount >= MAX_RETRIES) return false;
        if (!(definition.dependencies || []).every((dependency) => completedIds.has(dependency))) return false;
        if (stepRun.status === 'failed') {
          const retryAt = stepRun.updatedAt.getTime() + Math.pow(2, stepRun.retryCount) * 1000;
          if (retryAt > now) return false;
        }
        return true;
      });

      if (!runnableDefinition) {
        // A failed step may still be in backoff. The queue/worker will poll it.
        if (sortedRuns.some((step) => step.status === 'failed' && step.retryCount < MAX_RETRIES)) return;
        await this.failFlow(runId, run.videoProjectId, 'Flow dependency deadlock: no runnable step remains.');
        return;
      }

      const stepRun = sortedRuns.find((candidate) => candidate.stepId === runnableDefinition.id)!;
      const claimed = await db.flowStepRun.updateMany({
        where: { id: stepRun.id, status: stepRun.status },
        data: { status: 'running', startedAt: new Date(), errorMessage: null },
      });
      if (claimed.count === 0) return;

      const completedOutputs = sortedRuns
        .filter((step) => step.status === 'completed')
        .map((step) => ({ stepId: step.stepId, outputData: step.outputData }));
      const input = buildStepContext(run.inputData, completedOutputs, runnableDefinition.config);
      input.videoProjectId = run.videoProjectId || undefined;
      input.flowRunId = run.id;

      await db.flowRun.update({ where: { id: run.id }, data: { currentStepId: stepRun.stepId } });
      if (run.videoProjectId && PROJECT_STATUS_BY_STEP[stepRun.stepType]) {
        await db.aIVideoProject.update({
          where: { id: run.videoProjectId },
          data: { status: PROJECT_STATUS_BY_STEP[stepRun.stepType], errorMessage: null },
        });
      }

      const succeeded = await this.executeStep({ ...stepRun, status: 'running' }, input);
      if (!succeeded) return;
    }
  }

  private async executeStep(stepRun: any, input: Record<string, unknown>): Promise<boolean> {
    const startedAt = Date.now();
    try {
      const handler = stepHandlers[stepRun.stepType];
      if (!handler) throw new Error(`Unknown step type: ${stepRun.stepType}`);
      const result = await handler(input);
      await this.handleStepComplete(stepRun.id, input, result, startedAt);
      return true;
    } catch (error: any) {
      await this.handleStepError(stepRun.id, error, startedAt);
      return false;
    }
  }

  private async handleStepComplete(
    stepRunId: string,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
    startedAt: number,
  ) {
    const stepRun = await db.flowStepRun.update({
      where: { id: stepRunId },
      data: {
        status: 'completed',
        inputData: inputData as any,
        outputData: outputData as any,
        completedAt: new Date(),
        duration: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        cost: typeof outputData.cost === 'number' ? outputData.cost : undefined,
        errorMessage: null,
      },
    });
    const [completed, total] = await Promise.all([
      db.flowStepRun.count({ where: { runId: stepRun.runId, status: 'completed' } }),
      db.flowStepRun.count({ where: { runId: stepRun.runId } }),
    ]);
    await db.flowRun.update({
      where: { id: stepRun.runId },
      data: { progress: total ? Math.round((completed / total) * 100) : 0 },
    });
  }

  private async handleStepError(stepRunId: string, error: any, startedAt: number) {
    const stepRun = await db.flowStepRun.findUnique({ where: { id: stepRunId } });
    if (!stepRun) return;
    await db.flowStepRun.update({
      where: { id: stepRunId },
      data: {
        status: 'failed',
        errorMessage: error?.message || String(error),
        retryCount: stepRun.retryCount + 1,
        completedAt: new Date(),
        duration: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      },
    });
  }

  private async completeFlow(runId: string, videoProjectId: string | null, stepRuns: any[]) {
    const completedOutputs = stepRuns.map((step) => ({ stepId: step.stepId, outputData: step.outputData }));
    const run = await db.flowRun.findUnique({ where: { id: runId } });
    const outputData = buildStepContext(run?.inputData, completedOutputs);
    const actualCost = stepRuns.reduce((sum, step) => sum + (step.cost || 0), 0);

    await db.flowRun.update({
      where: { id: runId },
      data: { status: 'completed', completedAt: new Date(), progress: 100, currentStepId: null, outputData: outputData as any },
    });
    if (videoProjectId) {
      await db.aIVideoProject.update({
        where: { id: videoProjectId },
        data: { status: 'completed', actualCost, errorMessage: null },
      });
    }
  }

  private async failFlow(runId: string, videoProjectId: string | null, message: string) {
    await db.flowRun.update({
      where: { id: runId },
      data: { status: 'failed', completedAt: new Date(), currentStepId: null, errorMessage: message },
    });
    if (videoProjectId) {
      await db.aIVideoProject.update({
        where: { id: videoProjectId },
        data: { status: 'failed', errorMessage: message },
      });
    }
  }

  private async recoverStaleSteps(runId: string) {
    const staleBefore = new Date(Date.now() - STALE_STEP_MS);
    const stale = await db.flowStepRun.findMany({
      where: { runId, status: 'running', startedAt: { lt: staleBefore } },
    });
    for (const step of stale) {
      await db.flowStepRun.update({
        where: { id: step.id },
        data: { status: 'failed', retryCount: step.retryCount + 1, errorMessage: 'Worker stopped while this step was running.' },
      });
    }
  }

  async retryStep(stepRunId: string) {
    const stepRun = await db.flowStepRun.findUnique({ where: { id: stepRunId } });
    if (!stepRun) throw new Error('Step not found');
    await db.flowStepRun.update({
      where: { id: stepRunId },
      data: { status: 'pending', retryCount: 0, errorMessage: null, startedAt: null, completedAt: null },
    });
    await db.flowRun.update({
      where: { id: stepRun.runId },
      data: { status: 'pending', completedAt: null, errorMessage: null },
    });
  }

  async retryFlow(runId: string) {
    await db.flowStepRun.updateMany({
      where: { runId, status: 'failed' },
      data: { status: 'pending', retryCount: 0, errorMessage: null, startedAt: null, completedAt: null },
    });
    await db.flowRun.update({
      where: { id: runId },
      data: { status: 'pending', completedAt: null, errorMessage: null, currentStepId: null },
    });
  }

  async pauseFlow(runId: string) {
    await db.flowRun.update({ where: { id: runId }, data: { status: 'paused' } });
  }

  async resumeFlow(runId: string) {
    await db.flowRun.update({ where: { id: runId }, data: { status: 'pending' } });
  }

  async cancelFlow(runId: string) {
    await db.flowRun.update({ where: { id: runId }, data: { status: 'cancelled', completedAt: new Date() } });
  }

  async getFlowProgress(runId: string) {
    const run = await db.flowRun.findUnique({ where: { id: runId }, include: { stepRuns: true } });
    if (!run || run.stepRuns.length === 0) return 0;
    return Math.round((run.stepRuns.filter((step) => step.status === 'completed').length / run.stepRuns.length) * 100);
  }
}

export const flowEngine = new FlowEngine();
