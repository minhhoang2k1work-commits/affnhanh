export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs'
    || process.env.NEXT_PHASE === 'phase-production-build'
    || process.env.FLOW_AUTO_START !== 'true'
    || !process.env.DATABASE_URL
  ) return;

  const { flowQueue } = await import('@/lib/flow/queue');
  await flowQueue.enqueuePendingFlows();
}
