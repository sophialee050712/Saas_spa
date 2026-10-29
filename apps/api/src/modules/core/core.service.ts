import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { store, uuid7 } from '../../store.js';
import { hashSecret, newRefreshToken, signAccess, verifyJwt, verifySecret } from './auth.js';
import { DomainError } from './domain-error.js';
import { abilityProviderRegistry } from './providers.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const PIN_WINDOW_MS = 15 * 60 * 1000;

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

@Injectable()
export class CoreService {
  audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    before: unknown = null,
    after: unknown = null,
  ): void {
    store.audit.push({
      action,
      actorUserId,
      after,
      before,
      createdAt: store.now(),
      entityId,
      entityType,
      id: uuid7(),
      tenantId,
    });
  }

  checkIdempotency(
    tenantId: string,
    userId: string,
    key: string | undefined,
    endpoint: string,
    requestHash: string,
  ): unknown {
    if (!key) return null;
    const found = store.idempotency.find(
      (r) => r.tenantId === tenantId && r.userId === userId && r.key === key,
    );
    if (!found) {
      store.idempotency.push({
        endpoint,
        key,
        requestHash,
        response: null,
        status: 'pending',
        tenantId,
        userId,
      });
      return null;
    }
    if (found.requestHash !== requestHash) throw new DomainError('IDEMPOTENCY_CONFLICT');
    return found.response;
  }

  saveIdempotency(tenantId: string, userId: string, key: string | undefined, response: unknown): void {
    if (!key) return;
    const found = store.idempotency.find(
      (r) => r.tenantId === tenantId && r.userId === userId && r.key === key,
    );
    if (found) {
      found.response = response;
      found.status = 'done';
    }
  }

  login(tenantId: string, phone: string, password: string): {
    accessToken: string;
    branchIds: string[];
    refreshToken: string;
    tenantId: string;
    userId: string;
  } {
    const user = store.users.find((u) => u.tenantId === tenantId && u.phone === phone);
    const tenant = store.tenantById(tenantId);
    if (!tenant) throw new DomainError('NOT_FOUND');
    if (!user || user.status !== 'active') throw new DomainError('UNAUTHORIZED');
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw new DomainError('UNAUTHORIZED', { reason: 'locked' });
    }
    if (!verifySecret(password, user.passwordHash)) {
      user.loginFailedCount += 1;
      if (user.loginFailedCount >= 10) {
        user.lockedUntil = new Date(Date.now() + LOGIN_WINDOW_MS).toISOString();
        user.loginFailedCount = 0;
        this.audit(tenantId, user.id, 'auth.locked', 'user', user.id);
      }
      throw new DomainError('UNAUTHORIZED');
    }
    user.loginFailedCount = 0;
    user.lockedUntil = null;
    const branchIds = store.userBranchRoles
      .filter((r) => r.tenantId === tenantId && r.userId === user.id)
      .map((r) => r.branchId);
    const accessToken = signAccess({ branchIds, slug: tenant.slug, sub: user.id, tenantId });
    const refreshToken = newRefreshToken();
    store.refreshTokens.push({
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      tenantId,
      tokenHash: sha256(refreshToken),
      userId: user.id,
    });
    return { accessToken, branchIds, refreshToken, tenantId, userId: user.id };
  }

  refresh(oldToken: string): { accessToken: string; refreshToken: string } {
    const rec = store.refreshTokens.find((r) => r.tokenHash === sha256(oldToken));
    if (!rec || new Date(rec.expiresAt).getTime() <= Date.now()) {
      throw new DomainError('UNAUTHORIZED');
    }
    // Quay vòng: refresh cũ vô hiệu ngay.
    store.refreshTokens = store.refreshTokens.filter((r) => r.tokenHash !== rec.tokenHash);
    const user = store.users.find((u) => u.id === rec.userId);
    const tenant = rec.tenantId ? store.tenantById(rec.tenantId) : undefined;
    if (!user || !tenant) throw new DomainError('UNAUTHORIZED');
    const branchIds = store.userBranchRoles
      .filter((r) => r.tenantId === tenant.id && r.userId === user.id)
      .map((r) => r.branchId);
    const refreshToken = newRefreshToken();
    store.refreshTokens.push({
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      tenantId: tenant.id,
      tokenHash: sha256(refreshToken),
      userId: user.id,
    });
    return {
      accessToken: signAccess({ branchIds, slug: tenant.slug, sub: user.id, tenantId: tenant.id }),
      refreshToken,
    };
  }

  verifyPin(
    tenantId: string,
    approverUserId: string,
    branchId: string,
    pin: string,
    permissionCode: string,
  ): { approvedAt: string; approvedByUserId: string } {
    const approver = store.users.find((u) => u.tenantId === tenantId && u.id === approverUserId);
    if (!approver || !approver.pinHash) throw new DomainError('PERMISSION_DENIED');
    if (approver.pinLockedUntil && new Date(approver.pinLockedUntil).getTime() > Date.now()) {
      throw new DomainError('PIN_LOCKED');
    }
    // Quyền của người duyệt đã được controller kiểm tra trước qua
    // checkPinPermission (AbilityProvider của M02); ở đây chỉ kiểm tra PIN.
    void permissionCode;
    if (!verifySecret(pin, approver.pinHash)) {
      approver.pinFailedCount += 1;
      if (approver.pinFailedCount >= 5) {
        approver.pinLockedUntil = new Date(Date.now() + PIN_WINDOW_MS).toISOString();
        approver.pinFailedCount = 0;
        this.audit(tenantId, approverUserId, 'pin.locked', 'user', approverUserId);
        throw new DomainError('PIN_LOCKED');
      }
      throw new DomainError('UNAUTHORIZED');
    }
    approver.pinFailedCount = 0;
    approver.pinLockedUntil = null;
    this.audit(tenantId, approverUserId, 'pin.verified', 'user', approverUserId);
    return { approvedAt: store.now(), approvedByUserId: approverUserId };
  }

  async checkPinPermission(
    tenantId: string,
    approverUserId: string,
    branchId: string,
    permissionCode: string,
  ): Promise<void> {
    const provider = abilityProviderRegistry.current;
    if (!provider) throw new DomainError('PERMISSION_DENIED');
    const result = await provider.checkAbility(tenantId, approverUserId, branchId, permissionCode);
    if (!result.allowed) throw new DomainError('PERMISSION_DENIED');
    const inBranch = store.userBranchRoles.some(
      (r) => r.tenantId === tenantId && r.userId === approverUserId && r.branchId === branchId,
    );
    if (!inBranch) throw new DomainError('PERMISSION_DENIED');
  }

  resetPasswordByOwner(
    tenantId: string,
    targetUserId: string,
    newPassword: string,
    actorUserId: string,
  ): void {
    const target = store.users.find((u) => u.tenantId === tenantId && u.id === targetUserId);
    if (!target) throw new DomainError('NOT_FOUND');
    target.passwordHash = hashSecret(newPassword);
    target.loginFailedCount = 0;
    target.lockedUntil = null;
    this.audit(tenantId, actorUserId, 'user.password.reset', 'user', targetUserId);
  }

  resetPinByOwner(tenantId: string, targetUserId: string, newPin: string, actorUserId: string): void {
    const target = store.users.find((u) => u.tenantId === tenantId && u.id === targetUserId);
    if (!target) throw new DomainError('NOT_FOUND');
    target.pinHash = hashSecret(newPin);
    target.pinFailedCount = 0;
    target.pinLockedUntil = null;
    this.audit(tenantId, actorUserId, 'user.pin.reset', 'user', targetUserId);
  }

  parseBearer(authHeader: string | undefined): ReturnType<typeof verifyJwt> {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return verifyJwt(authHeader.slice(7));
  }
}
