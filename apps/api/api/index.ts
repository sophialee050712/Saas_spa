// api/index.ts — entry serverless cho API NestJS tren Vercel.
// Vercel goi file nay cho moi request (xem apps/api/vercel.json: rewrite
// /(.*) -> /api/index). Nest app khoi tao 1 lan roi tai dung trong cung
// instance khi con am (cold start chi xay ra o request dau sau idle).
// KHONG dung @vendia/serverless-express hay @vercel/node: chi can goi
// truc tiep Express instance cua Nest (platform-express), khong them
// dependency moi (AGENTS §5: them thu vien phai hoi dnduy — o day khong them).
// File nay KHONG nam trong tsconfig (include chi src) nen `pnpm typecheck`
// khong kiem no; Vercel bien dich file nay luc build function.
// Luu y: service M00–M13 hien van dung store in-memory dong bo; file nay chi
// dua API hien tai len Vercel, khong doi logic nghiep vu. Chuyen sang Prisma
// async la buoc rieng sau (xem docs/api-vercel-deploy.md).
import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../dist/app.module.js';
import { PlatformService } from '../dist/modules/platform/platform.service.js';

let cachedApp: INestApplication | null = null;

function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  // Mac dinh: chi web production da deploy. Them origin khac bang env
  // CORS_ORIGINS (vd staging/preview), khong hard-code them o day.
  return ['https://saas-spa-taupe.vercel.app'];
}

async function getApp(): Promise<INestApplication> {
  if (cachedApp) return cachedApp;
  const app = await NestFactory.create(AppModule);
  // Seed platform admin chi khi env duoc dat ro rang (giong main.ts).
  // Sau khi da co admin that thi xoa env seed ngay (ADR-004 §8).
  const seedEmail = process.env.PLATFORM_SEED_ADMIN_EMAIL;
  const seedPassword = process.env.PLATFORM_SEED_ADMIN_PASSWORD;
  const seedTotp = process.env.PLATFORM_SEED_ADMIN_TOTP;
  if (seedEmail && seedPassword && seedTotp) {
    app.get(PlatformService).seedPlatformAdmin(seedEmail, seedPassword, seedTotp);
  }
  // Web chay tren project Vercel khac nen goi API cross-origin: bat CORS
  // theo allowlist, khong mo `origin: true`. JWT di theo header
  // Authorization (khong dung cookie) nen khong can credentials.
  app.enableCors({
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'x-tenant-slug'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: corsOrigins(),
  });
  await app.init();
  cachedApp = app;
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    const server = app.getHttpAdapter().getInstance() as (
      request: IncomingMessage,
      response: ServerResponse,
    ) => void;
    server(req, res);
  } catch (error) {
    // Khoi dong loi (vd thieu DATABASE_URL / APP_USER_PASSWORD): tra 500
    // ro rang thay vi treo request. Khong in secret vao response.
    const message = error instanceof Error ? error.message : 'API init failed';
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ code: 'API_INIT_FAILED', message }));
  }
}
