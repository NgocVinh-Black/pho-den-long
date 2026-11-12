import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Gói luôn code của @pdl/shared (TypeScript nguồn) vào bản build
  noExternal: ['@pdl/shared'],
});
