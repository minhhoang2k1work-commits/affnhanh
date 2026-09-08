/** Allocate whole seconds without changing scene order or exceeding the target. */
export function fitSceneDurations(values: number[], target: number) {
  if (!Number.isInteger(target) || target < values.length || values.length === 0) throw new Error('Storyboard có quá nhiều cảnh so với thời lượng.');
  const weights = values.map(v => Number.isFinite(v) && v > 0 ? v : 1);
  const sum = weights.reduce((a,b) => a+b,0);
  const extra = target - values.length;
  const exact = weights.map(v => extra * v / sum);
  const result = exact.map(v => 1 + Math.floor(v));
  let remaining = target - result.reduce((a,b) => a+b,0);
  const order = exact.map((v,i) => ({i,fraction:v-Math.floor(v)})).sort((a,b) => b.fraction-a.fraction);
  for (const {i} of order) { if (remaining-- <= 0) break; result[i]++; }
  return result;
}
