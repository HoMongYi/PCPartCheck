import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@pcpartcheck/api-contracts': fileURLToPath(
        new URL('./packages/api-contracts/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/evidence': fileURLToPath(
        new URL('./packages/evidence/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/http-server': fileURLToPath(
        new URL('./packages/http-server/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/identity': fileURLToPath(
        new URL('./packages/identity/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/llm-toolkit': fileURLToPath(
        new URL('./packages/llm-toolkit/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/power': fileURLToPath(
        new URL('./packages/power/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/provider-buildcores': fileURLToPath(
        new URL('./packages/provider-buildcores/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/provider-sdk': fileURLToPath(
        new URL('./packages/provider-sdk/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/rules-standard': fileURLToPath(
        new URL('./packages/rules-standard/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/similarity': fileURLToPath(
        new URL('./packages/similarity/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/storage-sqlite': fileURLToPath(
        new URL('./packages/storage-sqlite/src/index.ts', import.meta.url),
      ),
      '@pcpartcheck/unit-normalization': fileURLToPath(
        new URL('./packages/unit-normalization/src/index.ts', import.meta.url),
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
