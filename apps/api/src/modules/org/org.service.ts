import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CORE_MODULES, store, TOGGLEABLE_MODULES, uuid7 } from '../../store.js';
import { hashSecret } from '../core/auth.js';
import { DomainError } from '../core/domain-error.js';
import { CoreService } from '../core/core.service.js';
import { OrgFacade } from './org.facade.js';

export const ALLOWED_SETTINGS = [
  'spa.language',
  'spa.timezone',
  'spa.bill_language',
  'spa.bill_logo_url',
  'spa.bill_address',
  'spa.tax_id',
  'spa.vietqr_account',
  'spa.google_maps_review_url',
] as const;

function publicUser(u: (typeof store.users)[number]): Record<string, unknown> {
  return {
    fullName: u.fullName,
    id: u.id,
    phone: u.phone,
    status: u.status,
    tenantId: u.tenantId,
  };
}

@Injectable()
export class OrgService {
  constructor(
    private readonly facade: OrgFacade,
    private readonly core: CoreService,
  ) {}

  listBranches(tenantId: string): unknown[] {
    return store.branches.filter((b) => b.tenantId === tenantId);
  }

  createBranch(
    tenantId: string,
    actorId: string,
    input: { address?: string; code: string; name: string; phone?: string },
  ): unknown {
    if (store.branches.some((b) => b.tenantId === tenantId && b.code === input.code)) {
      throw new DomainError('ALREADY_EXISTS');
    }
    const branch = {
      address: input.address ?? null,
      code: input.code,
      id: uuid7(),
      isDefault: false,
      name: input.name,
      phone: input.phone ?? null,
      tenantId,
    };
    store.branches.push(branch);
    this.core.audit(tenantId, actorId, 'branch.created', 'branch', branch.id);
    return branch;
  }

  listUsers(tenantId: string): unknown[] {
    return store.users.filter((u) => u.tenantId === tenantId).map(publicUser);
  }

  createUser(
    tenantId: string,
    actorId: string,
    input: { branchId: string; fullName: string; phone: string; roleId: string },
  ): unknown {
    if (store.users.some((u) => u.tenantId === tenantId && u.phone === input.phone)) {
      throw new DomainError('ALREADY_EXISTS');
    }
    const branch = store.branches.find((b) => b.tenantId === tenantId && b.id === input.branchId);
    const role = store.roles.find((r) => r.tenantId === tenantId && r.id === input.roleId);
    if (!branch || !role) throw new DomainError('NOT_FOUND');
    const user = {
      fullName: input.fullName,
      id: uuid7(),
      inviteExpiresAt: null,
      inviteTokenHash: null,
      lockedUntil: null,
      loginFailedCount: 0,
      passwordHash: hashSecret('change-me-123456'),
      phone: input.phone,
      pinFailedCount: 0,
      pinHash: null,
      pinLockedUntil: null,
      status: 'pending',
      tenantId,
    };
    store.users.push(user);
    store.userBranchRoles.push({ branchId: branch.id, roleId: role.id, tenantId, userId: user.id });
    this.core.audit(tenantId, actorId, 'user.created', 'user', user.id);
    return publicUser(user);
  }

  createInvite(
    tenantId: string,
    actorId: string,
    input: { branchId: string; phone: string; roleId: string },
  ): { expiresAt: string; token: string; userId: string } {
    const created = this.createUser(tenantId, actorId, {
      branchId: input.branchId,
      fullName: input.phone,
      phone: input.phone,
      roleId: input.roleId,
    });
    const user = store.users.find((u) => u.id === (created as { id: string }).id);
    if (!user) throw new DomainError('NOT_FOUND');
    const token = uuid7() + uuid7().replace(/-/g, '');
    user.inviteTokenHash = createHash('sha256').update(token).digest('hex');
    user.inviteExpiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    return { expiresAt: user.inviteExpiresAt, token, userId: user.id };
  }

  acceptInvite(token: string, password: string, pin: string): { userId: string } {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = store.users.find((u) => u.inviteTokenHash === hash);
    if (!user || !user.inviteExpiresAt || new Date(user.inviteExpiresAt).getTime() <= Date.now()) {
      throw new DomainError('UNAUTHORIZED');
    }
    user.passwordHash = hashSecret(password);
    user.pinHash = hashSecret(pin);
    user.status = 'active';
    user.inviteTokenHash = null;
    user.inviteExpiresAt = null;
    return { userId: user.id };
  }

  listRoles(tenantId: string): unknown[] {
    return store.roles.filter((r) => r.tenantId === tenantId);
  }

  createRole(
    tenantId: string,
    actorId: string,
    input: { code: string; name: string; permissions: Array<{ conditions?: Record<string, unknown>; permissionCode: string }> },
  ): unknown {
    if (store.roles.some((r) => r.tenantId === tenantId && r.code === input.code)) {
      throw new DomainError('ALREADY_EXISTS');
    }
    const role = { code: input.code, id: uuid7(), isSystem: false, name: input.name, tenantId };
    store.roles.push(role);
    for (const perm of input.permissions) {
      store.rolePermissions.push({
        conditions: perm.conditions ?? {},
        permissionCode: perm.permissionCode,
        roleId: role.id,
        tenantId,
      });
    }
    this.core.audit(tenantId, actorId, 'role.created', 'role', role.id);
    return role;
  }

  updateRolePermissions(
    tenantId: string,
    actorId: string,
    roleId: string,
    permissions: Array<{ conditions?: Record<string, unknown>; permissionCode: string }>,
  ): unknown {
    const role = store.roles.find((r) => r.tenantId === tenantId && r.id === roleId);
    if (!role) throw new DomainError('NOT_FOUND');
    store.rolePermissions = store.rolePermissions.filter(
      (p) => !(p.tenantId === tenantId && p.roleId === roleId),
    );
    for (const perm of permissions) {
      store.rolePermissions.push({
        conditions: perm.conditions ?? {},
        permissionCode: perm.permissionCode,
        roleId,
        tenantId,
      });
    }
    this.core.audit(tenantId, actorId, 'role.permissions.updated', 'role', roleId);
    return role;
  }

  listTenantModules(tenantId: string): unknown[] {
    return store.tenantModules.filter((m) => m.tenantId === tenantId);
  }

  toggleModule(tenantId: string, actorId: string, code: string, enabled: boolean): unknown {
    if ((CORE_MODULES as readonly string[]).includes(code)) {
      throw new DomainError('INVALID_STATUS_TRANSITION', { reason: 'core_module' });
    }
    if (!(TOGGLEABLE_MODULES as readonly string[]).includes(code)) {
      throw new DomainError('NOT_FOUND');
    }
    const rec = store.tenantModules.find((m) => m.tenantId === tenantId && m.moduleCode === code);
    if (!rec) throw new DomainError('NOT_FOUND');
    rec.enabled = enabled;
    this.core.audit(tenantId, actorId, 'module.toggled', 'tenant_module', code);
    return rec;
  }

  getSettings(tenantId: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const s of store.settings.filter((x) => x.tenantId === tenantId)) out[s.key] = s.value;
    return out;
  }

  patchSettings(tenantId: string, actorId: string, patch: Record<string, unknown>): Record<string, unknown> {
    for (const key of Object.keys(patch)) {
      if (!(ALLOWED_SETTINGS as readonly string[]).includes(key)) {
        throw new DomainError('VALIDATION_FAILED', { key });
      }
    }
    for (const [key, value] of Object.entries(patch)) {
      const existing = store.settings.find((s) => s.tenantId === tenantId && s.key === key);
      if (existing) existing.value = value;
      else store.settings.push({ key, tenantId, value });
    }
    this.core.audit(tenantId, actorId, 'settings.updated', 'settings', null);
    return this.getSettings(tenantId);
  }

  removeUserRole(tenantId: string, actorId: string, userId: string, branchId: string, roleId: string): void {
    const role = store.roles.find((r) => r.tenantId === tenantId && r.id === roleId);
    if (role?.code === 'owner') this.facade.assertNotLastOwner(tenantId, userId);
    store.userBranchRoles = store.userBranchRoles.filter(
      (r) => !(r.tenantId === tenantId && r.userId === userId && r.branchId === branchId && r.roleId === roleId),
    );
    this.core.audit(tenantId, actorId, 'user.role.removed', 'user', userId);
  }
}
