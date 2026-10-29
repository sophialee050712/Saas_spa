import { Module } from '@nestjs/common';
import { CoreModule } from './modules/core/core.module.js';
import { OrgModule } from './modules/org/org.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';

@Module({ imports: [CoreModule, OrgModule, PlatformModule] })
export class AppModule {}
