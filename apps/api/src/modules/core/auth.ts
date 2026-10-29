// Auth M01: argon2id cho cả mật khẩu và PIN (quyết định Approved 2026-10-29).
// PIN scrypt của GĐ0 vô hiệu: verifySecret chỉ chấp nhận định dạng argon2id,
// không chuyển đổi hash cũ. JWT: access 8h, refresh 7 ngày, quay vòng.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2.js';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  branchIds: string[];
  slug: string;
  sub: string;
  tenantId: string;
  type: 'access' | 'platform';
}

function secret(): string {
  return process.env.JWT_SECRET ?? 'dev-only-secret-change-me-32chars!!';
}

export function hashSecret(secretText: string): string {
  const salt = randomBytes(16);
  const hash = argon2id(secretText, salt, { dkLen: 32, m: 19456, p: 1, t: 2 });
  return `argon2id:${salt.toString('hex')}:${Buffer.from(hash).toString('hex')}`;
}

export function verifySecret(secretText: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'argon2id') return false;
  const salt = Buffer.from(parts[1] as string, 'hex');
  const expected = Buffer.from(parts[2] as string, 'hex');
  const actual = Buffer.from(argon2id(secretText, salt, { dkLen: 32, m: 19456, p: 1, t: 2 }));
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function signAccess(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, secret(), { expiresIn: '8h' });
}

export function signPlatformAccess(sub: string, email: string): string {
  return jwt.sign({ email, sub, tenantId: '', type: 'platform' }, secret(), {
    expiresIn: '8h',
  });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret()) as Record<string, unknown>;
    if (typeof decoded.sub !== 'string' || typeof decoded.tenantId !== 'string') {
      return null;
    }
    return {
      branchIds: Array.isArray(decoded.branchIds) ? (decoded.branchIds as string[]) : [],
      slug: typeof decoded.slug === 'string' ? decoded.slug : '',
      sub: decoded.sub,
      tenantId: decoded.tenantId,
      type: decoded.type === 'platform' ? 'platform' : 'access',
    };
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  return verifyJwt(token);
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

// TOTP RFC 6238 (SHA-1, 30s, 6 chữ số) cho 2FA platform admin.
export function totpCode(secretText: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(secretText, 'utf8')).update(buf).digest();
  const offset = (hmac[hmac.length - 1] as number) & 0x0f;
  const code =
    (((hmac[offset] as number) & 0x7f) << 24) |
    (((hmac[offset + 1] as number) & 0xff) << 16) |
    (((hmac[offset + 2] as number) & 0xff) << 8) |
    ((hmac[offset + 3] as number) & 0xff);
  return String(code % 1000000).padStart(6, '0');
}
