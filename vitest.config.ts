import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Setup files
    setupFiles: ['tests/setup.ts'],

    // Test file patterns
    include: ['tests/**/*.test.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'tests/**/*'
      ],
      // Thresholds will be enforced as more tests are added
      // thresholds: {
      //   lines: 40,
      //   functions: 40,
      //   branches: 40,
      //   statements: 40
      // }
    },

    // Global test settings
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'obsidian': path.resolve(__dirname, './tests/__mocks__/obsidian.ts')
    }
  }
});
