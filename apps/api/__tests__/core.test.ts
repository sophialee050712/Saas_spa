import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/modules/core/domain-error';
import {
  assertTenantMatch,
  assertTenantWritable,
  extractTenantSlug,
} from '../src/modules/core/tenant-context';
import { checkAbility, checkModuleEnabled, isModuleActive } from '../src/modules/core/guards';
import { SET_TENANT_SQL, TenantPrismaService } from '../src/modules/core/tenant-prisma.service';
import type { DbClient } from '../src/modules/core/tenant-prisma.service';
import type { TenantContext } from '../src/modules/core/tenant-context';
import { decodeJwtPayload, hashSecret, verifySecret } from '../src/modules/core/auth';

const ctx: TenantContext = {
  branchId: null,
  status: 'active',
  tenantId: '11111111-1111-7111-8111-111111111111',
  timezone: 'Asia/Ho_Chi_Minh',
  userId: '22222222-2222-7222-8222-222222222222',
};

describe('tenant guard', () => {
  it('extractTenantSlug lay slug tu subdomain, tra null khi khong khop domain', () => {
    expect(extractTenantSlug('spa-hoi-an.example.com', 'example.com')).toBe('spa-hoi-an');
    expect(extractTenantSlug('example.com', 'example.com')).toBeNull();
    expect(extractTenantSlug('a.b.example.com', 'example.com')).toBeNull();
  });
  it('assertTenantMatch nem TENANT_MISMATCH (403) khi lech', () => {
    expect(() => assertTenantMatch('spa-a', 'spa-b')).toThrow(DomainError);
    try {
      assertTenantMatch('spa-a', 'spa-b');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).httpStatus()).toBe(403);
      expect((error as DomainError).code).toBe('TENANT_MISMATCH');
    }
    expect(() => assertTenantMatch('spa-a', 'spa-a')).not.toThrow();
  });
  it('assertTenantWritable chan store suspended/read_only', () => {
    expect(() => assertTenantWritable('suspended')).toThrow('TENANT_SUSPENDED');
    expect(() => assertTenantWritable('active')).not.toThrow();
  });
  it('guards stub: thieu quyen -> PERMISSION_DENIED, module tat -> MODULE_DISABLED', () => {
    expect(() => checkAbility(['booking.view'], 'booking.create')).toThrow('PERMISSION_DENIED');
    expect(() => checkModuleEnabled(['package'], 'commission')).toThrow('MODULE_DISABLED');
    expect(isModuleActive(true, false)).toBe(false);
    expect(isModuleActive(true, true)).toBe(true);
  });
});

describe('TenantPrismaService', () => {
  it('cau dau tien trong transaction la set_config app.tenant_id', async () => {
    const calls: string[] = [];
    const tx: DbClient = {
      $executeRaw: async (query: string) => {
        calls.push(query);
        return 1;
      },
      $queryRaw: async () => [],
      $transaction: async (fn) => fn(tx),
    };
    const service = new TenantPrismaService(tx);
    const result = await service.withTenant(ctx, async () => 'done');
    expect(result).toBe('done');
    expect(calls[0]).toBe(SET_TENANT_SQL);
  });
});

describe('auth', () => {
  it('hashSecret/verifySecret: dung thi qua, sai thi rot, khong luu secret tran', () => {
    const stored = hashSecret('mat-khau-dai-123');
    expect(stored).not.toContain('mat-khau-dai-123');
    expect(verifySecret('mat-khau-dai-123', stored)).toBe(true);
    expect(verifySecret('sai-mat-khau', stored)).toBe(false);
  });
  it('decodeJwtPayload tra null khi token sai dinh dang hoac sai chu ky (M01: khong con decode-only)', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    const payload = Buffer.from(JSON.stringify({ slug: 'spa-a', sub: 'u1', tenantId: 't1' })).toString('base64url');
    // Token tu tao khong co chu ky JWT_SECRET hop le -> phai bi tu choi.
    expect(decodeJwtPayload(`x.${payload}.y`)).toBeNull();
  });
});
