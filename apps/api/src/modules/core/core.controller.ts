import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { store } from '../../store.js';
import { loginSchema, phoneSchema } from '../../shared-schemas.js';
import { CoreService } from './core.service.js';
import { DomainError } from './domain-error.js';
import { Public, RequirePermission } from './decorators.js';
import type { AuthedRequest } from './nest-guards.js';

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new DomainError('VALIDATION_FAILED');
  return result.data;
}

@Controller()
export class CoreController {
  constructor(private readonly core: CoreService) {}

  @Public()
  @Post('api/v1/auth/login')
  login(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(loginSchema, body);
    const slug = (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase();
    const tenant = slug ? store.tenantBySlug(slug) : undefined;
    if (!tenant) throw new DomainError('NOT_FOUND');
    // BR-63: suspended chặn cả đăng nhập; read_only vẫn cho đăng nhập để đọc.
    if (tenant.status === 'suspended') throw new DomainError('TENANT_SUSPENDED');
    return this.core.login(tenant.id, input.phone, input.password);
  }

  @Public()
  @Post('api/v1/auth/refresh')
  refresh(@Body() body: unknown): unknown {
    const input = parse(z.object({ refreshToken: z.string().min(10) }), body);
    return this.core.refresh(input.refreshToken);
  }

  @Post('api/v1/auth/pin-verify')
  async pinVerify(@Req() req: AuthedRequest, @Body() body: unknown): Promise<unknown> {
    const input = parse(
      z.object({ branchId: z.string(), pin: z.string().min(4), targetAction: z.string() }),
      body,
    );
    if (!req.user || !req.tenantId) throw new DomainError('UNAUTHORIZED');
    await this.core.checkPinPermission(req.tenantId, req.user.sub, input.branchId, input.targetAction);
    return this.core.verifyPin(req.tenantId, req.user.sub, input.branchId, input.pin, input.targetAction);
  }

  @RequirePermission('core.audit.view')
  @Get('api/v1/audit-logs')
  auditLogs(@Req() req: AuthedRequest, @Query('limit') limit: string): unknown {
    const max = Math.min(Number(limit) || 50, 100);
    const items = store.audit.filter((a) => a.tenantId === req.tenantId).slice(-max);
    return { items, nextCursor: null };
  }

  @RequirePermission('core.outbox.view')
  @Get('api/v1/outbox-events')
  outbox(@Req() req: AuthedRequest, @Query('status') status: string): unknown {
    const items = store.outbox.filter(
      (o) => o.tenantId === req.tenantId && (!status || o.status === status),
    );
    return { items, nextCursor: null };
  }

  @Public()
  @Get('health')
  health(): unknown {
    return { ok: true, service: 'spa-saas-api', stage: 'M01' };
  }

  @Public()
  @Get('api/v1/health')
  apiHealth(): unknown {
    return { ok: true, service: 'spa-saas-api', stage: 'M01' };
  }
}

export { phoneSchema };
