import { describe, expect, it } from 'vitest';
import { formatTenantDateTime, getTenantDayRange } from '../src/timezone';

describe('timezone', () => {
  it('getTenantDayRange tra ve 00:00 Asia/Ho_Chi_Minh = 17:00 UTC hom truoc', () => {
    const range = getTenantDayRange('2026-10-29', 'Asia/Ho_Chi_Minh');
    expect(range.startUtc.toISOString()).toBe('2026-10-28T17:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-10-29T17:00:00.000Z');
  });
  it('getTenantDayRange nem loi khi dateStr sai dinh dang', () => {
    expect(() => getTenantDayRange('29/10/2026')).toThrow('INVALID_DATE_STRING');
  });
  it('formatTenantDateTime hien thi theo timezone tenant', () => {
    const date = new Date('2026-10-28T17:00:00.000Z');
    expect(formatTenantDateTime(date, 'Asia/Ho_Chi_Minh')).toContain('29/10/2026');
  });
});
