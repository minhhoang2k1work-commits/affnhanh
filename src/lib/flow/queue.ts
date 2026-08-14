import { db } from '@/lib/db';
import { flowEngine } from './engine';

/**
 * Local dispatcher for immediate feedback. State is persisted in Prisma, so a
 * cron/worker can safely resume pending and running flows after a restart.
 */
export class FlowQueue {
  private queue: string[] = [];
  private activeRuns = new Set<string>();
  private readonly maxConcurrent = Number(process.env.FLOW_MAX_CONCURRENT || 2);
  private processing = false;

  async enqueueFlow(runId: string) {
    if (!this.queue.includes(runId) && !this.activeRuns.has(runId)) this.queue.push(runId);
    void this.processQueue();
  }

  async enqueuePendingFlows(limit = 20) {
    const runs = await db.flowRun.findMany({
      where: { status: { in: ['pending', 'running'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const run of runs) await this.enqueueFlow(run.id);
    return runs.length;
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0 && this.activeRuns.size < this.maxConcurrent) {
        const runId = this.queue.shift();
        if (!runId) continue;
        this.activeRuns.add(runId);
        void this.runFlow(runId);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runFlow(runId: string) {
    try {
      await flowEngine.executeFlow(runId);
      const run = await db.flowRun.findUnique({ where: { id: runId }, select: { status: true } });
      if (run && ['pending', 'running'].includes(run.status)) {
        setTimeout(() => void this.runFlow(runId), 5000);
        return;
      }
    } catch (error) {
      console.error(`[FlowQueue] ${runId}:`, error);
    }

    this.activeRuns.delete(runId);
    void this.processQueue();
  }

  getQueueStatus() {
    return { queueLength: this.queue.length, activeRuns: this.activeRuns.size, maxConcurrent: this.maxConcurrent };
  }
}

const globalForFlowQueue = globalThis as unknown as { flowQueue?: FlowQueue };
export const flowQueue = globalForFlowQueue.flowQueue || new FlowQueue();
globalForFlowQueue.flowQueue = flowQueue;
