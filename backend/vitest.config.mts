import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Unit tests (npm test): spec files in every app and library. Resolves @app/common from tsconfig.json. */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['apps/**/*.spec.ts', 'libs/**/*.spec.ts'],
  },
});
