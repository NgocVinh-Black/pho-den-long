import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { loadEnv } from './config';
import { createGoogleVerifier } from './lib/google';

const env = loadEnv();
const prisma = new PrismaClient();
const app = await buildApp({
  prisma,
  corsOrigin: env.CORS_ORIGIN,
  cookieSecret: env.COOKIE_SECRET,
  cookieSecure: env.COOKIE_SECURE,
  sessionDays: env.SESSION_DAYS,
  googleClientId: env.GOOGLE_CLIENT_ID,
  verifyGoogle: env.GOOGLE_CLIENT_ID ? createGoogleVerifier(env.GOOGLE_CLIENT_ID) : null,
  logger: { level: env.LOG_LEVEL },
});

const shutdown = async (signal: string) => {
  app.log.info(`Nhận ${signal}, đang tắt server…`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`🏮 Phố Đèn Lồng API: http://${env.HOST}:${env.PORT}/api`);
  if (!env.GOOGLE_CLIENT_ID)
    app.log.warn('Chưa đặt GOOGLE_CLIENT_ID: đăng nhập Google đang tắt (chỉ chơi khách).');
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}
