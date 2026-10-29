import { z } from 'zod';

// SDT: chap nhan +84... hoac 0... (VN) va so quoc te dang E.164 (+<ma nuoc><so>).
// Khong luu SDT dang "ma hoa" o day; viec che SDT khi hien thi thuoc ve API/UI.
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

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
