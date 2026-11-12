import { OAuth2Client } from 'google-auth-library';
import { GameError } from './errors';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/** Hàm xác thực ID token Google → thông tin tài khoản (tách ra để test có thể thay thế). */
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile>;

export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new GameError('Đăng nhập Google không hợp lệ hoặc đã hết hạn', 401);
    }
    if (!payload?.sub || !payload.email) throw new GameError('Tài khoản Google thiếu thông tin', 401);
    if (payload.email_verified === false) throw new GameError('Email Google chưa được xác minh', 401);
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0] ?? 'Chủ quán',
      picture: payload.picture,
    };
  };
}
