import { DomainError } from './domain-error.js';

// Stub dung interface cho M01/M02. Khong hard-code if (role === ...) o day:
// quyet dinh quyen thuc te nam o AbilityService (M00, buoc sau), dua tren
// permission_code + conditions JSONB cua role.
// GĐ0: AbilityGuard chi cho phep khi permission co trong danh sach truyen vao;
// ModuleGuard chi cho phep khi module nam trong danh sach dang bat.
export function checkAbility(granted: readonly string[], required: string): void {
  if (!granted.includes(required)) {
    throw new DomainError('PERMISSION_DENIED', { permission: required });
  }
}

export function checkModuleEnabled(enabled: readonly string[], moduleCode: string): void {
  if (!enabled.includes(moduleCode)) {
    throw new DomainError('MODULE_DISABLED', { module: moduleCode });
  }
}

// BR-08: module hoat dong khi entitled (goi cuoc) AND enabled (chu spa bat).
export function isModuleActive(entitled: boolean, enabled: boolean): boolean {
  return entitled && enabled;
}
