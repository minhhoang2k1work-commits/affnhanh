import { describe, expect, it } from 'vitest';
import { buildStepContext } from './context';

describe('buildStepContext', () => {
  it('merges completed outputs in order and keeps namespaced outputs', () => {
    const context = buildStepContext(
      { projectId: 'project-1', scenes: ['input'] },
      [
        { stepId: 'script', outputData: { script: { title: 'Demo' }, scenes: ['storyboard'] } },
        { stepId: 'video', outputData: { scenes: ['rendered'], cost: 1.25 } },
      ],
      { aspectRatio: '9:16' },
    );

    expect(context.projectId).toBe('project-1');
    expect(context.scenes).toEqual(['rendered']);
    expect(context.cost).toBe(1.25);
    expect(context.stepOutputs).toEqual({
      script: { script: { title: 'Demo' }, scenes: ['storyboard'] },
      video: { scenes: ['rendered'], cost: 1.25 },
    });
    expect(context.stepConfig).toEqual({ aspectRatio: '9:16' });
  });

  it('ignores non-object outputs without losing them from stepOutputs', () => {
    const context = buildStepContext(null, [{ stepId: 'raw', outputData: 'done' }]);
    expect(context.stepOutputs).toEqual({ raw: 'done' });
  });
});

