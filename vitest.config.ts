import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ashfall/rules': new URL('./packages/rules/src', import.meta.url).pathname,
      '@ashfall/shared': new URL('./packages/shared/src', import.meta.url).pathname,
    },
  },
});
