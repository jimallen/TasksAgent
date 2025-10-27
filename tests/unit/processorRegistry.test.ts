import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessorRegistry } from '../../src/emailProcessors/ProcessorRegistry';
import { LabelProcessorConfig } from '../../src/emailProcessors/LabelProcessor';
import { createMockGmailMessage, mockTranscriptEmail, mockActionEmail, mockEmailWithMultipleLabels } from '../mocks/gmailMessage.mock';

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

    it('should handle empty config array', () => {
      registry.initializeFromConfig([]);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(0);
    });

    it('should clear existing processors before initializing', () => {
      // First initialization
      registry.initializeFromConfig([
        { label: 'test1', folderName: 'Test1' }
      ]);

      expect(registry.getAllProcessors()).toHaveLength(1);

      // Second initialization should clear first
      registry.initializeFromConfig([
        { label: 'test2', folderName: 'Test2' }
      ]);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(1);
      expect(processors[0].label).toBe('test2');
    });

    it('should create processors with default promptType when not specified', () => {
      registry.initializeFromConfig([
        { label: 'newsletter', folderName: 'Newsletter' }
      ]);

      const processor = registry.getProcessorByLabel('newsletter');
      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('newsletter');
    });

    it('should create multiple processors with different prompt types', () => {
      const configs: LabelProcessorConfig[] = [
        { label: 'transcript', folderName: 'Transcript', promptType: 'meeting' },
        { label: 'action', folderName: 'Action', promptType: 'actionitem' },
        { label: 'standup', folderName: 'Standup', promptType: 'meeting' }
      ];

      registry.initializeFromConfig(configs);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(3);
      expect(processors.map(p => p.label)).toEqual(['transcript', 'action', 'standup']);
    });
  });

  describe('getProcessor', () => {
    beforeEach(() => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript', promptType: 'meeting' },
        { label: 'action', folderName: 'Action', promptType: 'actionitem' }
      ]);
    });

    it('should return matching processor for email with transcript label', () => {
      const email = mockTranscriptEmail;

      const processor = registry.getProcessor(email);

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('transcript');
    });

    it('should return matching processor for email with action label', () => {
      const email = mockActionEmail;

      const processor = registry.getProcessor(email);

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('action');
    });

    it('should return null when no processor matches', () => {
      const email = createMockGmailMessage({
        searchedLabels: ['unknown-label', 'nonexistent']
      });

      const processor = registry.getProcessor(email);

      expect(processor).toBeNull();
    });

    it('should return first matching processor when email has multiple labels', () => {
      const email = mockEmailWithMultipleLabels;

      const processor = registry.getProcessor(email);

      expect(processor).not.toBeNull();
      // Should match 'transcript' since it's registered first
      expect(processor?.label).toBe('transcript');
    });

    it('should return null for email with empty searchedLabels', () => {
      const email = createMockGmailMessage({
        searchedLabels: []
      });

      const processor = registry.getProcessor(email);

      expect(processor).toBeNull();
    });

    it('should match labels case-sensitively', () => {
      const email = createMockGmailMessage({
        searchedLabels: ['TRANSCRIPT'] // uppercase
      });

      const processor = registry.getProcessor(email);

      // Should not match if label matching is case-sensitive
      // This documents current behavior
      expect(processor).toBeNull();
    });
  });

  describe('getProcessorByLabel', () => {
    beforeEach(() => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript', promptType: 'meeting' },
        { label: 'action', folderName: 'Action', promptType: 'actionitem' },
        { label: 'standup', folderName: 'Standup', promptType: 'meeting' }
      ]);
    });

    it('should find processor by exact label match', () => {
      const processor = registry.getProcessorByLabel('transcript');

      expect(processor).not.toBeNull();
      expect(processor?.label).toBe('transcript');
      expect(processor?.folderName).toBe('Transcript');
    });

    it('should return null for non-existent label', () => {
      const processor = registry.getProcessorByLabel('nonexistent');

      expect(processor).toBeNull();
    });

    it('should return correct processor when multiple exist', () => {
      const transcriptProcessor = registry.getProcessorByLabel('transcript');
      const actionProcessor = registry.getProcessorByLabel('action');
      const standupProcessor = registry.getProcessorByLabel('standup');

      expect(transcriptProcessor?.label).toBe('transcript');
      expect(actionProcessor?.label).toBe('action');
      expect(standupProcessor?.label).toBe('standup');
    });

    it('should return null for empty string label', () => {
      const processor = registry.getProcessorByLabel('');

      expect(processor).toBeNull();
    });

    it('should be case-sensitive', () => {
      const processor = registry.getProcessorByLabel('TRANSCRIPT');

      expect(processor).toBeNull();
    });
  });

  describe('getAllProcessors', () => {
    it('should return empty array when no processors registered', () => {
      const processors = registry.getAllProcessors();

      expect(processors).toEqual([]);
      expect(processors).toHaveLength(0);
    });

    it('should return all registered processors', () => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript' },
        { label: 'action', folderName: 'Action' },
        { label: 'standup', folderName: 'Standup' }
      ]);

      const processors = registry.getAllProcessors();

      expect(processors).toHaveLength(3);
      expect(processors.map(p => p.label)).toEqual(['transcript', 'action', 'standup']);
    });

    it('should return processors in registration order', () => {
      registry.initializeFromConfig([
        { label: 'z-label', folderName: 'Z' },
        { label: 'a-label', folderName: 'A' },
        { label: 'm-label', folderName: 'M' }
      ]);

      const processors = registry.getAllProcessors();
      const labels = processors.map(p => p.label);

      // Should maintain config order, not alphabetical
      expect(labels).toEqual(['z-label', 'a-label', 'm-label']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle reinitialization without errors', () => {
      registry.initializeFromConfig([
        { label: 'test1', folderName: 'Test1' }
      ]);

      registry.initializeFromConfig([
        { label: 'test2', folderName: 'Test2' }
      ]);

      registry.initializeFromConfig([
        { label: 'test3', folderName: 'Test3' }
      ]);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(1);
      expect(processors[0].label).toBe('test3');
    });

    it('should handle config with duplicate labels', () => {
      // This tests current behavior - may want to add validation later
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript1' },
        { label: 'transcript', folderName: 'Transcript2' }
      ]);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(2);

      // getProcessorByLabel returns first match
      const processor = registry.getProcessorByLabel('transcript');
      expect(processor?.folderName).toBe('Transcript1');
    });

    it('should handle special characters in label names', () => {
      registry.initializeFromConfig([
        { label: 'meeting-notes', folderName: 'Meeting Notes' },
        { label: 'action_items', folderName: 'Action Items' },
        { label: 'q1-2025', folderName: 'Q1 2025' }
      ]);

      expect(registry.getProcessorByLabel('meeting-notes')).not.toBeNull();
      expect(registry.getProcessorByLabel('action_items')).not.toBeNull();
      expect(registry.getProcessorByLabel('q1-2025')).not.toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    it('should route different email types to appropriate processors', () => {
      registry.initializeFromConfig([
        { label: 'transcript', folderName: 'Transcript', promptType: 'meeting' },
        { label: 'action', folderName: 'Action', promptType: 'actionitem' },
        { label: 'standup', folderName: 'Standup', promptType: 'meeting' }
      ]);

      const transcriptEmail = createMockGmailMessage({ searchedLabels: ['transcript'] });
      const actionEmail = createMockGmailMessage({ searchedLabels: ['action'] });
      const standupEmail = createMockGmailMessage({ searchedLabels: ['standup'] });

      expect(registry.getProcessor(transcriptEmail)?.label).toBe('transcript');
      expect(registry.getProcessor(actionEmail)?.label).toBe('action');
      expect(registry.getProcessor(standupEmail)?.label).toBe('standup');
    });

    it('should handle typical configuration from plugin settings', () => {
      // Simulates real-world configuration
      const typicalConfig: LabelProcessorConfig[] = [
        {
          label: 'transcript',
          folderName: 'Transcript',
          promptType: 'meeting'
        },
        {
          label: 'action',
          folderName: 'Action',
          promptType: 'actionitem'
        }
      ];

      registry.initializeFromConfig(typicalConfig);

      const processors = registry.getAllProcessors();
      expect(processors).toHaveLength(2);

      // Verify both processors are working
      const transcriptEmail = mockTranscriptEmail;
      const actionEmail = mockActionEmail;

      expect(registry.getProcessor(transcriptEmail)).not.toBeNull();
      expect(registry.getProcessor(actionEmail)).not.toBeNull();
    });
  });
});
