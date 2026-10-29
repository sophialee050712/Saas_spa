// In-memory store cho M01/M02 khi chưa có Postgres thật.
// Đây là lớp thay thế tạm cho Prisma repository: mọi truy vấn đều lọc theo
// tenantId lấy từ TenantContext, không bao giờ nhận tenantId từ body/query.
// Khi có Postgres thật, store này được thay bằng Prisma adapter mà không đổi
// interface của service (xem packages/db migration 0003).
import { randomUUID } from 'node:crypto';

export function uuid7(): string {
  return randomUUID();
}

export interface TenantRecord {
  createdAt: string;
  dbSecretRef: string | null;
  id: string;
  industryTemplateCode: string | null;
  name: string;
  phone: string;
  slug: string;
  status: string;
  timezone: string;
  updatedAt: string;
}

export interface PlanRecord {
  allowedModules: string[];
  code: string;
  id: string;
  isActive: boolean;
  name: string;
  trialDays: number;
}

export interface SubscriptionRecord {
  currentPeriodEndsAt: string | null;
  id: string;
  planId: string;
  status: string;
  tenantId: string;
  trialEndsAt: string | null;
}

export interface PlatformAdminRecord {
  email: string;
  id: string;
  isActive: boolean;
  passwordHash: string;
  totpSecret: string;
}

export interface BranchRecord {
  address: string | null;
  code: string;
  id: string;
  isDefault: boolean;
  name: string;
  phone: string | null;
  tenantId: string;
}

export interface TenantModuleRecord {
  enabled: boolean;
  entitled: boolean;
  moduleCode: string;
  tenantId: string;
}

export interface UserRecord {
  fullName: string;
  id: string;
  inviteExpiresAt: string | null;
  inviteTokenHash: string | null;
  lockedUntil: string | null;
  loginFailedCount: number;
  passwordHash: string;
  phone: string;
  pinFailedCount: number;
  pinHash: string | null;
  pinLockedUntil: string | null;
  status: string;
  tenantId: string;
}

export interface RoleRecord {
  code: string;
  id: string;
  isSystem: boolean;
  name: string;
  tenantId: string;
}

export interface PermissionRecord {
  code: string;
  description: string;
  moduleCode: string;
}

export interface RolePermissionRecord {
  conditions: Record<string, unknown>;
  permissionCode: string;
  roleId: string;
  tenantId: string;
}

export interface UserBranchRoleRecord {
  branchId: string;
  roleId: string;
  tenantId: string;
  userId: string;
}

export interface SettingRecord {
  key: string;
  tenantId: string;
  value: unknown;
}

export interface AuditRecord {
  action: string;
  actorUserId: string | null;
  after: unknown;
  before: unknown;
  createdAt: string;
  entityId: string | null;
  entityType: string;
  id: string;
  tenantId: string;
}

export interface IdempotencyRecord {
  endpoint: string;
  key: string;
  requestHash: string;
  response: unknown;
  status: string;
  tenantId: string;
  userId: string;
}

export interface RefreshTokenRecord {
  expiresAt: string;
  tenantId: string | null;
  tokenHash: string;
  userId: string;
}

export interface OutboxRecord {
  createdAt: string;
  eventType: string;
  id: string;
  payload: Record<string, string>;
  status: string;
  tenantId: string;
}

export const TOGGLEABLE_MODULES = [
  'package',
  'commission',
  'einvoice',
  'inventory',
  'notify',
  'online_booking',
] as const;

export const CORE_MODULES = [
  'core',
  'platform',
  'org',
  'catalog',
  'facility',
  'customer',
  'staff',
  'booking',
  'sales',
  'cashier',
  'receipt',
  'report',
] as const;

export const RESERVED_SLUGS = [
  'admin',
  'api',
  'www',
  'platform',
  'app',
  'support',
  'login',
  'signup',
  'webgool',
] as const;

export class Store {
  audit: AuditRecord[] = [];
  branches: BranchRecord[] = [];
  idempotency: IdempotencyRecord[] = [];
  outbox: OutboxRecord[] = [];
  permissions: PermissionRecord[] = [];
  plans: PlanRecord[] = [];
  platformAdmins: PlatformAdminRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];
  rolePermissions: RolePermissionRecord[] = [];
  roles: RoleRecord[] = [];
  settings: SettingRecord[] = [];
  subscriptions: SubscriptionRecord[] = [];
  tenantModules: TenantModuleRecord[] = [];
  tenants: TenantRecord[] = [];
  userBranchRoles: UserBranchRoleRecord[] = [];
  users: UserRecord[] = [];

  constructor() {
    this.plans.push({
      allowedModules: [...TOGGLEABLE_MODULES],
      code: 'trial',
      id: uuid7(),
      isActive: true,
      name: 'Trial',
      trialDays: 14,
    });
  }

  now(): string {
    return new Date().toISOString();
  }

  tenantBySlug(slug: string): TenantRecord | undefined {
    return this.tenants.find((t) => t.slug === slug);
  }

  tenantById(id: string): TenantRecord | undefined {
    return this.tenants.find((t) => t.id === id);
  }
}

export const store = new Store();
