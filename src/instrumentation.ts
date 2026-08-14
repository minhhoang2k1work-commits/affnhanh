export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.FLOW_AUTO_START !== 'true') return;

  const { flowQueue } = await import('@/lib/flow/queue');
  await flowQueue.enqueuePendingFlows();
}
