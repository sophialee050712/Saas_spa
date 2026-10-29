// DomainError: service chi nem ma on dinh, khong nem thong diep tieng Viet tu viet.
// Frontend tra ma sang thong diep hien thi (AGENTS muc 4).
export type DomainErrorCode =
  | 'BED_UNDER_MAINTENANCE'
  | 'BOOKING_SLOT_TAKEN'
  | 'CASH_SESSION_REQUIRED'
  | 'COMMISSION_RULE_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_STATUS_TRANSITION'
  | 'MODULE_DISABLED'
  | 'ORDER_IMMUTABLE'
  | 'ORDER_PAYMENT_MISMATCH'
  | 'PACKAGE_EXPIRED_OR_EMPTY'
  | 'PERMISSION_DENIED'
  | 'PIN_LOCKED'
  | 'PIN_OVERRIDE_REQUIRED'
  | 'PREPAID_INSUFFICIENT_BALANCE'
  | 'TENANT_MISMATCH'
  | 'TENANT_SUSPENDED'
  | 'LAST_OWNER_PROTECTION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'ALREADY_EXISTS';

export const DOMAIN_ERROR_HTTP: Record<DomainErrorCode, number> = {
  BED_UNDER_MAINTENANCE: 409,
  BOOKING_SLOT_TAKEN: 409,
  CASH_SESSION_REQUIRED: 422,
  COMMISSION_RULE_INVALID: 422,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_STATUS_TRANSITION: 422,
  MODULE_DISABLED: 403,
  ORDER_IMMUTABLE: 422,
  ORDER_PAYMENT_MISMATCH: 422,
  PACKAGE_EXPIRED_OR_EMPTY: 422,
  PERMISSION_DENIED: 403,
  PIN_LOCKED: 423,
  PIN_OVERRIDE_REQUIRED: 403,
  PREPAID_INSUFFICIENT_BALANCE: 422,
  TENANT_MISMATCH: 403,
  TENANT_SUSPENDED: 403,
  LAST_OWNER_PROTECTION: 422,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  VALIDATION_FAILED: 422,
  ALREADY_EXISTS: 409,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly metadata: Record<string, string>;

  constructor(code: DomainErrorCode, metadata: Record<string, string> = {}) {
    super(code);
    this.code = code;
    this.metadata = metadata;
  }

  toResponse(): { error: { code: DomainErrorCode; details: Record<string, string> } } {
    return { error: { code: this.code, details: this.metadata } };
  }

  httpStatus(): number {
    return DOMAIN_ERROR_HTTP[this.code];
  }
}
