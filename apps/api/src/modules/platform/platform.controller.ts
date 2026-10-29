import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { createTenantSchema, phoneSchema } from '../../shared-schemas.js';
import { DomainError } from '../core/domain-error.js';
import { Public, RequirePlatform } from '../core/decorators.js';
import type { AuthedRequest } from '../core/nest-guards.js';
import { PlatformService } from './platform.service.js';
import { CoreService } from '../core/core.service.js';

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new DomainError('VALIDATION_FAILED');
  return result.data;
}

@Controller()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly core: CoreService,
  ) {}

  @Public()
  @Post('platform/v1/stores')
  createStore(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const base = parse(createTenantSchema, body);
    const extra = parse(
      z.object({
        industryTemplateCode: z.string().optional(),
        ownerPassword: z.string().min(8).max(128),
      }),
      body,
    );
    const idemKey = req.headers['idempotency-key'] as string | undefined;
    const hash = JSON.stringify(body);
    const replay = this.core.checkIdempotency('platform', 'public', idemKey, 'createStore', hash);
    if (replay) return replay;
    const result = this.platform.createStore({
      industryTemplateCode: extra.industryTemplateCode,
      ownerPassword: extra.ownerPassword,
      ownerPhone: base.phone,
      slug: base.slug,
      spaName: base.name,
    });
    this.core.saveIdempotency('platform', 'public', idemKey, result);
    return result;
  }

  @Public()
  @Post('platform/v1/admin/login')
  adminLogin(@Body() body: unknown): unknown {
    const input = parse(
      z.object({ email: z.string().email(), password: z.string().min(8), totpCode: z.string().length(6) }),
      body,
    );
    return this.platform.adminLogin(input.email, input.password, input.totpCode);
  }

  @RequirePlatform()
  @Get('platform/v1/admin/stores')
  listStores(): unknown {
    return { items: this.platform.listStores(), nextCursor: null };
  }

  @RequirePlatform()
  @Patch('platform/v1/admin/stores/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ reason: z.string().optional(), status: z.string() }), body);
    return this.platform.changeStatus(id, input.status, input.reason ?? '');
  }

  @RequirePlatform()
  @Patch('platform/v1/admin/stores/:id/plan')
  changePlan(@Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ planCode: z.string() }), body);
    return this.platform.changePlan(id, input.planCode);
  }

  @RequirePlatform()
  @Get('platform/v1/admin/stores/:id/subscription')
  subscription(@Param('id') id: string): unknown {
    return this.platform.subscription(id);
  }
}

export { phoneSchema };
