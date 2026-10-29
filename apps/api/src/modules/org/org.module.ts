import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module.js';
import { OrgController } from './org.controller.js';
import { OrgFacade } from './org.facade.js';
import { OrgService } from './org.service.js';

@Module({
  controllers: [OrgController],
  exports: [OrgFacade, OrgService],
  imports: [CoreModule],
  providers: [OrgFacade, OrgService],
})
export class OrgModule {}
