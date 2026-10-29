import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { store } from '../../store.js';
import { verifyJwt } from './auth.js';
import { DomainError } from './domain-error.js';
import { IS_PUBLIC_KEY, MODULE_KEY, PERMISSION_KEY, PLATFORM_KEY } from './decorators.js';
import { abilityProviderRegistry, moduleProviderRegistry } from './providers.js';
import { slugFromHeaders } from './tenant-context.js';

export interface AuthedRequest {
  branchId: string | null;
  headers: Record<string, string | string[] | undefined>;
  platformAdminId?: string;
  tenantId?: string;
  tenantSlug?: string;
  user?: { branchIds: string[]; sub: string; tenantId: string };
}

function header(req: AuthedRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const payload = verifyJwt((header(req, 'authorization') ?? '').replace('Bearer ', ''));
    if (!payload) throw new DomainError('UNAUTHORIZED');
    if (payload.type === 'platform') {
      req.platformAdminId = payload.sub;
      req.tenantId = '';
      return true;
    }
    req.user = { branchIds: payload.branchIds, sub: payload.sub, tenantId: payload.tenantId };
    req.tenantId = payload.tenantId;
    req.tenantSlug = payload.slug;
    req.branchId = header(req, 'x-branch-id') ?? payload.branchIds[0] ?? null;
    return true;
  }
}

@Injectable()
export class TenantMatchGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.platformAdminId) return true;
    const host = header(req, 'host') ?? '';
    const slug = slugFromHeaders(host, header(req, 'x-tenant-slug'));
    if (!slug || slug !== req.tenantSlug) throw new DomainError('TENANT_MISMATCH');
    const tenant = store.tenantById(req.tenantId ?? '');
    if (!tenant || tenant.slug !== slug) throw new DomainError('TENANT_MISMATCH');
    return true;
  }
}

@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const provider = abilityProviderRegistry.current;
    if (!provider || !req.user || !req.tenantId) throw new DomainError('PERMISSION_DENIED');
    const result = await provider.checkAbility(req.tenantId, req.user.sub, req.branchId, permission);
    if (!result.allowed) throw new DomainError('PERMISSION_DENIED');
    return true;
  }
}

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleCode = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleCode) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const provider = moduleProviderRegistry.current;
    if (!provider || !req.tenantId) throw new DomainError('MODULE_DISABLED');
    const active = await provider.isModuleActive(req.tenantId, moduleCode);
    if (!active) throw new DomainError('MODULE_DISABLED');
    return true;
  }
}

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(PLATFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.platformAdminId) throw new DomainError('PERMISSION_DENIED');
    return true;
  }
}

// Hàm thuần giữ tương thích test GĐ0.
export function checkAbility(granted: readonly string[], required: string): void {
  if (!granted.includes(required)) throw new DomainError('PERMISSION_DENIED', { permission: required });
}

export function checkModuleEnabled(enabled: readonly string[], moduleCode: string): void {
  if (!enabled.includes(moduleCode)) throw new DomainError('MODULE_DISABLED', { module: moduleCode });
}

export function isModuleActive(entitled: boolean, enabled: boolean): boolean {
  return entitled && enabled;
}
