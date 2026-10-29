import { Injectable } from '@nestjs/common';
import { CoreService } from './core.service.js';

@Injectable()
export class CoreFacade {
  constructor(private readonly service: CoreService) {}

  async verifyPin(
    tenantId: string,
    approverUserId: string,
    branchId: string,
    pin: string,
    permissionCode: string,
  ): Promise<{ approvedAt: string; approvedByUserId: string }> {
    await this.service.checkPinPermission(tenantId, approverUserId, branchId, permissionCode);
    return this.service.verifyPin(tenantId, approverUserId, branchId, pin, permissionCode);
  }

  audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
  ): void {
    this.service.audit(tenantId, actorUserId, action, entityType, entityId);
  }
}
