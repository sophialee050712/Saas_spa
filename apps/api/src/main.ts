import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PlatformService } from './modules/platform/platform.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Seed platform admin chỉ khi biến môi trường được đặt rõ ràng (demo/test
  // local). Không seed tài khoản mặc định trong production.
  const seedEmail = process.env.PLATFORM_SEED_ADMIN_EMAIL;
  const seedPassword = process.env.PLATFORM_SEED_ADMIN_PASSWORD;
  const seedTotp = process.env.PLATFORM_SEED_ADMIN_TOTP;
  if (seedEmail && seedPassword && seedTotp) {
    app.get(PlatformService).seedPlatformAdmin(seedEmail, seedPassword, seedTotp);
  }
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
