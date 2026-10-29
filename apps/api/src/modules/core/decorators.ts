import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (code: string): MethodDecorator =>
  SetMetadata(PERMISSION_KEY, code);

export const MODULE_KEY = 'module';
export const RequireModule = (code: string): MethodDecorator => SetMetadata(MODULE_KEY, code);

export const PLATFORM_KEY = 'platform';
export const RequirePlatform = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PLATFORM_KEY, true);
