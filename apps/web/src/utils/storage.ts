/** localStorage an toàn (có thể bị chặn trong chế độ riêng tư). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* bỏ qua */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* bỏ qua */
    }
  },
};

export const KEYS = { playerId: 'pdl-player-id', name: 'pdl-name' } as const;
