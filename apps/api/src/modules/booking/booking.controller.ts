// Controller M07. M07 là module lõi (always_on) nên không gắn @RequireModule.
// Quyền qua @RequirePermission (decorator có thật trong codebase; không có
// @CheckAbility/@Idempotent — idempotency làm qua CoreService như catalog).
// tenantId chỉ lấy từ req (TenantContext), không từ body/query. KTV có
// data_scope own_only: chỉ thấy/thao tác dòng của mình (service thi hành).
// Route tĩnh (timeline, no-show-suggestions, walk-in) đăng ký trước /:id.
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from '../core/domain-error.js';
import { RequirePermission } from '../core/decorators.js';
import type { AuthedRequest } from '../core/nest-guards.js';
import { CoreService } from '../core/core.service.js';
import { BookingLifecycleService } from './booking.lifecycle.service.js';
import { BookingService } from './booking.service.js';

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new DomainError('VALIDATION_FAILED');
  return result.data;
}

function tenantOf(req: AuthedRequest): string {
  if (!req.tenantId) throw new DomainError('UNAUTHORIZED');
  return req.tenantId;
}

function userOf(req: AuthedRequest): string {
  if (!req.user) throw new DomainError('UNAUTHORIZED');
  return req.user.sub;
}

const assignmentSchema = z.enum(['auto', 'requested']);
const itemSchema = z.object({
  assignmentType: assignmentSchema,
  bedId: z.string().optional(),
  customerId: z.string().optional(),
  serviceId: z.string(),
  staffId: z.string().optional(),
  startAt: z.string(),
});

@Controller()
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly lifecycle: BookingLifecycleService,
    private readonly core: CoreService,
  ) {}

  private idempotent<T>(req: AuthedRequest, endpoint: string, body: unknown, run: () => T): T {
    const key = req.headers['idempotency-key'] as string | undefined;
    const replay = this.core.checkIdempotency(
      tenantOf(req),
      userOf(req),
      key,
      endpoint,
      JSON.stringify(body),
    );
    if (replay) return replay as T;
    const result = run();
    this.core.saveIdempotency(tenantOf(req), userOf(req), key, result);
    return result;
  }

  private viewerStaffId(req: AuthedRequest): Promise<string | null | undefined> {
    return this.booking.resolveViewerStaffId(tenantOf(req), userOf(req), req.branchId ?? null);
  }

  @RequirePermission('booking.view')
  @Get('api/v1/appointments/timeline')
  async timeline(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
  ): Promise<unknown> {
    if (!branchId || !date) throw new DomainError('VALIDATION_FAILED');
    return {
      items: this.booking.listTimeline(
        tenantOf(req),
        branchId,
        date,
        await this.viewerStaffId(req),
      ),
    };
  }

  @RequirePermission('booking.view')
  @Get('api/v1/appointments/no-show-suggestions')
  noShow(@Req() req: AuthedRequest, @Query('branchId') branchId?: string): unknown {
    if (!branchId) throw new DomainError('VALIDATION_FAILED');
    return { items: this.lifecycle.suggestNoShow(tenantOf(req), branchId) };
  }

  @RequirePermission('booking.view')
  @Get('api/v1/appointments')
  async list(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
  ): Promise<unknown> {
    if (!branchId || !date) throw new DomainError('VALIDATION_FAILED');
    return {
      items: this.booking.listTimeline(
        tenantOf(req),
        branchId,
        date,
        await this.viewerStaffId(req),
      ),
    };
  }

  @RequirePermission('booking.create')
  @Post('api/v1/appointments')
  create(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(
      z.object({
        branchId: z.string(),
        customerId: z.string().optional(),
        items: z.array(itemSchema).min(1),
        note: z.string().optional(),
        pickupAddress: z.string().optional(),
        pickupHotelName: z.string().optional(),
        pickupTime: z.string().optional(),
        sourceChannel: z.string().optional(),
      }),
      body,
    );
    return this.idempotent(req, 'createAppointment', body, () =>
      this.booking.createAppointment(tenantOf(req), userOf(req), input),
    );
  }

  @RequirePermission('booking.create')
  @Post('api/v1/appointments/walk-in')
  walkIn(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(
      z.object({
        bedId: z.string(),
        branchId: z.string(),
        customerId: z.string().optional(),
        serviceId: z.string(),
        staffId: z.string(),
        startAt: z.string().optional(),
      }),
      body,
    );
    return this.idempotent(req, 'createWalkIn', body, () =>
      this.booking.createWalkIn(tenantOf(req), userOf(req), input),
    );
  }

  @RequirePermission('booking.view')
  @Get('api/v1/appointments/:id')
  async getOne(@Req() req: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    return this.booking.getAppointment(tenantOf(req), id, await this.viewerStaffId(req));
  }

  @RequirePermission('booking.checkin')
  @Post('api/v1/appointments/:id/check-in')
  checkIn(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ itemIds: z.array(z.string()).optional() }), body);
    const appointment = this.booking.getAppointment(tenantOf(req), id);
    const targets =
      input.itemIds ?? appointment.items.filter((i) => i.status === 'booked').map((i) => i.id);
    const items = targets.map((itemId) =>
      this.lifecycle.transitionItem(tenantOf(req), userOf(req), itemId, 'arrived'),
    );
    return { ...appointment, items };
  }

  @RequirePermission('booking.start')
  @Post('api/v1/appointment-items/:id/start')
  async start(@Req() req: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    return this.lifecycle.transitionItem(
      tenantOf(req),
      userOf(req),
      id,
      'in_progress',
      undefined,
      await this.viewerStaffId(req),
    );
  }

  @RequirePermission('booking.complete')
  @Post('api/v1/appointment-items/:id/complete')
  async complete(@Req() req: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    return this.lifecycle.transitionItem(
      tenantOf(req),
      userOf(req),
      id,
      'completed',
      undefined,
      await this.viewerStaffId(req),
    );
  }

  @RequirePermission('booking.manage')
  @Post('api/v1/appointment-items/:id/cancel')
  cancel(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ reason: z.string().optional() }), body);
    return this.lifecycle.transitionItem(tenantOf(req), userOf(req), id, 'cancelled', input.reason);
  }

  @RequirePermission('booking.no_show.mark')
  @Post('api/v1/appointment-items/:id/no-show')
  noShowMark(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ reason: z.string().optional() }), body);
    return this.lifecycle.transitionItem(tenantOf(req), userOf(req), id, 'no_show', input.reason);
  }
}
