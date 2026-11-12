import type { FastifyInstance } from 'fastify';
import type { AuthConfig, MeResult } from '@pdl/shared';
import { GameError } from '../lib/errors';
import type { AuthService } from '../services/auth.service';
import { GoogleLoginBody, PlayerParams } from './schemas';

export const SESSION_COOKIE = 'pdl_session';

interface AuthRouteOptions {
  googleClientId: string | null;
  cookieSecure: boolean;
  sessionDays: number;
}

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService, opts: AuthRouteOptions) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: opts.cookieSecure,
    signed: true,
  };

  app.get('/api/auth/config', async (): Promise<AuthConfig> => ({
    googleClientId: auth.googleEnabled ? opts.googleClientId : null,
  }));

  app.get('/api/auth/me', async (req): Promise<MeResult> => ({ user: req.user }));

  app.post('/api/auth/google', async (req, reply): Promise<MeResult> => {
    const { credential } = GoogleLoginBody.parse(req.body);
    const { user, sessionId, expiresAt } = await auth.loginWithGoogle(credential);
    reply.setCookie(SESSION_COOKIE, sessionId, { ...cookieOptions, expires: expiresAt });
    return { user };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionId) await auth.logout(req.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  /** Danh sách quán của tài khoản đang đăng nhập */
  app.get('/api/me/players', async (req) => {
    if (!req.user) throw new GameError('Chưa đăng nhập', 401);
    return auth.playersOf(req.user.id);
  });

  /** Gắn quán đang chơi khách vào tài khoản */
  app.post('/api/me/claim/:id', async (req) => {
    if (!req.user) throw new GameError('Chưa đăng nhập', 401);
    const { id } = PlayerParams.parse(req.params);
    await auth.claimPlayer(req.user.id, id);
    return { ok: true };
  });
}
