import { Injectable } from '@nestjs/common';
import { RESERVED_SLUGS, store, TOGGLEABLE_MODULES, uuid7 } from '../../store.js';
import { hashSecret, signPlatformAccess, totpCode, verifySecret } from '../core/auth.js';
import { DomainError } from '../core/domain-error.js';
import { CoreService } from '../core/core.service.js';
import { OrgFacade } from '../org/org.facade.js';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

@Injectable()
export class PlatformService {
  constructor(
    private readonly org: OrgFacade,
    private readonly core: CoreService,
  ) {}

  seedPlatformAdmin(email: string, password: string, totpSecret: string): void {
    if (store.platformAdmins.some((a) => a.email === email)) return;
    store.platformAdmins.push({
      email,
      id: uuid7(),
      isActive: true,
      passwordHash: hashSecret(password),
      totpSecret,
    });
  }

  adminLogin(email: string, password: string, totp: string): { accessToken: string } {
    const admin = store.platformAdmins.find((a) => a.email === email && a.isActive);
    if (!admin || !verifySecret(password, admin.passwordHash)) {
      throw new DomainError('UNAUTHORIZED');
    }
    // 2FA bắt buộc: mã TOTP 6 số, chấp nhận cửa sổ ±1 bước (30s) để chống lệch giờ.
    const now = Date.now();
    const ok = [-30000, 0, 30000].some((delta) => totpCode(admin.totpSecret, now + delta) === totp);
    if (!ok) throw new DomainError('UNAUTHORIZED');
    return { accessToken: signPlatformAccess(admin.id, admin.email) };
  }

  createStore(input: {
    industryTemplateCode?: string;
    ownerPassword: string;
    ownerPhone: string;
    slug: string;
    spaName: string;
  }): { slug: string; tenantId: string; trialEndsAt: string } {
    const slug = input.slug.toLowerCase();
    if (!SLUG_RE.test(slug) || (RESERVED_SLUGS as readonly string[]).includes(slug)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'slug' });
    }
    if (store.tenants.some((t) => t.slug === slug)) {
      throw new DomainError('ALREADY_EXISTS');
    }
    const plan = store.plans.find((p) => p.code === 'trial' && p.isActive);
    if (!plan) throw new DomainError('NOT_FOUND');
    const tenantId = uuid7();
    const trialEndsAt = new Date(Date.now() + plan.trialDays * 24 * 3600 * 1000).toISOString();
    // Một transaction logic: mọi bước dưới đây đều trên cùng store; nếu một
    // bước ném lỗi thì tenant đã tạo phải được gỡ (rollback thủ công ở đây,
    // trên Postgres thật sẽ là một transaction platform duy nhất).
    try {
      store.tenants.push({
        createdAt: store.now(),
        dbSecretRef: null,
        id: tenantId,
        industryTemplateCode: input.industryTemplateCode ?? null,
        name: input.spaName,
        phone: input.ownerPhone,
        slug,
        status: 'trial',
        timezone: 'Asia/Ho_Chi_Minh',
        updatedAt: store.now(),
      });
      store.subscriptions.push({
        currentPeriodEndsAt: trialEndsAt,
        id: uuid7(),
        planId: plan.id,
        status: 'trial',
        tenantId,
        trialEndsAt,
      });
      const { branchId, ownerRoleId } = this.org.seedDefaultBranchAndRoles(tenantId, input.spaName);
      for (const mod of store.tenantModules.filter((m) => m.tenantId === tenantId)) {
        mod.entitled = plan.allowedModules.includes(mod.moduleCode);
      }
      const owner = {
        fullName: input.spaName,
        id: uuid7(),
        inviteExpiresAt: null,
        inviteTokenHash: null,
        lockedUntil: null,
        loginFailedCount: 0,
        passwordHash: hashSecret(input.ownerPassword),
        phone: input.ownerPhone,
        pinFailedCount: 0,
        pinHash: null,
        pinLockedUntil: null,
        status: 'active',
        tenantId,
      };
      store.users.push(owner);
      store.userBranchRoles.push({ branchId, roleId: ownerRoleId, tenantId, userId: owner.id });
    } catch (error) {
      store.tenants = store.tenants.filter((t) => t.id !== tenantId);
      store.subscriptions = store.subscriptions.filter((s) => s.tenantId !== tenantId);
      store.branches = store.branches.filter((b) => b.tenantId !== tenantId);
      store.roles = store.roles.filter((r) => r.tenantId !== tenantId);
      store.users = store.users.filter((u) => u.tenantId !== tenantId);
      throw error;
    }
    this.core.audit(tenantId, null, 'store.created', 'tenant', tenantId);
    return { slug, tenantId, trialEndsAt };
  }

  listStores(): unknown[] {
    return store.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
    }));
  }

  changeStatus(tenantId: string, status: string, reason: string): unknown {
    void reason;
    const tenant = store.tenantById(tenantId);
    if (!tenant) throw new DomainError('NOT_FOUND');
    if (!['trial', 'active', 'read_only', 'suspended'].includes(status)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'status' });
    }
    tenant.status = status;
    tenant.updatedAt = store.now();
    return { status, tenantId };
  }

  changePlan(tenantId: string, planCode: string): unknown {
    const tenant = store.tenantById(tenantId);
    const plan = store.plans.find((p) => p.code === planCode && p.isActive);
    if (!tenant || !plan) throw new DomainError('NOT_FOUND');
    const sub = store.subscriptions.find((s) => s.tenantId === tenantId);
    if (sub) sub.planId = plan.id;
    for (const mod of store.tenantModules.filter((m) => m.tenantId === tenantId)) {
      mod.entitled = plan.allowedModules.includes(mod.moduleCode);
    }
    return { entitledModules: plan.allowedModules, planCode, tenantId };
  }

  subscription(tenantId: string): unknown {
    const sub = store.subscriptions.find((s) => s.tenantId === tenantId);
    if (!sub) throw new DomainError('NOT_FOUND');
    return { subscription: sub, tenantModules: store.tenantModules.filter((m) => m.tenantId === tenantId) };
  }

  resolveVipConnection(tenantId: string): { dbSecretRef: string | null; useSharedDb: boolean } {
    const tenant = store.tenantById(tenantId);
    if (!tenant) throw new DomainError('NOT_FOUND');
    if (tenant.dbSecretRef) {
      const secretValue = process.env[tenant.dbSecretRef];
      if (!secretValue) {
        // Không fallback lặng lẽ sang DB chung (spec M01, biên VIP).
        throw new DomainError('NOT_FOUND', { reason: 'db_secret_missing' });
      }
      return { dbSecretRef: tenant.dbSecretRef, useSharedDb: false };
    }
    return { dbSecretRef: null, useSharedDb: true };
  }

  get tenantModulesToggleable(): readonly string[] {
    return TOGGLEABLE_MODULES;
  }
}
