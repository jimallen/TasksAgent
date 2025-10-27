# Unit Testing Proposal

## Executive Summary

This proposal outlines a pragmatic approach to adding unit testing to the Obsidian Meeting Tasks plugin. The goal is to test critical business logic while avoiding the complexity of mocking the entire Obsidian API.

## Current State

**Testing Coverage:** 0%
- No test framework configured
- No test files
- Manual testing only (see README.md Testing section)

**Code Characteristics:**
- Well-structured TypeScript codebase
- Clear separation of concerns
- Some pure logic functions (good for testing)
- Heavy Obsidian API integration (challenging for testing)

## Proposed Approach

### Phase 1: Foundation (Recommended to Start)

**Goal:** Set up testing infrastructure and test pure business logic

**Effort:** ~4-6 hours
**Value:** High - catches logic bugs, enables TDD for new features

**Components to test:**
1. **ProcessorRegistry** (`src/emailProcessors/ProcessorRegistry.ts`)
   - Pure TypeScript with no Obsidian dependencies
   - 58 lines of critical routing logic
   - Easy to test, high value

2. **Prompt Building** (`src/claudeExtractor.ts`)
   - String manipulation and formatting
   - No API calls required for testing
   - Critical for AI quality

3. **Response Parsing** (`src/claudeExtractor.ts`, `src/taskClusterer.ts`)
   - JSON parsing with error handling
   - Complex logic worth testing
   - Can test with mock responses

**Setup required:**
```bash
npm install --save-dev vitest @vitest/ui
```

**Files to create:**
- `vitest.config.ts` - Test configuration
- `tests/setup.ts` - Mock Obsidian API
- `tests/unit/processorRegistry.test.ts` - First test suite
- `tests/mocks/` - Reusable test fixtures

**Expected Coverage:** ~40% overall, 80%+ for tested modules

### Phase 2: Expansion (Optional)

**Goal:** Test more complex logic with minimal mocking

**Effort:** ~6-8 hours
**Value:** Medium - catches more edge cases

**Additional components:**
1. **Task Formatting** - Markdown generation logic
2. **Fallback Extraction** - Non-AI task detection
3. **Email Processing Logic** - Label matching

**Expected Coverage:** ~60% overall

### Phase 3: Integration Tests (Future)

**Goal:** Test full workflows end-to-end

**Effort:** ~10-15 hours
**Value:** Low initially - manual testing currently adequate

**Components:**
- Full email processing pipeline
- Gmail API integration (requires mocking)
- Task dashboard interactions (UI testing)

## What NOT to Test (Initially)

### 1. Gmail Service (`src/gmailService.ts`)
**Why skip:**
- Heavy external dependency (Google OAuth, Gmail API)
- Requires extensive mocking
- Better validated through integration/manual testing
- Changes infrequently

### 2. OAuth Server (`src/oauthServer.ts`)
**Why skip:**
- Network operations
- Browser integration
- Changes rarely
- Manual testing sufficient

### 3. Task Dashboard (`src/taskDashboard.ts`)
**Why skip:**
- Heavy Obsidian API usage (DOM manipulation)
- UI testing requires E2E framework (Playwright/Cypress)
- High effort, low ROI
- Visual bugs caught in manual testing

### 4. Main Plugin Orchestrator (`src/main.ts`)
**Why skip:**
- Integration point, not business logic
- Tested implicitly through component tests
- Changes infrequently

## Recommended Testing Framework: Vitest

**Why Vitest over Jest:**

| Feature | Vitest | Jest |
|---------|--------|------|
| Speed | ⚡ Very fast | 🐌 Slower |
| ES Modules | ✅ Native | ⚠️ Experimental |
| TypeScript | ✅ Built-in | ❌ Needs ts-jest |
| Config | Simple | Complex |
| Bundle Size | Small | Large |
| Learning Curve | Easy (Jest-compatible API) | Moderate |

**Key advantages for this project:**
- Works seamlessly with ES modules (your code uses `import`)
- No additional TypeScript transpilation setup needed
- Fast watch mode for TDD workflow
- Compatible with existing Jest knowledge

## Implementation Plan

### Step 1: Setup (30 minutes)
```bash
# Install dependencies
npm install --save-dev vitest @vitest/ui

# Create config files
# - vitest.config.ts
# - tests/setup.ts

# Add npm scripts
# - test, test:watch, test:coverage
```

### Step 2: First Test Suite (2 hours)
```typescript
// tests/unit/processorRegistry.test.ts
// - Test initialization
// - Test processor matching
// - Test label lookup
// Target: 80%+ coverage of ProcessorRegistry
```

### Step 3: Expand Coverage (2-3 hours)
```typescript
// tests/unit/claudeExtractor.test.ts
// - Test prompt building
// - Test response parsing
// Target: 70%+ coverage of prompt logic
```

### Step 4: Documentation (30 minutes)
- Update README.md with test commands
- Document testing approach in TESTING_STRATEGY.md
- Create examples for contributors

## Success Metrics

**Phase 1 Complete When:**
- ✅ Vitest configured and running
- ✅ ProcessorRegistry has 80%+ test coverage
- ✅ CI/CD can run tests automatically
- ✅ Tests run in <2 seconds
- ✅ Zero test flakiness

**Phase 2 Complete When:**
- ✅ Overall coverage >60%
- ✅ All prompt building logic tested
- ✅ Response parsing tested with edge cases
- ✅ Tests run in <5 seconds

## Cost-Benefit Analysis

**Benefits:**
- ✅ Catch regressions early
- ✅ Enable confident refactoring
- ✅ Document expected behavior
- ✅ Support TDD for new features
- ✅ Professional project presentation

**Costs:**
- ⏱️ Initial setup time (4-6 hours)
- ⏱️ Ongoing test maintenance
- 📦 Slightly larger dev dependencies

**ROI:** High for Phase 1, Medium for Phase 2, Low for Phase 3

## Alternatives Considered

### 1. Jest
**Pros:** Industry standard, mature
**Cons:** Slower, complex ES module setup, heavier
**Verdict:** ❌ Rejected - Vitest is better fit

### 2. No Testing
**Pros:** No setup cost
**Cons:** Risk of regressions, harder refactoring
**Verdict:** ❌ Not recommended for production code

### 3. Full E2E Testing (Playwright)
**Pros:** Tests real user workflows
**Cons:** Slow, brittle, hard to set up for Obsidian
**Verdict:** 🔮 Future consideration

## Decision: Recommendation

**✅ Implement Phase 1 Now**

**Rationale:**
1. **Low effort, high value** - 4-6 hours for significant quality improvement
2. **Easy wins** - ProcessorRegistry is perfect first target
3. **Enables TDD** - Future features can be test-driven
4. **Professional polish** - Shows engineering maturity
5. **No blocker** - Pure logic tests don't need complex mocking

**Phase 2** - Evaluate after Phase 1, based on value delivered

**Phase 3** - Defer until pain points emerge from manual testing

## Next Steps

1. **Review this proposal** - Discuss approach and priorities
2. **Install Vitest** - Follow TESTING_SETUP.md
3. **Write first tests** - Start with ProcessorRegistry
4. **Iterate** - Add more tests based on value/effort
5. **Document patterns** - Help future contributors

## Questions for Discussion

1. Do you want to proceed with Phase 1 (Vitest + ProcessorRegistry tests)?
2. Should we set up CI/CD integration now or later?
3. Any specific components you're concerned about that should be tested first?
4. What coverage threshold would you be comfortable with? (Recommend: 60%)

## References

- **Testing Strategy:** See `docs/TESTING_STRATEGY.md`
- **Setup Guide:** See `docs/TESTING_SETUP.md`
- **Vitest Docs:** https://vitest.dev/
- **Testing Best Practices:** https://testingjavascript.com/
