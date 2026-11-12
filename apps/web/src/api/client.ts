import type {
  AuthConfig,
  Avatar,
  BuyResult,
  Catalog,
  CustomerTypeId,
  EndDayResult,
  LeaderboardEntry,
  Market,
  MeResult,
  Note,
  NoteItem,
  PlayerSummary,
  MissResult,
  PlayerResult,
  PlayerState,
  ReceiveResult,
  RecipeIngredient,
  ServeResult,
  ShipmentMode,
} from '@pdl/shared';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly offline = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ game', 0, true);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    // Vite proxy trả 502/503 khi backend chưa chạy
    const offline = res.status === 502 || res.status === 503 || res.status === 504;
    throw new ApiError(
      data.error ?? (offline ? 'Không kết nối được máy chủ game' : `Lỗi ${res.status}`),
      res.status,
      offline,
    );
  }
  return data as T;
}

const p = (id: string) => `/players/${encodeURIComponent(id)}`;

export const api = {
  base: BASE,
  authConfig: () => request<AuthConfig>('GET', '/auth/config'),
  me: () => request<MeResult>('GET', '/auth/me'),
  loginGoogle: (credential: string) => request<MeResult>('POST', '/auth/google', { credential }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout', {}),
  myPlayers: () => request<PlayerSummary[]>('GET', '/me/players'),
  claim: (playerId: string) => request<{ ok: true }>('POST', `/me/claim/${encodeURIComponent(playerId)}`, {}),
  catalog: () => request<Catalog>('GET', '/catalog'),
  leaderboard: () => request<LeaderboardEntry[]>('GET', '/leaderboard'),
  createPlayer: (name: string, shopId: string, avatar: Avatar) =>
    request<PlayerState>('POST', '/players', { name, shopId, avatar }),
  getPlayer: (id: string) => request<PlayerState>('GET', p(id)),
  market: (id: string) => request<Market>('GET', `${p(id)}/market`),
  buy: (id: string, items: RecipeIngredient[], mode: ShipmentMode) =>
    request<BuyResult>('POST', `${p(id)}/buy`, { items, mode }),
  receive: (id: string, body: { shipmentId?: string; mode?: ShipmentMode }) =>
    request<ReceiveResult>('POST', `${p(id)}/receive`, body),
  setAvatar: (id: string, avatar: Avatar) => request<PlayerResult>('POST', `${p(id)}/avatar`, avatar),
  serve: (
    id: string,
    body: { recipeId: string; quality: number; customerType: CustomerTypeId; cookedBy?: 'player' | 'staff' },
  ) => request<ServeResult>('POST', `${p(id)}/serve`, body),
  miss: (id: string) => request<MissResult>('POST', `${p(id)}/miss`, {}),
  endDay: (id: string) => request<EndDayResult>('POST', `${p(id)}/end-day`, {}),
  learn: (id: string, recipeId: string) => request<PlayerResult>('POST', `${p(id)}/learn`, { recipeId }),
  upgrade: (id: string, type: 'shop' | 'decor') =>
    request<PlayerResult>('POST', `${p(id)}/upgrade`, { type }),
  buyFurniture: (id: string, itemId: string) =>
    request<PlayerResult>('POST', `${p(id)}/furniture`, { itemId }),
  buyAd: (id: string, planId: string) => request<PlayerResult>('POST', `${p(id)}/ad`, { planId }),
  notes: (id: string) => request<Note[]>('GET', `${p(id)}/notes`),
  createNote: (id: string, body: { title: string; items: NoteItem[]; pinned?: boolean }) =>
    request<Note>('POST', `${p(id)}/notes`, body),
  updateNote: (id: string, noteId: string, body: { title?: string; items?: NoteItem[]; pinned?: boolean }) =>
    request<Note>('PATCH', `${p(id)}/notes/${encodeURIComponent(noteId)}`, body),
  deleteNote: (id: string, noteId: string) =>
    request<{ ok: true }>('DELETE', `${p(id)}/notes/${encodeURIComponent(noteId)}`),
  hireStaff: (id: string, role: 'waiter' | 'cook') =>
    request<PlayerResult>('POST', `${p(id)}/staff`, { role }),
  fireStaff: (id: string, staffId: string) =>
    request<PlayerResult>('DELETE', `${p(id)}/staff/${encodeURIComponent(staffId)}`),
};
