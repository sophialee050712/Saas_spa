import { AsyncLocalStorage } from 'node:async_hooks';
import { DomainError } from './domain-error.js';

export interface TenantContext {
  branchId: string | null;
  status: string;
  tenantId: string;
  timezone: string;
  userId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function currentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

// Tach slug tu Host: <slug>.<platformDomain>. Khong lay tenant_id tu body/query/path.
// Header x-tenant-slug chỉ dùng cho test local (không có DNS subdomain thật).
export function extractTenantSlug(host: string, platformDomain: string): string | null {
  const cleanHost = (host.split(':')[0] ?? '').toLowerCase();
  const suffix = `.${platformDomain.toLowerCase()}`;
  if (!cleanHost.endsWith(suffix)) return null;
  const slug = cleanHost.slice(0, cleanHost.length - suffix.length);
  return slug.length > 0 && !slug.includes('.') ? slug : null;
}

export function slugFromHeaders(host: string, headerSlug: string | undefined): string | null {
  if (headerSlug) return headerSlug.toLowerCase();
  return extractTenantSlug(host, process.env.PLATFORM_DOMAIN ?? 'example.com');
}

export function assertTenantMatch(subdomainSlug: string | null, jwtSlug: string | null): void {
  if (subdomainSlug === null || jwtSlug === null || subdomainSlug !== jwtSlug) {
    throw new DomainError('TENANT_MISMATCH');
  }
}

export function assertTenantWritable(status: string): void {
  if (status === 'suspended' || status === 'read_only') {
    throw new DomainError('TENANT_SUSPENDED');
  }
}
