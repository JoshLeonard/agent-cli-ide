import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node environment for main process tests
    environment: 'node',

    // Test file patterns
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        'src/main/index.ts'
      ]
    },

    // Global setup
    globals: true,
  },

  // Path resolution matching tsconfig
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared')
    }
  }
});
