import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logError, logInfo } from '../utils/logger';
import { TranscriptContent } from '../parsers/transcriptParser';

export interface ExtractedTask {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dueDate?: string;
  category?: string;
  context?: string;
}

export interface AIExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: string[];
}

export class AITaskExtractor {
  private client: Client | null = null;
  private transport: any = null;

  /**
   * Connect to Claude via MCP for AI-powered extraction
   */
  async connect(): Promise<void> {
    try {
      // Transport is handled internally by the Client
      this.transport = null;

      this.client = new Client({
        name: 'meeting-transcript-agent',
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      logInfo('Connected to Claude MCP for AI task extraction');
    } catch (error) {
      logError('Failed to connect to Claude MCP', error);
      throw error;
    }
  }

  /**
   * Extract tasks using Claude AI
   */
  async extractTasksWithAI(transcript: TranscriptContent): Promise<AIExtractionResult> {
    if (!this.client) {
      await this.connect();
    }

    const prompt = this.buildExtractionPrompt(transcript);
    
    try {
      const response = await this.callClaude(prompt);
      return this.parseClaudeResponse(response);
    } catch (error) {
      logError('AI task extraction failed', error);
      // Fallback to basic extraction
      return this.fallbackExtraction(transcript);
    }
  }

  /**
   * Build extraction prompt for Claude
   */
  private buildExtractionPrompt(transcript: TranscriptContent): string {
    return `
    Analyze this meeting transcript and extract structured information.
    
    Meeting Transcript:
    ${transcript.text}
    
    Please extract and return in JSON format:
    1. Tasks/Action Items:
       - Description (what needs to be done)
       - Assignee (who will do it - default to "me" if unclear)
       - Priority (high/medium/low based on context)
       - Confidence score (0-100)
       - Due date (if mentioned)
       - Category (engineering/product/design/operations/other)
       - Context (brief context about why this task is needed)
    
    2. Meeting Summary (2-3 sentences)
    3. List of participants
    4. Meeting date
    5. Key decisions made
    6. Next steps beyond specific tasks
    
    Focus on:
    - Explicit action items ("I'll do X", "Let's Y", "We need to Z")
    - Commitments made by participants
    - Follow-ups mentioned
    - Deadlines or timeframes discussed
    
    Avoid:
    - General discussion points that aren't actionable
    - Questions without clear owners
    - Past tense descriptions of completed work
    
    Return ONLY valid JSON matching this structure:
    {
      "tasks": [...],
      "summary": "...",
      "participants": [...],
      "meetingDate": "ISO date string",
      "keyDecisions": [...],
      "nextSteps": [...]
    }
    `;
  }

  /**
   * Call Claude via MCP
   */
  private async callClaude(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Claude MCP client not connected');
    }

    try {
      // Use the MCP protocol to call Claude
      const result = await this.client.callTool({
        name: 'claude_extract',
        arguments: {
          prompt,
          model: 'claude-3-haiku', // Use fast model for extraction
          max_tokens: 2000,
          temperature: 0.1, // Low temperature for consistent extraction
        }
      });

      return result.content as string;
    } catch (error) {
      logError('Claude API call failed', error);
      throw error;
    }
  }

  /**
   * Parse Claude's response
   */
  private parseClaudeResponse(response: string): AIExtractionResult {
    try {
      // Claude should return valid JSON
      const parsed = JSON.parse(response);
      
      // Validate and normalize the response
      return {
        tasks: (parsed.tasks || []).map((task: any) => ({
          description: task.description || '',
          assignee: task.assignee || 'me',
          priority: task.priority || 'medium',
          confidence: task.confidence || 75,
          dueDate: task.dueDate,
          category: task.category,
          context: task.context,
        })),
        summary: parsed.summary || '',
        participants: parsed.participants || [],
        meetingDate: parsed.meetingDate ? new Date(parsed.meetingDate) : new Date(),
        keyDecisions: parsed.keyDecisions || [],
        nextSteps: parsed.nextSteps || [],
      };
    } catch (error) {
      logError('Failed to parse Claude response', error);
      throw error;
    }
  }

  /**
   * Fallback extraction using patterns
   */
  private fallbackExtraction(transcript: TranscriptContent): AIExtractionResult {
    logInfo('Using fallback pattern-based extraction');
    
    // Use existing extracted tasks from transcriptParser
    const tasks: ExtractedTask[] = (transcript.extractedTasks || []).map(task => ({
      description: task,
      assignee: 'me',
      priority: 'medium' as const,
      confidence: 60,
    }));

    // Extract participants from sections
    const participants = new Set<string>();
    if (transcript.sections) {
      transcript.sections.forEach(section => {
        if (section.speaker) {
          participants.add(section.speaker);
        }
      });
    }

    return {
      tasks,
      summary: `Meeting transcript processed with ${tasks.length} tasks extracted`,
      participants: Array.from(participants),
      meetingDate: transcript.metadata?.creationDate || new Date(),
      keyDecisions: [],
      nextSteps: [],
    };
  }

  /**
   * Calculate confidence score for a task
   */
  calculateTaskConfidence(task: string, context: string): number {
    let confidence = 50; // Base confidence

    // Increase confidence for explicit patterns
    const highConfidencePatterns = [
      /^I will/i,
      /^I'll/i,
      /action item:/i,
      /assigned to/i,
      /by [A-Z][a-z]+ \d+/i, // Date patterns
    ];

    const mediumConfidencePatterns = [
      /we should/i,
      /let's/i,
      /need to/i,
      /have to/i,
      /must/i,
    ];

    for (const pattern of highConfidencePatterns) {
      if (pattern.test(task) || pattern.test(context)) {
        confidence += 20;
      }
    }

    for (const pattern of mediumConfidencePatterns) {
      if (pattern.test(task) || pattern.test(context)) {
        confidence += 10;
      }
    }

    // Cap at 100
    return Math.min(confidence, 100);
  }

  /**
   * Extract due dates from text
   */
  extractDueDate(text: string): string | undefined {
    const datePatterns = [
      /by (\w+ \d+(?:st|nd|rd|th)?(?:,? \d{4})?)/i,
      /before (\w+ \d+(?:st|nd|rd|th)?(?:,? \d{4})?)/i,
      /(?:due|deadline):?\s*(\w+ \d+(?:st|nd|rd|th)?(?:,? \d{4})?)/i,
      /(?:end of|EOD|COB)\s+(\w+)/i,
      /(?:next|this)\s+(\w+day)/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        try {
          // Attempt to parse the date
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch {
          // If parsing fails, return the raw string
          return match[1];
        }
      }
    }

    return undefined;
  }

  /**
   * Categorize task based on content
   */
  categorizeTask(task: string): string {
    const categories: Record<string, string[]> = {
      engineering: ['code', 'implement', 'fix', 'bug', 'deploy', 'test', 'api', 'database', 'backend', 'frontend'],
      product: ['feature', 'requirement', 'user story', 'spec', 'roadmap', 'launch', 'release'],
      design: ['mockup', 'wireframe', 'ui', 'ux', 'prototype', 'figma', 'sketch'],
      operations: ['process', 'workflow', 'automation', 'infrastructure', 'monitoring', 'alert'],
      documentation: ['document', 'readme', 'guide', 'wiki', 'tutorial'],
      communication: ['email', 'slack', 'meeting', 'present', 'demo', 'share'],
    };

    const taskLower = task.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Rank tasks by priority
   */
  prioritizeTasks(tasks: ExtractedTask[]): ExtractedTask[] {
    return tasks.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Deduplicate similar tasks
   */
  deduplicateTasks(tasks: ExtractedTask[]): ExtractedTask[] {
    const uniqueTasks: ExtractedTask[] = [];
    const seenDescriptions = new Set<string>();

    for (const task of tasks) {
      const normalizedDesc = task.description.toLowerCase().trim();
      
      // Check for similar existing task
      let isDuplicate = false;
      for (const seen of seenDescriptions) {
        if (this.areSimilarTasks(normalizedDesc, seen)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueTasks.push(task);
        seenDescriptions.add(normalizedDesc);
      }
    }

    return uniqueTasks;
  }

  /**
   * Check if two tasks are similar
   */
  private areSimilarTasks(task1: string, task2: string): boolean {
    // Simple similarity check - can be enhanced with better algorithms
    const words1 = new Set(task1.split(/\s+/));
    const words2 = new Set(task2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.7; // 70% similarity threshold
  }

  /**
   * Disconnect from Claude MCP
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    logInfo('Disconnected from Claude MCP');
  }
}

// Export singleton instance
export const aiTaskExtractor = new AITaskExtractor();