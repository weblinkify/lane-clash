import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/sim/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 90 },
    },
  },
});
