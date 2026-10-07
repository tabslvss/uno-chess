import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'party/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
