import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@pcpartcheck/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/evidence': fileURLToPath(
        new URL('./packages/evidence/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      reporter: ['text', 'json-summary'],
    },
    include: ['**/*.test.ts'],
  },
});
