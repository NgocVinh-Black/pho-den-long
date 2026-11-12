import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** OAuth Client ID loại "Web application" tạo ở Google Cloud Console. Để trống = tắt đăng nhập Google */
  GOOGLE_CLIENT_ID: z.string().default(''),
  /** Khóa ký cookie phiên đăng nhập (chuỗi ngẫu nhiên ≥ 32 ký tự) */
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET phải dài ít nhất 32 ký tự'),
  /** true khi chạy HTTPS (production) */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ (xem apps/api/.env.example):\n${issues}`);
  }
  return parsed.data;
}
