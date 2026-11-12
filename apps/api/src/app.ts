import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@pdl/shared';
import { ZodError } from 'zod';
import { GameError } from './lib/errors';
import type { GoogleVerifier } from './lib/google';
import { registerRoutes } from './routes';
import { registerAuthRoutes, SESSION_COOKIE } from './routes/auth';
import { PlayerParams } from './routes/schemas';
import { AuthService } from './services/auth.service';
import { GameService } from './services/game.service';

declare module 'fastify' {
  interface FastifyRequest {
    /** Tài khoản đang đăng nhập (null = khách) */
    user: AuthUser | null;
    sessionId: string | null;
  }
}

export interface AppOptions {
  prisma: PrismaClient;
  cookieSecret: string;
  corsOrigin?: string;
  logger?: FastifyServerOptions['logger'];
  googleClientId?: string;
  /** Thay hàm xác thực Google (dùng cho test) */
  verifyGoogle?: GoogleVerifier | null;
  cookieSecure?: boolean;
  sessionDays?: number;
}

export async function buildApp(opts: AppOptions) {
  const { prisma, corsOrigin = '*', logger = false, sessionDays = 30, cookieSecure = false } = opts;
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  await app.register(cookie, { secret: opts.cookieSecret });

  const auth = new AuthService(prisma, opts.verifyGoogle ?? null, sessionDays);
  const game = new GameService(prisma);

  // Đọc phiên đăng nhập từ cookie đã ký
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);
  app.addHook('onRequest', async (req) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    req.user = await auth.userFromSession(unsigned.value);
    req.sessionId = req.user ? unsigned.value : null;
  });

  // Quán đã gắn tài khoản: chỉ chủ tài khoản được truy cập
  app.addHook('preHandler', async (req) => {
    if (!req.routeOptions.url?.startsWith('/api/players/:id')) return;
    const { id } = PlayerParams.parse(req.params);
    await auth.assertPlayerAccess(id, req.user);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({
        error: first ? `Dữ liệu không hợp lệ: ${first.message}` : 'Dữ liệu không hợp lệ',
        details: err.issues,
      });
    }
    if (err instanceof GameError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: (err as Error).message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Lỗi máy chủ' });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Không tìm thấy API' }));

  await registerAuthRoutes(app, auth, {
    googleClientId: opts.googleClientId || null,
    cookieSecure,
    sessionDays,
  });
  await registerRoutes(app, game);
  return app;
}
