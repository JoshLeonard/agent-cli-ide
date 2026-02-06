import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  test: {
    // Browser-like environment for renderer tests
    environment: 'jsdom',

    // Test file patterns
    include: ['src/renderer/**/*.test.{ts,tsx}'],

    // Setup files
    setupFiles: ['./src/renderer/test/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/test/**',
        'src/renderer/main.tsx'
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
