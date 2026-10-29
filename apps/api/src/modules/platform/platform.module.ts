import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from '../core/core.module.js';
import { PlatformGuard } from '../core/nest-guards.js';
import { OrgModule } from '../org/org.module.js';
import { PlatformController } from './platform.controller.js';
import { PlatformFacade } from './platform.facade.js';
import { PlatformService } from './platform.service.js';

@Module({
  controllers: [PlatformController],
  exports: [PlatformFacade, PlatformService],
  imports: [CoreModule, OrgModule],
  providers: [PlatformFacade, PlatformService, { provide: APP_GUARD, useClass: PlatformGuard }],
})
export class PlatformModule {}
