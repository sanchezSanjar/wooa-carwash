import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** End-to-end tests (npm run test:e2e): each app against an in-memory MongoDB. */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['apps/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
