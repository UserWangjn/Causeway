import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
