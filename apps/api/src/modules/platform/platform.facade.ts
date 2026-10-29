import { Injectable } from '@nestjs/common';
import { PlatformService } from './platform.service.js';

@Injectable()
export class PlatformFacade {
  constructor(private readonly service: PlatformService) {}

  createStore(input: Parameters<PlatformService['createStore']>[0]): ReturnType<PlatformService['createStore']> {
    return this.service.createStore(input);
  }

  setEntitledModules(tenantId: string, planCode: string): unknown {
    return this.service.changePlan(tenantId, planCode);
  }

  changeTenantStatus(tenantId: string, status: string, reason: string): unknown {
    return this.service.changeStatus(tenantId, status, reason);
  }

  resolveVipConnection(tenantId: string): { dbSecretRef: string | null; useSharedDb: boolean } {
    return this.service.resolveVipConnection(tenantId);
  }
}
