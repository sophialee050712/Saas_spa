// Mui gio: luu UTC, cat ngay theo timezone cua tenant (AGENTS luat 10).
// Cam dung new Date().setHours(...) hay DATE(created_at) de loc ngay.
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

type DayParts = { day: string; hour: number; minute: number };

function partsInZone(date: Date, timeZone: string): DayParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const found = new Map(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(found.get('hour'));
  return {
    day: `${found.get('year')}-${found.get('month')}-${found.get('day')}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(found.get('minute')),
  };
}

function partsToUtcMs(parts: DayParts): number {
  return Date.UTC(
    Number(parts.day.slice(0, 4)),
    Number(parts.day.slice(5, 7)) - 1,
    Number(parts.day.slice(8, 10)),
    parts.hour,
    parts.minute,
  );
}

// Tra ve [startUtc, endUtc) cua mot ngay theo timezone tenant.
// dateStr dang YYYY-MM-DD. Asia/Ho_Chi_Minh khong co DST; ham van xu ly
// lech 1 gio neu timezone co DST bang buoc hieu chinh cuoi.
export function getTenantDayRange(
  dateStr: string,
  timeZone: string = DEFAULT_TIMEZONE,
): {
  endUtc: Date;
  startUtc: Date;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('INVALID_DATE_STRING');
  }
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`);
  const probe = partsInZone(utcMidnight, timeZone);
  const startMs = utcMidnight.getTime() - (partsToUtcMs(probe) - utcMidnight.getTime());
  const startUtc = new Date(startMs);
  const check = partsInZone(startUtc, timeZone);
  if (check.hour === 0 && check.minute === 0 && check.day === dateStr) {
    return { endUtc: new Date(startMs + 24 * 3600 * 1000), startUtc };
  }
  const correctedMs = startMs + (check.hour >= 12 ? -1 : 1) * 3600 * 1000;
  return { endUtc: new Date(correctedMs + 24 * 3600 * 1000), startUtc: new Date(correctedMs) };
}

export function formatTenantDateTime(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(date);
}
