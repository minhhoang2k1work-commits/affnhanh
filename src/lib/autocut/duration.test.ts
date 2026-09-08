import { expect, it } from 'vitest';
import { fitSceneDurations } from './duration';
it('preserves exact template length and positive durations', () => {
  expect(fitSceneDurations([8,8,8],20)).toEqual([7,7,6]);
  expect(fitSceneDurations([1,200,NaN],15).reduce((a,b)=>a+b,0)).toBe(15);
  expect(()=>fitSceneDurations([1,1,1],2)).toThrow();
});
