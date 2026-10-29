import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { phoneSchema } from '../../shared-schemas.js';
import { DomainError } from '../core/domain-error.js';
import { Public, RequirePermission } from '../core/decorators.js';
import type { AuthedRequest } from '../core/nest-guards.js';
import { OrgService } from './org.service.js';

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

@Controller()
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @RequirePermission('org.branch.view')
  @Get('api/v1/branches')
  branches(@Req() req: AuthedRequest): unknown {
    return { items: this.org.listBranches(tenantOf(req)) };
  }

  @RequirePermission('org.branch.manage')
  @Post('api/v1/branches')
  createBranch(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(
      z.object({
        address: z.string().optional(),
        code: z.string().min(1),
        name: z.string().min(1),
        phone: z.string().optional(),
      }),
      body,
    );
    return this.org.createBranch(tenantOf(req), userOf(req), input);
  }

  @RequirePermission('org.user.view')
  @Get('api/v1/users')
  users(@Req() req: AuthedRequest): unknown {
    return { items: this.org.listUsers(tenantOf(req)) };
  }

  @RequirePermission('org.user.manage')
  @Post('api/v1/users')
  createUser(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(
      z.object({ branchId: z.string(), fullName: z.string().min(1), phone: phoneSchema, roleId: z.string() }),
      body,
    );
    return this.org.createUser(tenantOf(req), userOf(req), input);
  }

  @RequirePermission('org.user.invite')
  @Post('api/v1/users/:id/invite')
  invite(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(
      z.object({ branchId: z.string(), phone: phoneSchema, roleId: z.string() }),
      body,
    );
    void id;
    const result = this.org.createInvite(tenantOf(req), userOf(req), input);
    return { expiresAt: result.expiresAt, token: result.token, userId: result.userId };
  }

  @Public()
  @Post('api/v1/invites/accept')
  acceptInvite(@Body() body: unknown): unknown {
    const input = parse(
      z.object({ password: z.string().min(8), pin: z.string().min(4), token: z.string().min(10) }),
      body,
    );
    return this.org.acceptInvite(input.token, input.password, input.pin);
  }

  @RequirePermission('org.role.view')
  @Get('api/v1/roles')
  roles(@Req() req: AuthedRequest): unknown {
    return { items: this.org.listRoles(tenantOf(req)) };
  }

  @RequirePermission('org.role.manage')
  @Post('api/v1/roles')
  createRole(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        permissions: z.array(
          z.object({ conditions: z.record(z.string(), z.unknown()).optional(), permissionCode: z.string() }),
        ),
      }),
      body,
    );
    return this.org.createRole(tenantOf(req), userOf(req), input);
  }

  @RequirePermission('org.role.manage')
  @Patch('api/v1/roles/:id/permissions')
  updateRolePermissions(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): unknown {
    const input = parse(
      z.object({
        permissions: z.array(
          z.object({ conditions: z.record(z.string(), z.unknown()).optional(), permissionCode: z.string() }),
        ),
      }),
      body,
    );
    return this.org.updateRolePermissions(tenantOf(req), userOf(req), id, input.permissions);
  }

  @Get('api/v1/tenant-modules')
  tenantModules(@Req() req: AuthedRequest): unknown {
    return { items: this.org.listTenantModules(tenantOf(req)) };
  }

  @RequirePermission('org.module.toggle')
  @Patch('api/v1/tenant-modules/:code')
  toggleModule(@Req() req: AuthedRequest, @Param('code') code: string, @Body() body: unknown): unknown {
    const input = parse(z.object({ enabled: z.boolean() }), body);
    return this.org.toggleModule(tenantOf(req), userOf(req), code, input.enabled);
  }

  @RequirePermission('org.settings.view')
  @Get('api/v1/settings')
  settings(@Req() req: AuthedRequest): unknown {
    return { settings: this.org.getSettings(tenantOf(req)) };
  }

  @RequirePermission('org.settings.manage')
  @Patch('api/v1/settings')
  patchSettings(@Req() req: AuthedRequest, @Body() body: unknown): unknown {
    const input = parse(z.object({ settings: z.record(z.string(), z.unknown()) }), body);
    return { settings: this.org.patchSettings(tenantOf(req), userOf(req), input.settings) };
  }

  @RequirePermission('org.user.manage')
  @Delete('api/v1/users/:id/roles/:roleId')
  removeUserRole(
    @Req() req: AuthedRequest,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ): unknown {
    const input = parse(z.object({ branchId: z.string() }), body ?? {});
    this.org.removeUserRole(tenantOf(req), userOf(req), userId, input.branchId, roleId);
    return { ok: true };
  }
}
