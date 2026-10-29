import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreController } from './core.controller.js';
import { CoreFacade } from './core.facade.js';
import { CoreService } from './core.service.js';
import { DomainErrorFilter } from './filter.js';
import { AbilityGuard, JwtAuthGuard, ModuleGuard, TenantMatchGuard } from './nest-guards.js';
import { TenantPrismaService } from './tenant-prisma.service.js';

// TenantPrismaService giữ dạng class thuần (test GĐ0 dùng trực tiếp với
// DbClient mock); chưa đăng ký làm Nest provider cho tới khi có Prisma
// adapter thật, tránh Nest DI đòi DbClient chưa tồn tại.
void TenantPrismaService;

@Module({
  controllers: [CoreController],
  exports: [CoreService, CoreFacade],
  providers: [
    CoreService,
    CoreFacade,
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantMatchGuard },
    { provide: APP_GUARD, useClass: AbilityGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
  ],
})
export class CoreModule {}
