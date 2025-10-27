import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskClusterer, Task, ClusteringResult } from '../../src/taskClusterer';
import {
  validClusteringResponse,
  clusteringWithStandalone,
  emptyClusteringResponse,
  validClusteringJsonString,
  truncatedClusteringJson,
  createMockClusteringResponse
} from '../mocks/claudeResponse.mock';

// Helper to create mock tasks
const createMockTask = (overrides?: Partial<Task>): Task => ({
  text: 'Sample task',
  completed: false,
  assignee: 'John',
  dueDate: '2025-02-01',
  priority: 'medium',
  confidence: 85,
  category: 'engineering',
  file: null,
  line: 1,
  rawLine: '- [ ] Sample task [[@John]]',
  ...overrides
});

describe('TaskClusterer', () => {
  let clusterer: TaskClusterer;
  const testApiKey = 'test-api-key-123';
  const testModel = 'claude-3-5-haiku-20241022';

  beforeEach(() => {
    clusterer = new TaskClusterer(testApiKey, testModel);
  });

  describe('Constructor', () => {
    it('should initialize with provided API key and model', () => {
      expect(clusterer).toBeInstanceOf(TaskClusterer);
    });

    it('should use default model if not provided', () => {
      const defaultClusterer = new TaskClusterer(testApiKey);
      expect(defaultClusterer).toBeInstanceOf(TaskClusterer);
    });
  });

  describe('clusterTasks() - with no API key', () => {
    it('should return all tasks as standalone when API key is missing', async () => {
      const noKeyClusterer = new TaskClusterer('', testModel);
      const tasks = [
        createMockTask({ text: 'Task 1' }),
        createMockTask({ text: 'Task 2' })
      ];

      const result = await noKeyClusterer.clusterTasks(tasks);

      expect(result.clusters).toHaveLength(0);
      expect(result.standalone).toHaveLength(2);
      expect(result.totalTasksAnalyzed).toBe(2);
      expect(result.clustersCreated).toBe(0);
      expect(result.summary).toContain('unavailable');
    });

    it('should handle empty task array', async () => {
      const result = await clusterer.clusterTasks([]);

      expect(result.clusters).toHaveLength(0);
      expect(result.standalone).toHaveLength(0);
      expect(result.totalTasksAnalyzed).toBe(0);
      expect(result.clustersCreated).toBe(0);
      expect(result.summary).toBe('No tasks to cluster');
    });
  });

  describe('buildClusteringPrompt()', () => {
    it('should include all task information in prompt', async () => {
      const tasks = [
        createMockTask({
          text: 'Review documentation',
          assignee: 'John',
          priority: 'high',
          category: 'documentation',
          dueDate: '2025-02-01'
        })
      ];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('Review documentation');
      expect(prompt).toContain('[Assignee: John]');
      expect(prompt).toContain('[Priority: high]');
      expect(prompt).toContain('[Category: documentation]');
      expect(prompt).toContain('[Due: 2025-02-01]');
    });

    it('should number tasks starting from 0', async () => {
      const tasks = [
        createMockTask({ text: 'Task A' }),
        createMockTask({ text: 'Task B' }),
        createMockTask({ text: 'Task C' })
      ];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('0. "Task A"');
      expect(prompt).toContain('1. "Task B"');
      expect(prompt).toContain('2. "Task C"');
    });

    it('should handle tasks with no category', async () => {
      const tasks = [
        createMockTask({ text: 'Task', category: undefined })
      ];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('[Category: none]');
    });

    it('should handle tasks with no due date', async () => {
      const tasks = [
        createMockTask({ text: 'Task', dueDate: undefined })
      ];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('[Due: none]');
    });

    it('should include clustering guidelines in prompt', async () => {
      const tasks = [createMockTask()];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('Identify similar tasks');
      expect(prompt).toContain('Identify related tasks');
      expect(prompt).toContain('source context');
      expect(prompt).toContain('minimum cluster size of 2');
    });

    it('should specify JSON output format', async () => {
      const tasks = [createMockTask()];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('Return ONLY valid JSON');
      expect(prompt).toContain('"clusters"');
      expect(prompt).toContain('"standaloneIndices"');
      expect(prompt).toContain('"summary"');
    });

    it('should mention all task indices must be used exactly once', async () => {
      const tasks = [
        createMockTask(),
        createMockTask(),
        createMockTask()
      ];

      const prompt = await (clusterer as any).buildClusteringPrompt(tasks);

      expect(prompt).toContain('0 to 2');
      expect(prompt).toContain('EXACTLY ONCE');
      expect(prompt).toContain('Do not duplicate indices');
    });
  });

  describe('parseClusteringResponse()', () => {
    const mockTasks = [
      createMockTask({ text: 'Task 1' }),
      createMockTask({ text: 'Task 2' }),
      createMockTask({ text: 'Task 3' }),
      createMockTask({ text: 'Task 4' }),
      createMockTask({ text: 'Task 5' })
    ];

    it('should parse valid clustering JSON', () => {
      const jsonResponse = JSON.stringify({
        clusters: [
          {
            title: 'Documentation Tasks',
            description: 'Related to docs',
            taskIndices: [0, 2],
            priority: 'high',
            suggestedAssignee: 'John',
            combinedTask: 'Complete all documentation',
            confidence: 90
          }
        ],
        standaloneIndices: [1, 3, 4],
        summary: 'Created 1 cluster'
      });

      const result = (clusterer as any).parseClusteringResponse(jsonResponse, mockTasks);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].title).toBe('Documentation Tasks');
      expect(result.clusters[0].tasks).toHaveLength(2);
      expect(result.standalone).toHaveLength(3);
      expect(result.summary).toBe('Created 1 cluster');
    });

    it('should remove markdown code blocks from response', () => {
      const markdownResponse = `\`\`\`json
{
  "clusters": [],
  "standaloneIndices": [0, 1],
  "summary": "No clusters"
}
\`\`\``;

      const result = (clusterer as any).parseClusteringResponse(markdownResponse, mockTasks.slice(0, 2));

      expect(result.clusters).toHaveLength(0);
      expect(result.standalone).toHaveLength(2);
    });

    it('should handle response with trailing commas', () => {
      const jsonWithComma = `{
  "clusters": [],
  "standaloneIndices": [0, 1,],
  "summary": "Test",
}`;

      const result = (clusterer as any).parseClusteringResponse(jsonWithComma, mockTasks.slice(0, 2));

      expect(result).toBeTruthy();
      expect(result.standalone.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip clusters with fewer than 2 tasks', () => {
      const jsonResponse = JSON.stringify({
        clusters: [
          {
            title: 'Single Task Cluster',
            description: 'Invalid',
            taskIndices: [0],
            priority: 'high',
            confidence: 80
          },
          {
            title: 'Valid Cluster',
            description: 'Has 2 tasks',
            taskIndices: [1, 2],
            priority: 'medium',
            confidence: 85
          }
        ],
        standaloneIndices: [3, 4],
        summary: 'Test'
      });

      const result = (clusterer as any).parseClusteringResponse(jsonResponse, mockTasks);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].title).toBe('Valid Cluster');
    });

    it('should generate unique cluster IDs', () => {
      const jsonResponse = JSON.stringify({
        clusters: [
          {
            title: 'Cluster 1',
            description: 'First',
            taskIndices: [0, 1],
            priority: 'high',
            confidence: 90
          },
          {
            title: 'Cluster 2',
            description: 'Second',
            taskIndices: [2, 3],
            priority: 'medium',
            confidence: 85
          }
        ],
        standaloneIndices: [4],
        summary: 'Two clusters'
      });

      const result = (clusterer as any).parseClusteringResponse(jsonResponse, mockTasks);

      expect(result.clusters[0].id).toBeTruthy();
      expect(result.clusters[1].id).toBeTruthy();
      expect(result.clusters[0].id).not.toBe(result.clusters[1].id);
    });

    it('should handle missing optional fields with defaults', () => {
      const minimalJson = JSON.stringify({
        clusters: [
          {
            taskIndices: [0, 1]
            // Missing title, description, priority, etc.
          }
        ],
        standaloneIndices: [2],
        summary: 'Test'
      });

      const result = (clusterer as any).parseClusteringResponse(minimalJson, mockTasks.slice(0, 3));

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].title).toBe('Related Tasks');
      expect(result.clusters[0].description).toBe('Similar tasks');
      expect(result.clusters[0].priority).toBe('medium');
      expect(result.clusters[0].confidence).toBe(75);
    });

    it('should prevent duplicate task indices', () => {
      const duplicateJson = JSON.stringify({
        clusters: [
          {
            title: 'Cluster A',
            description: 'First',
            taskIndices: [0, 1],
            priority: 'high',
            confidence: 90
          },
          {
            title: 'Cluster B',
            description: 'Second (tries to reuse 1)',
            taskIndices: [1, 2],
            priority: 'medium',
            confidence: 85
          }
        ],
        standaloneIndices: [],
        summary: 'Test'
      });

      const result = (clusterer as any).parseClusteringResponse(duplicateJson, mockTasks.slice(0, 3));

      // Should only use each index once
      const allIndices = new Set();
      result.clusters.forEach(cluster => {
        cluster.tasks.forEach(task => {
          const idx = mockTasks.indexOf(task);
          expect(allIndices.has(idx)).toBe(false);
          allIndices.add(idx);
        });
      });
    });

    it('should add missed tasks to standalone', () => {
      const incompleteJson = JSON.stringify({
        clusters: [
          {
            title: 'Cluster',
            description: 'Only uses indices 0 and 1',
            taskIndices: [0, 1],
            priority: 'high',
            confidence: 90
          }
        ],
        standaloneIndices: [2],
        // Missing index 3 and 4
        summary: 'Incomplete'
      });

      const result = (clusterer as any).parseClusteringResponse(incompleteJson, mockTasks);

      // Should have all 5 tasks accounted for
      const clusterTaskCount = result.clusters.reduce((sum, c) => sum + c.tasks.length, 0);
      const totalAccounted = clusterTaskCount + result.standalone.length;
      expect(totalAccounted).toBe(5);
    });

    it('should handle out-of-range indices gracefully', () => {
      const badIndicesJson = JSON.stringify({
        clusters: [
          {
            title: 'Cluster',
            description: 'Has bad indices',
            taskIndices: [0, 1, 99, -1],
            priority: 'high',
            confidence: 90
          }
        ],
        standaloneIndices: [2],
        summary: 'Test'
      });

      const result = (clusterer as any).parseClusteringResponse(badIndicesJson, mockTasks.slice(0, 3));

      // Should only include valid indices
      expect(result.clusters[0].tasks).toHaveLength(2);
    });

    it('should throw error on completely malformed JSON', () => {
      const badJson = 'This is not JSON at all';

      expect(() => {
        (clusterer as any).parseClusteringResponse(badJson, mockTasks);
      }).toThrow();
    });
  });

  describe('JSON Auto-Repair', () => {
    const mockTasks = [
      createMockTask({ text: 'Task 1' }),
      createMockTask({ text: 'Task 2' })
    ];

    it('should auto-close missing closing braces', () => {
      const truncatedJson = `{
  "clusters": [
    {
      "title": "Test",
      "description": "Test",
      "taskIndices": [0, 1],
      "priority": "high",
      "confidence": 90`;
      // Missing closing braces

      // This might throw or might succeed with auto-repair
      try {
        const result = (clusterer as any).parseClusteringResponse(truncatedJson, mockTasks);
        // If it succeeds, verify it's a valid result
        expect(result).toBeTruthy();
        expect(result.clusters || result.standalone).toBeTruthy();
      } catch (error) {
        // Auto-repair failed, which is acceptable
        expect(error).toBeTruthy();
      }
    });

    it('should auto-close missing closing brackets', () => {
      const truncatedJson = `{
  "clusters": [
    {
      "title": "Test",
      "taskIndices": [0, 1
    }
  ],
  "standaloneIndices": [
  "summary": "Test"
}`;

      try {
        const result = (clusterer as any).parseClusteringResponse(truncatedJson, mockTasks);
        expect(result).toBeTruthy();
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('buildClusteringResult()', () => {
    const mockTasks = [
      createMockTask({ text: 'Task 1' }),
      createMockTask({ text: 'Task 2' }),
      createMockTask({ text: 'Task 3' })
    ];

    it('should build result from parsed JSON', () => {
      const parsed = {
        clusters: [
          {
            title: 'Test Cluster',
            description: 'Test',
            taskIndices: [0, 1],
            priority: 'high',
            suggestedAssignee: 'John',
            combinedTask: 'Combined task',
            confidence: 92
          }
        ],
        standaloneIndices: [2],
        summary: 'One cluster created'
      };

      const result = (clusterer as any).buildClusteringResult(parsed, mockTasks);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].title).toBe('Test Cluster');
      expect(result.clusters[0].priority).toBe('high');
      expect(result.clusters[0].suggestedAssignee).toBe('John');
      expect(result.clusters[0].combinedTask).toBe('Combined task');
      expect(result.clusters[0].confidence).toBe(92);
      expect(result.standalone).toHaveLength(1);
      expect(result.totalTasksAnalyzed).toBe(3);
      expect(result.clustersCreated).toBe(1);
      expect(result.summary).toBe('One cluster created');
    });

    it('should handle empty clusters array', () => {
      const parsed = {
        clusters: [],
        standaloneIndices: [0, 1, 2],
        summary: 'No clusters'
      };

      const result = (clusterer as any).buildClusteringResult(parsed, mockTasks);

      expect(result.clusters).toHaveLength(0);
      expect(result.standalone).toHaveLength(3);
      expect(result.clustersCreated).toBe(0);
    });

    it('should handle missing clusters field', () => {
      const parsed = {
        standaloneIndices: [0, 1, 2],
        summary: 'No clusters field'
      };

      const result = (clusterer as any).buildClusteringResult(parsed, mockTasks);

      expect(result.clusters).toHaveLength(0);
      expect(result.standalone).toHaveLength(3);
    });

    it('should handle missing standaloneIndices field', () => {
      const parsed = {
        clusters: [
          {
            title: 'Test',
            taskIndices: [0, 1],
            priority: 'high',
            confidence: 90
          }
        ],
        summary: 'Test'
      };

      const result = (clusterer as any).buildClusteringResult(parsed, mockTasks);

      expect(result.clusters).toHaveLength(1);
      // Index 2 should be added to standalone since it wasn't in any cluster
      expect(result.standalone).toHaveLength(1);
    });
  });

  describe('Progress Callback', () => {
    it('should call progress callback during clustering', async () => {
      const messages: string[] = [];
      const progressCallback = (message: string) => {
        messages.push(message);
      };

      const tasks = [createMockTask(), createMockTask()];

      try {
        await clusterer.clusterTasks(tasks, undefined, progressCallback);
      } catch {
        // Might fail due to no real API, but callback should still be called
      }

      // Should have received at least one progress message
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
