import { randomBytes } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';
import type { AuthUser, PlayerSummary } from '@pdl/shared';
import { GameError } from '../lib/errors';
import type { GoogleVerifier } from '../lib/google';

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  picture: u.picture,
});

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly verifyGoogle: GoogleVerifier | null,
    private readonly sessionDays: number,
  ) {}

  get googleEnabled() {
    return this.verifyGoogle !== null;
  }

  /** Đăng nhập bằng ID token Google: tạo/cập nhật tài khoản và mở phiên mới. */
  async loginWithGoogle(credential: string) {
    if (!this.verifyGoogle) throw new GameError('Máy chủ chưa bật đăng nhập Google', 503);
    const profile = await this.verifyGoogle(credential);
    const user = await this.db.user.upsert({
      where: { googleSub: profile.sub },
      create: {
        googleSub: profile.sub,
        email: profile.email,
        displayName: profile.name,
        picture: profile.picture ?? null,
      },
      update: {
        email: profile.email,
        displayName: profile.name,
        picture: profile.picture ?? null,
        lastLoginAt: new Date(),
      },
    });
    const expiresAt = new Date(Date.now() + this.sessionDays * 86_400_000);
    const session = await this.db.session.create({
      data: { id: randomBytes(32).toString('base64url'), userId: user.id, expiresAt },
    });
    // dọn các phiên đã hết hạn của tài khoản
    await this.db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
    return { user: toAuthUser(user), sessionId: session.id, expiresAt };
  }

  async userFromSession(sessionId: string): Promise<AuthUser | null> {
    const session = await this.db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.db.session.delete({ where: { id: sessionId } }).catch(() => undefined);
      return null;
    }
    return toAuthUser(session.user);
  }

  async logout(sessionId: string) {
    await this.db.session.deleteMany({ where: { id: sessionId } });
  }

  /** Các quán (bản lưu) của tài khoản. */
  async playersOf(userId: string): Promise<PlayerSummary[]> {
    const rows = await this.db.player.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      shopId: p.shopId,
      day: p.day,
      money: p.money,
      rep: p.rep,
      avatar: {
        skin: p.avatarSkin,
        shirt: p.avatarShirt,
        hat: p.avatarHat as PlayerSummary['avatar']['hat'],
      },
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /** Gắn quán đang chơi khách vào tài khoản. */
  async claimPlayer(userId: string, playerId: string) {
    const p = await this.db.player.findUnique({ where: { id: playerId }, select: { userId: true } });
    if (!p) throw new GameError('Không tìm thấy quán', 404);
    if (p.userId && p.userId !== userId) throw new GameError('Quán này thuộc tài khoản khác', 403);
    if (!p.userId) await this.db.player.update({ where: { id: playerId }, data: { userId } });
  }

  /** Kiểm tra người gọi có quyền với quán: quán của tài khoản thì phải đăng nhập đúng tài khoản. */
  async assertPlayerAccess(playerId: string, user: AuthUser | null) {
    const p = await this.db.player.findUnique({ where: { id: playerId }, select: { userId: true } });
    if (!p) throw new GameError('Không tìm thấy người chơi', 404);
    if (p.userId && p.userId !== user?.id) {
      throw new GameError(
        user ? 'Quán này thuộc tài khoản khác' : 'Hãy đăng nhập để chơi tiếp quán này',
        403,
      );
    }
  }
}
