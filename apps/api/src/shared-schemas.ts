// Bản sao Zod dùng cho runtime Node của apps/api. Nguồn chính vẫn là
// packages/shared/src/schemas.ts (dùng cho web qua Next transpile); apps/api
// biên dịch ra JS thuần nên không import trực tiếp file .ts của shared.
// Giữ hai bản đồng bộ: phone, slug, login, createTenant.
import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+84\d{9,10}|0\d{9,10}|\+[1-9]\d{7,14})$/, 'INVALID_PHONE');

export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, 'INVALID_TENANT_SLUG');

export const loginSchema = z.object({
  password: z.string().min(8).max(128),
  phone: phoneSchema,
});

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: phoneSchema,
  slug: tenantSlugSchema,
  timezone: z.string().trim().min(1).max(64).default('Asia/Ho_Chi_Minh'),
});
