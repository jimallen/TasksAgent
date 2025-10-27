/**
 * Mock Claude API responses for testing
 * Covers valid responses, malformed JSON, and edge cases
 */

import { TaskExtractionResult } from '../../src/claudeExtractor';
import { ClusteringResult } from '../../src/taskClusterer';

// Valid extraction response
export const validExtractionResponse: TaskExtractionResult = {
  tasks: [
    {
      description: "Review the API documentation",
      assignee: "John",
      priority: "high",
      confidence: 95,
      dueDate: "2025-02-01",
      category: "documentation",
      context: "Need to verify endpoint specifications",
      rawText: "John, can you review the API docs by next week?"
    },
    {
      description: "Update database schema",
      assignee: "Sarah",
      priority: "medium",
      confidence: 88,
      category: "engineering",
      context: "Migration for new user fields",
      rawText: "Sarah will update the schema"
    }
  ],
  summary: "Team discussed API documentation review and database schema updates",
  participants: ["John", "Sarah", "Mike"],
  meetingDate: new Date("2025-01-27"),
  keyDecisions: ["Approved API v2 migration", "Postponed UI redesign to Q2"],
  nextSteps: [
    {
      description: "Schedule follow-up meeting",
      assignee: "Mike",
      priority: "low"
    }
  ],
  confidence: 90
};

// Response with missing optional fields
export const minimalExtractionResponse: TaskExtractionResult = {
  tasks: [
    {
      description: "Fix bug in login flow",
      assignee: "Unassigned",
      priority: "high",
      confidence: 75,
      category: "engineering"
    }
  ],
  summary: "Bug report discussed",
  participants: [],
  meetingDate: new Date("2025-01-27"),
  keyDecisions: [],
  nextSteps: [],
  confidence: 75
};

// Response with empty tasks
export const noTasksResponse: TaskExtractionResult = {
  tasks: [],
  summary: "General discussion with no action items",
  participants: ["Team"],
  meetingDate: new Date("2025-01-27"),
  keyDecisions: [],
  nextSteps: [],
  confidence: 100
};

// Valid JSON string responses (what Claude actually returns)
export const validJsonString = JSON.stringify(validExtractionResponse);

export const minimalJsonString = JSON.stringify(minimalExtractionResponse);

// Malformed JSON - missing closing brace
export const truncatedJson = `{
  "tasks": [
    {
      "description": "Review documentation",
      "assignee": "John",
      "priority": "high",
      "confidence": 90,
      "category": "documentation"
    }
  ],
  "summary": "Meeting summary"`;

// Malformed JSON - trailing comma
export const invalidJsonTrailingComma = `{
  "tasks": [],
  "summary": "Test",
  "participants": ["John"],
  "meetingDate": "2025-01-27",
  "keyDecisions": [],
  "nextSteps": [],
  "confidence": 90,
}`;

// Response with markdown formatting (needs cleaning)
export const jsonWithMarkdown = `\`\`\`json
${validJsonString}
\`\`\``;

// Response with explanatory text before JSON
export const jsonWithPreamble = `Here's the extraction result:

${validJsonString}

This includes 2 tasks from the meeting.`;

// Valid clustering response
export const validClusteringResponse: ClusteringResult = {
  clusters: [
    {
      id: "cluster-001",
      title: "API Documentation Review",
      description: "Tasks related to API documentation and specs",
      tasks: [],
      priority: "high",
      suggestedAssignee: "John",
      combinedTask: "Complete API documentation review and update specs",
      confidence: 92
    },
    {
      id: "cluster-002",
      title: "Database Schema Updates",
      description: "Schema migration and data model changes",
      tasks: [],
      priority: "medium",
      confidence: 85
    }
  ],
  standalone: [],
  totalTasksAnalyzed: 5,
  clustersCreated: 2,
  summary: "Created 2 clusters from 5 tasks"
};

// Clustering response with standalone tasks
export const clusteringWithStandalone: ClusteringResult = {
  clusters: [
    {
      id: "cluster-001",
      title: "Documentation Tasks",
      description: "Related documentation work",
      tasks: [],
      priority: "high",
      confidence: 88
    }
  ],
  standalone: [],
  totalTasksAnalyzed: 3,
  clustersCreated: 1,
  summary: "1 cluster created, 2 tasks remain standalone"
};

// Empty clustering result
export const emptyClusteringResponse: ClusteringResult = {
  clusters: [],
  standalone: [],
  totalTasksAnalyzed: 0,
  clustersCreated: 0,
  summary: "No tasks to cluster"
};

// JSON strings for clustering
export const validClusteringJsonString = JSON.stringify(validClusteringResponse);

export const truncatedClusteringJson = `{
  "clusters": [
    {
      "id": "cluster-001",
      "title": "Test Cluster",
      "description": "Test"`;

// Helper to create custom extraction responses
export const createMockExtractionResponse = (overrides?: Partial<TaskExtractionResult>): TaskExtractionResult => ({
  ...validExtractionResponse,
  ...overrides
});

// Helper to create custom clustering responses
export const createMockClusteringResponse = (overrides?: Partial<ClusteringResult>): ClusteringResult => ({
  ...validClusteringResponse,
  ...overrides
});
