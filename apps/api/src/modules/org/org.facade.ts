import { Injectable, OnModuleInit } from '@nestjs/common';
import { CORE_MODULES, store, TOGGLEABLE_MODULES, uuid7 } from '../../store.js';
import type { AbilityProvider, ModuleActivationProvider } from '../core/providers.js';
import { abilityProviderRegistry, moduleProviderRegistry } from '../core/providers.js';
import { DomainError } from '../core/domain-error.js';

export const DEFAULT_PERMISSIONS: Array<{ code: string; moduleCode: string }> = [
  { code: 'core.audit.view', moduleCode: 'core' },
  { code: 'core.pin.verify', moduleCode: 'core' },
  { code: 'core.outbox.view', moduleCode: 'core' },
  { code: 'core.auth.login', moduleCode: 'core' },
  { code: 'org.branch.view', moduleCode: 'org' },
  { code: 'org.branch.manage', moduleCode: 'org' },
  { code: 'org.user.view', moduleCode: 'org' },
  { code: 'org.user.manage', moduleCode: 'org' },
  { code: 'org.role.view', moduleCode: 'org' },
  { code: 'org.role.manage', moduleCode: 'org' },
  { code: 'org.module.toggle', moduleCode: 'org' },
  { code: 'org.settings.view', moduleCode: 'org' },
  { code: 'org.settings.manage', moduleCode: 'org' },
  { code: 'org.user.invite', moduleCode: 'org' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ktv: ['core.auth.login', 'org.branch.view'],
  manager: [
    'core.auth.login',
    'core.audit.view',
    'core.pin.verify',
    'org.branch.view',
    'org.branch.manage',
    'org.user.view',
    'org.user.manage',
    'org.role.view',
    'org.settings.view',
    'org.user.invite',
  ],
  owner: DEFAULT_PERMISSIONS.map((p) => p.code),
  receptionist: ['core.auth.login', 'org.branch.view', 'org.user.view'],
};

const ROLE_CONDITIONS: Record<string, Record<string, unknown>> = {
  ktv: { data_scope: 'own_only', mask_customer_phone: true },
  manager: { data_scope: 'current_branch', max_discount_percent: 50, max_refund_amount: null },
  owner: { data_scope: 'all_branches', max_discount_percent: 100, max_refund_amount: null },
  receptionist: { data_scope: 'current_branch', mask_customer_phone: true, max_discount_percent: 10 },
};

@Injectable()
export class OrgFacade implements AbilityProvider, ModuleActivationProvider, OnModuleInit {
  onModuleInit(): void {
    abilityProviderRegistry.current = this;
    moduleProviderRegistry.current = this;
  }

  seedDefaultBranchAndRoles(tenantId: string, spaName: string): { branchId: string; ownerRoleId: string } {
    for (const perm of DEFAULT_PERMISSIONS) {
      if (!store.permissions.find((p) => p.code === perm.code)) store.permissions.push({ ...perm, description: perm.code });
    }
    const branchId = uuid7();
    store.branches.push({
      address: null,
      code: 'main',
      id: branchId,
      isDefault: true,
      name: `${spaName} - Chi nhánh chính`,
      phone: null,
      tenantId,
    });
    let ownerRoleId = '';
    for (const [code, name] of [
      ['owner', 'Chủ spa'],
      ['manager', 'Quản lý'],
      ['receptionist', 'Lễ tân/Thu ngân'],
      ['ktv', 'KTV'],
    ] as const) {
      const roleId = uuid7();
      if (code === 'owner') ownerRoleId = roleId;
      store.roles.push({ code, id: roleId, isSystem: true, name, tenantId });
      for (const permCode of ROLE_PERMISSIONS[code] ?? []) {
        store.rolePermissions.push({
          conditions: ROLE_CONDITIONS[code] ?? {},
          permissionCode: permCode,
          roleId,
          tenantId,
        });
      }
    }
    for (const moduleCode of TOGGLEABLE_MODULES) {
      store.tenantModules.push({ enabled: false, entitled: false, moduleCode, tenantId });
    }
    store.settings.push(
      { key: 'spa.language', tenantId, value: 'vi' },
      { key: 'spa.timezone', tenantId, value: 'Asia/Ho_Chi_Minh' },
      { key: 'spa.bill_language', tenantId, value: 'vi-en' },
    );
    return { branchId, ownerRoleId };
  }

  rolesInBranch(tenantId: string, userId: string, branchId: string): Promise<
    Array<{ conditions: Record<string, unknown>; permissionCodes: string[] }>
  > {
    const links = store.userBranchRoles.filter(
      (r) => r.tenantId === tenantId && r.userId === userId && r.branchId === branchId,
    );
    return Promise.resolve(links.map((link) => {
      const perms = store.rolePermissions.filter(
        (p) => p.tenantId === tenantId && p.roleId === link.roleId,
      );
      const conditions = perms[0]?.conditions ?? {};
      return { conditions, permissionCodes: perms.map((p) => p.permissionCode) };
    }));
  }

  async checkAbility(
    tenantId: string,
    userId: string,
    branchId: string | null,
    permissionCode: string,
  ): Promise<{ allowed: boolean; conditions: Record<string, unknown> }> {
    if (!branchId) return { allowed: false, conditions: {} };
    const roles = await this.rolesInBranch(tenantId, userId, branchId);
    for (const role of roles) {
      if (role.permissionCodes.includes(permissionCode)) {
        return { allowed: true, conditions: role.conditions };
      }
    }
    return { allowed: false, conditions: {} };
  }

  moduleState(
    tenantId: string,
    moduleCode: string,
  ): Promise<{ enabled: boolean; entitled: boolean } | null> {
    if ((CORE_MODULES as readonly string[]).includes(moduleCode)) {
      return Promise.resolve({ enabled: true, entitled: true });
    }
    const rec = store.tenantModules.find(
      (m) => m.tenantId === tenantId && m.moduleCode === moduleCode,
    );
    return Promise.resolve(rec ? { enabled: rec.enabled, entitled: rec.entitled } : null);
  }

  async isModuleActive(tenantId: string, moduleCode: string): Promise<boolean> {
    const state = await this.moduleState(tenantId, moduleCode);
    return state ? state.enabled && state.entitled : false;
  }

  ownersInTenant(tenantId: string): string[] {
    const ownerRoles = store.roles.filter((r) => r.tenantId === tenantId && r.code === 'owner');
    const ownerRoleIds = new Set(ownerRoles.map((r) => r.id));
    return [
      ...new Set(
        store.userBranchRoles
          .filter((r) => r.tenantId === tenantId && ownerRoleIds.has(r.roleId))
          .map((r) => r.userId),
      ),
    ];
  }

  assertNotLastOwner(tenantId: string, userId: string): void {
    const owners = this.ownersInTenant(tenantId);
    if (owners.length <= 1 && owners.includes(userId)) {
      throw new DomainError('LAST_OWNER_PROTECTION');
    }
  }
}
