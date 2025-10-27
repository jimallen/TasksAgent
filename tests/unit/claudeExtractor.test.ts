import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeTaskExtractor, TaskExtractionResult } from '../../src/claudeExtractor';
import {
  validExtractionResponse,
  minimalExtractionResponse,
  noTasksResponse,
  validJsonString,
  truncatedJson,
  invalidJsonTrailingComma,
  jsonWithMarkdown,
  jsonWithPreamble,
  createMockExtractionResponse
} from '../mocks/claudeResponse.mock';

describe('ClaudeTaskExtractor', () => {
  let extractor: ClaudeTaskExtractor;
  const testApiKey = 'test-api-key-123';
  const testModel = 'claude-3-5-haiku-20241022';

  beforeEach(() => {
    extractor = new ClaudeTaskExtractor(testApiKey, testModel);
  });

  describe('Constructor', () => {
    it('should initialize with provided API key and model', () => {
      expect(extractor).toBeInstanceOf(ClaudeTaskExtractor);
    });

    it('should use default model if not provided', () => {
      const defaultExtractor = new ClaudeTaskExtractor(testApiKey);
      expect(defaultExtractor).toBeInstanceOf(ClaudeTaskExtractor);
    });
  });

  describe('Prompt Building - buildPrompt()', () => {
    it('should include email subject in prompt', () => {
      const content = 'Meeting discussion about API changes';
      const subject = 'Q1 Planning Meeting';

      // Access private method through prototype
      const prompt = (extractor as any).buildPrompt(content, subject);

      expect(prompt).toContain('MEETING SUBJECT: Q1 Planning Meeting');
      expect(prompt).toContain(content);
    });

    it('should truncate content longer than 15000 characters', () => {
      const longContent = 'a'.repeat(20000);
      const subject = 'Test Meeting';

      const prompt = (extractor as any).buildPrompt(longContent, subject);

      expect(prompt).toContain('... [truncated]');
      expect(prompt.length).toBeLessThan(longContent.length + 5000);
    });

    it('should not truncate content under 15000 characters', () => {
      const shortContent = 'a'.repeat(10000);
      const subject = 'Test Meeting';

      const prompt = (extractor as any).buildPrompt(shortContent, subject);

      expect(prompt).not.toContain('... [truncated]');
      expect(prompt).toContain(shortContent);
    });

    it('should handle non-string content by converting to JSON', () => {
      const objContent = { message: 'test', data: [1, 2, 3] };
      const subject = 'Test';

      const prompt = (extractor as any).buildPrompt(objContent, subject);

      expect(prompt).toContain(JSON.stringify(objContent));
    });

    it('should include all required JSON fields in prompt', () => {
      const prompt = (extractor as any).buildPrompt('test', 'test');

      expect(prompt).toContain('tasks');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('participants');
      expect(prompt).toContain('meetingDate');
      expect(prompt).toContain('keyDecisions');
      expect(prompt).toContain('nextSteps');
    });

    it('should mention Google Meet AI suggestions', () => {
      const prompt = (extractor as any).buildPrompt('test', 'test');

      expect(prompt).toContain('Google Meet');
      expect(prompt).toContain('AI-suggested');
    });
  });

  describe('Prompt Building - buildActionItemPrompt()', () => {
    it('should create different prompt for action items', () => {
      const content = 'Please review the attached document';
      const subject = 'Action Required: Document Review';

      const prompt = (extractor as any).buildActionItemPrompt(content, subject);

      expect(prompt).toContain('EMAIL SUBJECT: Action Required: Document Review');
      expect(prompt).toContain(content);
      expect(prompt).not.toContain('MEETING');
    });

    it('should truncate action item content at 15000 chars', () => {
      const longContent = 'b'.repeat(20000);
      const subject = 'Action Items';

      const prompt = (extractor as any).buildActionItemPrompt(longContent, subject);

      expect(prompt).toContain('... [truncated]');
    });

    it('should handle non-string content in action items', () => {
      const objContent = { tasks: ['task1', 'task2'] };
      const subject = 'Tasks';

      const prompt = (extractor as any).buildActionItemPrompt(objContent, subject);

      expect(prompt).toContain(JSON.stringify(objContent));
    });
  });

  describe('Response Parsing - parseResponse()', () => {
    it('should parse valid JSON response', () => {
      const result = (extractor as any).parseResponse(validJsonString, 'test content');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].description).toBe('Review the API documentation');
      expect(result.tasks[0].assignee).toBe('John');
      expect(result.tasks[0].priority).toBe('high');
      expect(result.participants).toContain('John');
      expect(result.summary).toBeTruthy();
    });

    it('should handle response with markdown code blocks', () => {
      const result = (extractor as any).parseResponse(jsonWithMarkdown, 'test');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].description).toBe('Review the API documentation');
    });

    it('should extract JSON from response with preamble text', () => {
      const result = (extractor as any).parseResponse(jsonWithPreamble, 'test');

      expect(result.tasks).toHaveLength(2);
      expect(result.summary).toBeTruthy();
    });

    it('should handle missing optional fields with defaults', () => {
      const minimalJson = JSON.stringify({
        tasks: [
          {
            description: 'Test task',
            assignee: 'John',
            priority: 'high',
            confidence: 80
          }
        ]
      });

      const result = (extractor as any).parseResponse(minimalJson, 'test');

      expect(result.summary).toBe('Meeting transcript processed');
      expect(result.participants).toEqual([]);
      expect(result.keyDecisions).toEqual([]);
      expect(result.nextSteps).toEqual([]);
    });

    it('should filter out tasks with descriptions shorter than 5 chars', () => {
      const shortTaskJson = JSON.stringify({
        tasks: [
          { description: 'Go', assignee: 'John', priority: 'high', confidence: 90 },
          { description: 'Review documentation thoroughly', assignee: 'Sarah', priority: 'medium', confidence: 85 }
        ],
        summary: 'Test',
        participants: [],
        meetingDate: '2025-01-27',
        keyDecisions: [],
        nextSteps: []
      });

      const result = (extractor as any).parseResponse(shortTaskJson, 'test');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].description).toBe('Review documentation thoroughly');
    });

    it('should fall back on malformed JSON', () => {
      const result = (extractor as any).parseResponse(truncatedJson, 'I will complete the report');

      // Should fall back to regex-based extraction
      expect(result.confidence).toBeLessThan(50);
      expect(result.summary).toBeTruthy();
    });

    it('should handle JSON with trailing comma', () => {
      const result = (extractor as any).parseResponse(invalidJsonTrailingComma, 'test');

      // Should fall back due to parse error
      expect(result).toBeTruthy();
    });

    it('should parse dates correctly', () => {
      const result = (extractor as any).parseResponse(validJsonString, 'test');

      expect(result.meetingDate).toBeInstanceOf(Date);
    });

    it('should handle invalid date strings with current date', () => {
      const invalidDateJson = JSON.stringify({
        tasks: [],
        summary: 'Test',
        participants: [],
        meetingDate: 'invalid-date',
        keyDecisions: [],
        nextSteps: []
      });

      const result = (extractor as any).parseResponse(invalidDateJson, 'test');

      expect(result.meetingDate).toBeInstanceOf(Date);
    });
  });

  describe('Priority Normalization', () => {
    it('should normalize "high" priority variations', () => {
      expect((extractor as any).normalizePriority('high')).toBe('high');
      expect((extractor as any).normalizePriority('HIGH')).toBe('high');
      expect((extractor as any).normalizePriority('High Priority')).toBe('high');
      expect((extractor as any).normalizePriority('3')).toBe('high');
    });

    it('should normalize "low" priority variations', () => {
      expect((extractor as any).normalizePriority('low')).toBe('low');
      expect((extractor as any).normalizePriority('LOW')).toBe('low');
      expect((extractor as any).normalizePriority('1')).toBe('low');
    });

    it('should default to "medium" for unknown values', () => {
      expect((extractor as any).normalizePriority('medium')).toBe('medium');
      expect((extractor as any).normalizePriority('2')).toBe('medium');
      expect((extractor as any).normalizePriority('unknown')).toBe('medium');
      expect((extractor as any).normalizePriority('')).toBe('medium');
    });
  });

  describe('Confidence Normalization', () => {
    it('should clamp confidence to 0-100 range', () => {
      expect((extractor as any).normalizeConfidence(50)).toBe(50);
      expect((extractor as any).normalizeConfidence(150)).toBe(100);
      expect((extractor as any).normalizeConfidence(-10)).toBe(0);
    });

    it('should default to 75 for invalid values', () => {
      expect((extractor as any).normalizeConfidence('invalid')).toBe(75);
      expect((extractor as any).normalizeConfidence(NaN)).toBe(75);
      expect((extractor as any).normalizeConfidence(undefined)).toBe(75);
    });

    it('should handle string numbers', () => {
      expect((extractor as any).normalizeConfidence('85')).toBe(85);
      expect((extractor as any).normalizeConfidence('200')).toBe(100);
    });
  });

  describe('Description Cleaning', () => {
    it('should remove leading bullet points', () => {
      expect((extractor as any).cleanDescription('- Test task')).toBe('Test task');
      expect((extractor as any).cleanDescription('* Another task')).toBe('Another task');
      expect((extractor as any).cleanDescription('• Bullet task')).toBe('Bullet task');
    });

    it('should normalize whitespace', () => {
      expect((extractor as any).cleanDescription('Test   task   here')).toBe('Test task here');
      expect((extractor as any).cleanDescription('  Leading spaces')).toBe('Leading spaces');
    });

    it('should trim edges', () => {
      expect((extractor as any).cleanDescription('  Task  ')).toBe('Task');
    });
  });

  describe('Fallback Extraction', () => {
    it('should extract tasks from "I will" patterns', () => {
      const content = 'I will complete the report by Friday\nI need to review the documentation';

      const result = (extractor as any).fallbackExtraction(content, 'Test');

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].description).toContain('complete the report');
      expect(result.confidence).toBe(30);
    });

    it('should extract tasks from TODO patterns', () => {
      const content = 'TODO: Fix the login bug\nAction: Update schema';

      const result = (extractor as any).fallbackExtraction(content, 'Tasks');

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.some(t => t.description.includes('Fix the login bug'))).toBe(true);
    });

    it('should extract tasks from checkbox patterns', () => {
      const content = '[ ] Review PR\n[ ] Deploy to staging';

      const result = (extractor as any).fallbackExtraction(content, 'Checklist');

      expect(result.tasks.length).toBeGreaterThan(0);
    });

    it('should assign "Unassigned" to all fallback tasks', () => {
      const content = 'I will complete the task';

      const result = (extractor as any).fallbackExtraction(content, 'Test');

      expect(result.tasks.every(t => t.assignee === 'Unassigned')).toBe(true);
    });

    it('should assign medium priority to fallback tasks', () => {
      const content = 'TODO: Complete task';

      const result = (extractor as any).fallbackExtraction(content, 'Test');

      expect(result.tasks.every(t => t.priority === 'medium')).toBe(true);
    });

    it('should assign low confidence (50) to fallback tasks', () => {
      const content = 'I will do this';

      const result = (extractor as any).fallbackExtraction(content, 'Test');

      expect(result.tasks.every(t => t.confidence === 50)).toBe(true);
    });

    it('should extract participant names from email patterns', () => {
      const content = 'Meeting with John Smith and Sarah Johnson. CC: Mike Davis';

      const result = (extractor as any).fallbackExtraction(content, 'Meeting');

      expect(result.participants.length).toBeGreaterThan(0);
    });

    it('should deduplicate fallback tasks', () => {
      const content = 'I will complete the report\nI will complete the report';

      const result = (extractor as any).fallbackExtraction(content, 'Test');

      // Should deduplicate identical tasks
      expect(result.tasks.length).toBe(1);
    });

    it('should use subject as summary in fallback', () => {
      const result = (extractor as any).fallbackExtraction('content', 'Test Subject');

      expect(result.summary).toBe('Test Subject');
    });

    it('should default to "Meeting notes" if no subject', () => {
      const result = (extractor as any).fallbackExtraction('content', '');

      expect(result.summary).toBe('Meeting notes');
    });
  });

  describe('Overall Confidence Calculation', () => {
    it('should calculate average confidence from tasks', () => {
      const tasks = [
        { description: 'Task 1', assignee: 'John', priority: 'high' as const, confidence: 90, category: 'eng' },
        { description: 'Task 2', assignee: 'Sarah', priority: 'high' as const, confidence: 80, category: 'eng' }
      ];

      const confidence = (extractor as any).calculateOverallConfidence(tasks);

      expect(confidence).toBe(85);
    });

    it('should return 0 for empty task list', () => {
      const confidence = (extractor as any).calculateOverallConfidence([]);

      expect(confidence).toBe(0);
    });

    it('should round to nearest integer', () => {
      const tasks = [
        { description: 'Task', assignee: 'John', priority: 'high' as const, confidence: 91, category: 'eng' },
        { description: 'Task', assignee: 'John', priority: 'high' as const, confidence: 92, category: 'eng' },
        { description: 'Task', assignee: 'John', priority: 'high' as const, confidence: 93, category: 'eng' }
      ];

      const confidence = (extractor as any).calculateOverallConfidence(tasks);

      expect(confidence).toBe(92); // (91+92+93)/3 = 92
    });
  });

  describe('Task Deduplication', () => {
    it('should remove duplicate tasks with same description AND assignee', () => {
      const tasks = [
        { description: 'Review the documentation', assignee: 'John', priority: 'high' as const, confidence: 90, category: 'doc' },
        { description: 'Review the documentation', assignee: 'John', priority: 'medium' as const, confidence: 85, category: 'doc' },
        { description: 'Different task', assignee: 'Mike', priority: 'low' as const, confidence: 80, category: 'eng' }
      ];

      const deduplicated = (extractor as any).deduplicateTasks(tasks);

      expect(deduplicated.length).toBe(2); // Keeps first John task and Mike task
    });

    it('should keep tasks with same description but different assignees', () => {
      const tasks = [
        { description: 'Review documentation', assignee: 'John', priority: 'high' as const, confidence: 90, category: 'doc' },
        { description: 'Review documentation', assignee: 'Sarah', priority: 'high' as const, confidence: 85, category: 'doc' }
      ];

      const deduplicated = (extractor as any).deduplicateTasks(tasks);

      expect(deduplicated.length).toBe(2); // Different assignees means different tasks
    });

    it('should use case-insensitive comparison', () => {
      const tasks = [
        { description: 'Review Documentation', assignee: 'John', priority: 'high' as const, confidence: 90, category: 'doc' },
        { description: 'review documentation', assignee: 'john', priority: 'high' as const, confidence: 85, category: 'doc' }
      ];

      const deduplicated = (extractor as any).deduplicateTasks(tasks);

      expect(deduplicated.length).toBe(1); // Case-insensitive match
    });
  });

  describe('Integration: extractTasks() with no API key', () => {
    it('should use fallback extraction when API key is missing', async () => {
      const noKeyExtractor = new ClaudeTaskExtractor('', testModel);

      const result = await noKeyExtractor.extractTasks('I will complete the task', 'Test');

      expect(result.confidence).toBeLessThan(50);
      expect(result.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Integration: extractActionItems() with no API key', () => {
    it('should use fallback extraction for action items when API key is missing', async () => {
      const noKeyExtractor = new ClaudeTaskExtractor('', testModel);

      const result = await noKeyExtractor.extractActionItems('TODO: Fix bug', 'Bug Report');

      expect(result.confidence).toBeLessThan(50);
      expect(result.tasks.length).toBeGreaterThan(0);
    });
  });
});
