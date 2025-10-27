# Testing Setup Guide

## Quick Start

This guide walks through setting up unit testing for the Obsidian Meeting Tasks plugin using Vitest.

## Installation

### 1. Install Testing Dependencies

```bash
npm install --save-dev vitest @vitest/ui
npm install --save-dev @types/node
```

**Why these packages:**
- `vitest` - Core testing framework
- `@vitest/ui` - Optional web UI for test results
- `@types/node` - Node.js types for test files

### 2. Create Vitest Configuration

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

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
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },

    // Global test settings
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 3. Update package.json

Add test scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 4. Create Test Directory Structure

```bash
mkdir -p tests/{unit,integration,mocks,helpers}
```

### 5. Mock Obsidian API

Create `tests/mocks/obsidian.mock.ts`:

```typescript
/**
 * Mock Obsidian API for testing
 * Provides minimal implementations of Obsidian classes
 */

export class TFile {
  path: string;
  basename: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop() || '';
    this.extension = this.basename.split('.').pop() || '';
  }
}

export const requestUrl = vi.fn();

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log(`Notice: ${message}`);
  }
}

// Add more mocks as needed
```

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    // ... other config
    setupFiles: ['tests/setup.ts']
  }
});
```

Create `tests/setup.ts`:

```typescript
import { vi } from 'vitest';

// Mock Obsidian module
vi.mock('obsidian', () => ({
  requestUrl: vi.fn(),
  Notice: class Notice {
    constructor(message: string, timeout?: number) {
      console.log(`Notice: ${message}`);
    }
  },
  TFile: class TFile {
    path: string;
    constructor(path: string) {
      this.path = path;
    }
  }
}));
```

## Writing Your First Test

### Example: Testing ProcessorRegistry

Create `tests/unit/processorRegistry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessorRegistry } from '../../src/emailProcessors/ProcessorRegistry';
import { LabelProcessorConfig } from '../../src/emailProcessors/LabelProcessor';
import { GmailMessage } from '../../src/gmailService';

describe('ProcessorRegistry', () => {
  let registry: ProcessorRegistry;

  beforeEach(() => {
    registry = new ProcessorRegistry();
  });

  describe('initializeFromConfig', () => {
    it('should create processors from config array', () => {
      const configs: LabelProcessorConfig[] = [
        { label: 'transcript', folderName: 'Transcript', promptType: 'meeting' },
        { label: 'action', folderName: 'Action', promptType: 'actionitem' }
      ];

      registry.initializeFromConfig(configs);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(2);
      expect(processors[0].label).toBe('transcript');
      expect(processors[1].label).toBe('action');
    });

    it('should clear existing processors before initializing', () => {
      registry.initializeFromConfig([
        { label: 'test1', folderName: 'Test1' }
      ]);

      registry.initializeFromConfig([
        { label: 'test2', folderName: 'Test2' }
      ]);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(1);
      expect(processors[0].label).toBe('test2');
    });
  });

  describe('getProcessor', () => {
    beforeEach(() => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript' },
        { label: 'action', folderName: 'Action' }
      ]);
    });

    it('should return matching processor for email with label', () => {
      const email: GmailMessage = {
        id: 'test-123',
        subject: 'Test Meeting',
        from: 'test@example.com',
        date: '2025-01-27',
        body: 'Meeting content',
        searchedLabels: ['transcript'],
        attachments: []
      };

      const processor = registry.getProcessor(email);

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('transcript');
    });

    it('should return null when no processor matches', () => {
      const email: GmailMessage = {
        id: 'test-123',
        subject: 'Test',
        from: 'test@example.com',
        date: '2025-01-27',
        body: 'Content',
        searchedLabels: ['unknown-label'],
        attachments: []
      };

      const processor = registry.getProcessor(email);

      expect(processor).toBeNull();
    });

    it('should return first matching processor when email has multiple labels', () => {
      const email: GmailMessage = {
        id: 'test-123',
        subject: 'Test',
        from: 'test@example.com',
        date: '2025-01-27',
        body: 'Content',
        searchedLabels: ['transcript', 'action'],
        attachments: []
      };

      const processor = registry.getProcessor(email);

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('transcript');
    });
  });

  describe('getProcessorByLabel', () => {
    beforeEach(() => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript' }
      ]);
    });

    it('should find processor by exact label match', () => {
      const processor = registry.getProcessorByLabel('transcript');

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('transcript');
    });

    it('should return null for non-existent label', () => {
      const processor = registry.getProcessorByLabel('nonexistent');

      expect(processor).toBeNull();
    });
  });
});
```

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Visual UI in browser
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Output

**Successful test run:**
```
✓ tests/unit/processorRegistry.test.ts (15)
  ✓ ProcessorRegistry (15)
    ✓ initializeFromConfig (2)
      ✓ should create processors from config array
      ✓ should clear existing processors before initializing
    ✓ getProcessor (3)
      ✓ should return matching processor for email with label
      ✓ should return null when no processor matches
      ✓ should return first matching processor when email has multiple labels
    ✓ getProcessorByLabel (2)
      ✓ should find processor by exact label match
      ✓ should return null for non-existent label

Test Files  1 passed (1)
     Tests  7 passed (7)
  Start at  10:30:15
  Duration  523ms
```

## Coverage Report

After running `npm run test:coverage`, open `coverage/index.html` in your browser to see:
- Line coverage by file
- Branch coverage
- Uncovered lines highlighted
- Overall project coverage

## Next Steps

1. **Add more test files** following the examples in `docs/TESTING_STRATEGY.md`
2. **Create mock helpers** in `tests/mocks/` for reusable test data
3. **Set coverage goals** and gradually improve
4. **Add CI/CD integration** to run tests automatically
5. **Document testing patterns** for contributors

## Troubleshooting

### Problem: "Cannot find module 'obsidian'"

**Solution:** Ensure `tests/setup.ts` properly mocks the obsidian module

### Problem: Tests fail with "requestUrl is not a function"

**Solution:** Mock `requestUrl` in your test:
```typescript
import { vi } from 'vitest';
import { requestUrl } from 'obsidian';

vi.mocked(requestUrl).mockResolvedValue({
  json: { /* mock response */ }
});
```

### Problem: TypeScript errors in test files

**Solution:** Ensure `tsconfig.json` includes test files:
```json
{
  "include": ["src/**/*", "tests/**/*"]
}
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Mocking Guide](https://vitest.dev/guide/mocking.html)
