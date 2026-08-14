export interface CompletedStepOutput {
  stepId: string;
  outputData: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build the input for a step from the original run input plus every completed
 * dependency output. Later outputs intentionally override earlier values while
 * the full namespaced output map remains available for debugging.
 */
export function buildStepContext(
  inputData: unknown,
  completedSteps: CompletedStepOutput[],
  stepConfig: unknown = {},
): Record<string, unknown> {
  const context: Record<string, unknown> = isRecord(inputData) ? { ...inputData } : {};
  const stepOutputs: Record<string, unknown> = {};

  for (const step of completedSteps) {
    stepOutputs[step.stepId] = step.outputData;
    if (isRecord(step.outputData)) Object.assign(context, step.outputData);
  }

  return {
    ...context,
    stepOutputs,
    stepConfig: isRecord(stepConfig) ? stepConfig : {},
  };
}

