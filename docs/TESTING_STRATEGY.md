# Testing Strategy

## Overview

This document outlines the testing strategy for the Obsidian Meeting Tasks plugin, identifying testable components and providing guidance for test implementation.

## Testing Framework

**Recommended: Vitest**
- Fast, modern testing framework built on Vite
- Native TypeScript and ES module support
- Excellent mocking capabilities
- Compatible with Jest API (easy migration if needed)
- Small bundle size and fast execution

## Testable Components

### High Priority - Pure Logic (No External Dependencies)

#### 1. ProcessorRegistry (`src/emailProcessors/ProcessorRegistry.ts`)
**Why test:** Core routing logic with no side effects

**Test cases:**
```typescript
describe('ProcessorRegistry', () => {
  - initializeFromConfig() creates correct number of processors
  - getProcessor() returns matching processor for email with label
  - getProcessor() returns null when no processor matches
  - getProcessorByLabel() finds processor by exact label match
  - getAllProcessors() returns all registered processors
  - Multiple processors don't interfere with each other
});
```

**Testability:** ✅ Excellent - pure functions, easy to mock LabelProcessor

#### 2. Prompt Building Logic (`src/claudeExtractor.ts`)
**Why test:** Critical for AI quality, no API calls needed

**Test cases:**
```typescript
describe('ClaudeTaskExtractor - Prompt Building', () => {
  - buildPrompt() includes email subject
  - buildPrompt() truncates content > 15000 chars
  - buildPrompt() handles empty content gracefully
  - buildActionItemPrompt() uses different template
  - Prompt includes all required JSON fields
});
```

**Testability:** ✅ Good - can test without API calls

#### 3. Response Parsing (`src/claudeExtractor.ts`, `src/taskClusterer.ts`)
**Why test:** Complex JSON parsing with error handling

**Test cases:**
```typescript
describe('Response Parsing', () => {
  - parseResponse() handles valid Claude JSON response
  - parseResponse() extracts all task fields correctly
  - parseResponse() handles malformed JSON gracefully
  - parseResponse() handles missing optional fields
  - JSON auto-repair fixes truncated responses
  - Confidence scores normalized to 0-100 range
});
```

**Testability:** ✅ Excellent - pure parsing logic

#### 4. Task Formatting (`src/emailProcessors/LabelProcessor.ts`)
**Why test:** Ensures markdown output consistency

**Test cases:**
```typescript
describe('LabelProcessor - Formatting', () => {
  - formatNote() creates valid frontmatter
  - formatNote() includes all task metadata (assignee, priority, date)
  - formatNote() formats cluster IDs correctly
  - formatNote() groups tasks by priority
  - formatNote() escapes special markdown characters
  - formatNote() includes reprocess link with emailId
});
```

**Testability:** ✅ Good - mostly string manipulation

### Medium Priority - Logic with Some Dependencies

#### 5. Fallback Extraction (`src/claudeExtractor.ts`)
**Why test:** Ensures plugin works without API key

**Test cases:**
```typescript
describe('Fallback Extraction', () => {
  - fallbackExtraction() finds action verbs ("will", "should", "must")
  - fallbackExtraction() detects assignee patterns [[@Name]]
  - fallbackExtraction() assigns medium priority by default
  - fallbackExtraction() returns structured result matching API format
});
```

**Testability:** ✅ Good - regex-based extraction

#### 6. Email Processing Logic (`src/emailProcessors/LabelProcessor.ts`)
**Why test:** Validates label matching and routing

**Test cases:**
```typescript
describe('LabelProcessor - Email Processing', () => {
  - canProcess() matches email with exact label
  - canProcess() is case-insensitive
  - canProcess() handles emails with multiple labels
  - getPromptType() returns correct type (meeting vs actionitem)
});
```

**Testability:** ⚠️ Moderate - needs mock GmailMessage objects

### Lower Priority - Integration Points

#### 7. Gmail Service (Skip for now)
**Why skip:** Heavy external dependency (Gmail API), better for integration tests

#### 8. OAuth Server (Skip for now)
**Why skip:** Requires network mocking, better for integration tests

#### 9. Task Dashboard (Skip for now)
**Why skip:** UI component with heavy Obsidian API usage, better for E2E tests

## Testing Utilities Needed

### Mock Objects

```typescript
// tests/mocks/gmailMessage.mock.ts
export const createMockGmailMessage = (overrides?: Partial<GmailMessage>) => ({
  id: 'test-id-123',
  subject: 'Test Meeting',
  from: 'sender@example.com',
  date: '2025-01-27',
  body: 'Meeting content...',
  searchedLabels: ['transcript'],
  attachments: [],
  ...overrides
});

// tests/mocks/claudeResponse.mock.ts
export const validClaudeResponse = {
  tasks: [
    {
      description: "Review documentation",
      assignee: "John",
      priority: "high",
      confidence: 95,
      category: "documentation"
    }
  ],
  summary: "Team discussed documentation updates",
  participants: ["John", "Sarah"],
  meetingDate: "2025-01-27",
  keyDecisions: [],
  nextSteps: []
};
```

### Test Helpers

```typescript
// tests/helpers/taskHelpers.ts
export const createMockTask = (overrides?: Partial<Task>) => ({
  text: "Sample task",
  completed: false,
  assignee: "John",
  dueDate: "2025-01-30",
  priority: "medium",
  file: null,
  line: 1,
  rawLine: "- [ ] Sample task [[@John]]",
  ...overrides
});
```

## File Structure

```
tests/
├── unit/
│   ├── processorRegistry.test.ts
│   ├── claudeExtractor.test.ts
│   ├── taskClusterer.test.ts
│   ├── labelProcessor.test.ts
│   └── fallbackExtraction.test.ts
├── integration/
│   ├── emailProcessing.test.ts
│   └── taskClustering.test.ts
├── mocks/
│   ├── gmailMessage.mock.ts
│   ├── claudeResponse.mock.ts
│   └── obsidianApi.mock.ts
└── helpers/
    ├── taskHelpers.ts
    └── testUtils.ts
```

## Coverage Goals

**Phase 1 (Initial Setup):**
- ProcessorRegistry: 80%+ coverage
- Prompt building: 70%+ coverage
- Response parsing: 80%+ coverage

**Phase 2 (Expansion):**
- Formatting logic: 75%+ coverage
- Fallback extraction: 70%+ coverage
- Overall: 60%+ coverage

**Phase 3 (Comprehensive):**
- Integration tests for full workflows
- Overall: 70%+ coverage

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test processorRegistry
```

## Best Practices

1. **Arrange-Act-Assert Pattern**
   ```typescript
   test('getProcessor returns matching processor', () => {
     // Arrange
     const registry = new ProcessorRegistry();
     registry.initializeFromConfig([...]);
     const email = createMockGmailMessage({ searchedLabels: ['transcript'] });

     // Act
     const processor = registry.getProcessor(email);

     // Assert
     expect(processor).not.toBeNull();
     expect(processor?.label).toBe('transcript');
   });
   ```

2. **Test behavior, not implementation**
   - Focus on inputs/outputs
   - Don't test private methods directly
   - Mock external dependencies

3. **Keep tests isolated**
   - No shared state between tests
   - Each test creates its own fixtures
   - Clean up after each test

4. **Descriptive test names**
   - Use full sentences: "should return null when no processor matches"
   - Describe the scenario and expected outcome
   - Group related tests with describe blocks

## Continuous Integration

Future: Add GitHub Actions workflow to run tests on:
- Every pull request
- Every push to master
- Nightly builds

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
```

## Next Steps

1. Install Vitest and dependencies
2. Create basic test configuration
3. Write first test suite (ProcessorRegistry)
4. Add test commands to package.json
5. Document testing in main README
6. Gradually increase coverage
