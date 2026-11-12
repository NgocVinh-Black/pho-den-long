import type { World } from './World';

/** Giữ instance World đang gắn trên canvas để store gọi tới. */
let current: World | null = null;

export const worldHost = {
  get: () => current,
  set: (w: World | null) => {
    current = w;
  },
};
