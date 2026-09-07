import { describe, expect, it } from 'vitest';
import { facebookPermalink, fromVietnamTime, nextQueueSlot, parseSlots, toVietnamTime, validateSchedule } from './schedule';

describe('publishing calendar', () => {
  it('converts Vietnam time independently of the host timezone', () => {
    expect(fromVietnamTime('2026-09-07T09:00').toISOString()).toBe('2026-09-07T02:00:00.000Z');
    expect(toVietnamTime(new Date('2026-09-06T19:00:00Z'))).toBe('2026-09-07T02:00');
    expect(() => fromVietnamTime('2026-02-31T12:00')).toThrow();
    expect(() => fromVietnamTime('2026-09-07T25:00')).toThrow();
  });
  it('selects the next unoccupied slot across midnight and year boundaries', () => {
    const now = new Date('2026-12-31T13:00:00Z');
    const next = nextQueueSlot(['09:00', '19:00'], [new Date('2027-01-01T02:00:00Z')], now);
    expect(next.toISOString()).toBe('2027-01-01T12:00:00.000Z');
    expect(parseSlots(['19:00', '09:00', '09:00'])).toEqual(['09:00', '19:00']);
    expect(() => parseSlots(['25:61'])).toThrow();
  });
  it('rejects past and timezone-free schedules', () => {
    const now = new Date('2026-09-07T00:00:00Z');
    expect(() => validateSchedule('2026-09-07T09:00', now)).toThrow();
    expect(() => validateSchedule('2026-09-06T20:00:00Z', now)).toThrow();
    expect(validateSchedule('2026-09-07T09:00:00+07:00', now).toISOString()).toBe('2026-09-07T02:00:00.000Z');
  });
  it('requires a specific Facebook video, not a page or lookalike host', () => {
    expect(facebookPermalink('https://www.facebook.com/reel/1234567')).toContain('/reel/1234567');
    for (const url of ['https://facebook.com/', 'https://facebook.com.evil.test/reel/123', 'javascript:alert(1)', 'https://u:p@facebook.com/reel/123']) expect(() => facebookPermalink(url)).toThrow();
  });
});
