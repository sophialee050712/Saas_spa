// Interface M00 định nghĩa, M02 cài đặt — tránh phụ thuộc vòng M00 <-> M02.
// Wiring: OrgModule đăng ký implementation vào registry này ở onModuleInit.
export interface AbilityProvider {
  checkAbility(
    tenantId: string,
    userId: string,
    branchId: string | null,
    permissionCode: string,
  ): Promise<{ allowed: boolean; conditions: Record<string, unknown> }>;
  rolesInBranch(
    tenantId: string,
    userId: string,
    branchId: string,
  ): Promise<Array<{ conditions: Record<string, unknown>; permissionCodes: string[] }>>;
}

export interface ModuleActivationProvider {
  isModuleActive(tenantId: string, moduleCode: string): Promise<boolean>;
  moduleState(
    tenantId: string,
    moduleCode: string,
  ): Promise<{ enabled: boolean; entitled: boolean } | null>;
}

export const abilityProviderRegistry: { current: AbilityProvider | null } = { current: null };
export const moduleProviderRegistry: { current: ModuleActivationProvider | null } = {
  current: null,
};
