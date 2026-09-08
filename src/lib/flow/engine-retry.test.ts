import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ tx: { flowRun: { findUnique: vi.fn(), updateMany: vi.fn() }, flowStepRun: { updateMany: vi.fn() } } }));
vi.mock('../db', () => ({ db: { $transaction: (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
vi.mock('./steps', () => ({ stepHandlers: {} }));
vi.mock('./templates', () => ({ ensureFlowTemplates: vi.fn() }));
import { FlowEngine } from './engine';
beforeEach(() => { vi.clearAllMocks(); mocks.tx.flowRun.findUnique.mockResolvedValue({status:'failed',inputData:{videoSource:'google_flow',facebook:{channelId:'original'}}}); mocks.tx.flowRun.updateMany.mockResolvedValue({count:1}); });
it('only an explicit retry creates a new external handoff attempt while keeping Page authorization',async()=>{
  await new FlowEngine().retryFlow('run');
  const payload=mocks.tx.flowRun.updateMany.mock.calls[0][0];
  expect(payload.data.inputData).toMatchObject({facebook:{channelId:'original'},handoffAttempt:expect.any(String)});
  expect(mocks.tx.flowStepRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{runId:'run',status:'failed'}}));
});
it('does not reset a running flow and duplicate its paid jobs',async()=>{
  mocks.tx.flowRun.findUnique.mockResolvedValue({status:'running'});
  await expect(new FlowEngine().retryFlow('run')).rejects.toThrow();
  expect(mocks.tx.flowStepRun.updateMany).not.toHaveBeenCalled();
});
it('does not reset steps if another caller already retried the flow',async()=>{
  mocks.tx.flowRun.updateMany.mockResolvedValue({count:0});
  await expect(new FlowEngine().retryFlow('run')).rejects.toThrow();
  expect(mocks.tx.flowStepRun.updateMany).not.toHaveBeenCalled();
});
