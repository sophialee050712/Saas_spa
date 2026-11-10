// Giờ/ngày theo timezone của tenant (AGENTS luật 10). Bản mirror của
// staff/domain/tenant-time.ts — mỗi module giữ helper của mình để không
// import domain chéo module.
import { DEFAULT_TIMEZONE, getTenantDayRange } from '@spa-saas/shared';
import { store } from '../../../store.js';

export function tenantTimezone(tenantId: string): string {
  return store.tenantById(tenantId)?.timezone ?? DEFAULT_TIMEZONE;
}

export function dayRange(dateStr: string, tenantId: string): { endUtc: Date; startUtc: Date } {
  return getTenantDayRange(dateStr, tenantTimezone(tenantId));
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}
