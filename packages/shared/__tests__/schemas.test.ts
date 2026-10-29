import { describe, expect, it } from 'vitest';
import { createTenantSchema, loginSchema, phoneSchema } from '../src/schemas';

describe('schemas', () => {
  it('phoneSchema chap nhan SDT VN va so quoc te', () => {
    expect(phoneSchema.safeParse('0935123456').success).toBe(true);
    expect(phoneSchema.safeParse('+84935123456').success).toBe(true);
    expect(phoneSchema.safeParse('+14155552671').success).toBe(true);
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
  it('loginSchema bat buoc mat khau >= 8 ky tu', () => {
    expect(loginSchema.safeParse({ phone: '0935123456', password: 'short' }).success).toBe(false);
    expect(loginSchema.safeParse({ phone: '0935123456', password: 'long-enough-1' }).success).toBe(true);
  });
  it('tenantSlugSchema tu choi slug co ky tu dac biet', () => {
    expect(createTenantSchema.safeParse({ name: 'Spa A', phone: '0935123456', slug: 'spa a!' }).success).toBe(false);
    expect(createTenantSchema.safeParse({ name: 'Spa A', phone: '0935123456', slug: 'spa-hoi-an' }).success).toBe(true);
  });
});
