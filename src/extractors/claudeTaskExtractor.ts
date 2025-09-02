import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import type { TranscriptContent } from '../parsers/transcriptParser';
import axios from 'axios';

export interface ExtractedTask {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dueDate?: string;
  category?: string;
  context?: string;
  rawText?: string;
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
}

export class ClaudeTaskExtractor {
  private apiUrl: string;
  private model: string;

  constructor() {
    // Get from environment or config
    this.apiUrl = process.env['CLAUDE_API_URL'] || 'https://api.anthropic.com/v1/messages';
    this.model = process.env['CLAUDE_MODEL'] || 'claude-3-haiku-20240307';
  }

  /**
   * Get API key at runtime to support dynamic setting
   */
  private getApiKey(): string {
    return process.env['ANTHROPIC_API_KEY'] || '';
  }

  /**
   * Extract tasks using Claude API
   */
  async extractTasks(transcript: TranscriptContent): Promise<TaskExtractionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logWarn('No Claude API key found, using fallback extraction');
      return this.fallbackExtraction(transcript);
    }

    try {
      const prompt = this.buildPrompt(transcript);
      const response = await this.callClaude(prompt);
      return this.parseResponse(response, transcript);
    } catch (error) {
      logError('Claude task extraction failed, using fallback', error);
      return this.fallbackExtraction(transcript);
    }
  }

  /**
   * Build the extraction prompt
   */
  private buildPrompt(transcript: TranscriptContent): string {
    const contextInfo = transcript.sections 
      ? `\nThe transcript has ${transcript.sections.length} sections with ${new Set(transcript.sections.map(s => s.speaker).filter(Boolean)).size} unique speakers.`
      : '';

    return `You are an expert at extracting actionable tasks from meeting transcripts. Analyze the following meeting transcript and extract all tasks, action items, and commitments.

TRANSCRIPT:
${transcript.text.substring(0, 15000)} ${transcript.text.length > 15000 ? '... [truncated]' : ''}
${contextInfo}

Extract the following information and return as JSON:

1. **Tasks** - Array of task objects with:
   - description: Clear, actionable task description
   - assignee: Person responsible (default "me" if unclear)
   - priority: "high", "medium", or "low" based on urgency/importance
   - confidence: 0-100 score of how confident you are this is a real task
   - dueDate: ISO date string if mentioned (optional)
   - category: engineering/product/design/documentation/communication/other
   - context: Brief context about why this task exists
   - rawText: The original text that led to this task

2. **Summary** - 2-3 sentence meeting summary

3. **Participants** - Array of participant names

4. **MeetingDate** - ISO date string

5. **KeyDecisions** - Array of important decisions made

6. **NextSteps** - Array of general next steps beyond specific tasks

Guidelines:
- Focus on explicit commitments ("I will", "I'll", "Let me", "I can")
- Include tasks with deadlines or time constraints
- Capture follow-ups and action items
- Ignore general discussions or past work
- Be conservative - only extract clear tasks

Return ONLY valid JSON, no other text:`;
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key available');
    }
    
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.2,
          system: 'You are a task extraction assistant. Always respond with valid JSON only, no markdown or explanations.'
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data?.content?.[0]?.text) {
        return response.data.content[0].text;
      }

      throw new Error('Invalid Claude API response structure');
    } catch (error: any) {
      if (error.response?.status === 401) {
        logError('Invalid Claude API key');
      } else if (error.response?.status === 429) {
        logError('Claude API rate limit exceeded');
      }
      throw error;
    }
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string, transcript: TranscriptContent): TaskExtractionResult {
    try {
      // Extract JSON from response (in case there's any surrounding text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize
      const tasks = this.normalizeTasks(parsed.tasks || parsed.Tasks || []);
      const participants = this.extractParticipants(parsed.participants || parsed.Participants || [], transcript);
      
      return {
        tasks: this.deduplicateTasks(tasks),
        summary: parsed.summary || parsed.Summary || 'Meeting transcript processed',
        participants,
        meetingDate: this.parseDate(parsed.meetingDate || parsed.MeetingDate) || new Date(),
        keyDecisions: parsed.keyDecisions || parsed.KeyDecisions || [],
        nextSteps: parsed.nextSteps || parsed.NextSteps || [],
        confidence: this.calculateOverallConfidence(tasks)
      };
    } catch (error) {
      logError('Failed to parse Claude response', error);
      logDebug('Raw response:', { response });
      return this.fallbackExtraction(transcript);
    }
  }

  /**
   * Normalize task objects
   */
  private normalizeTasks(tasks: any[]): ExtractedTask[] {
    return tasks.map(task => ({
      description: this.cleanDescription(task.description || task.Description || ''),
      assignee: task.assignee || task.Assignee || 'me',
      priority: this.normalizePriority(task.priority || task.Priority),
      confidence: this.normalizeConfidence(task.confidence || task.Confidence),
      dueDate: task.dueDate || task.DueDate,
      category: task.category || task.Category || 'other',
      context: task.context || task.Context,
      rawText: task.rawText || task.RawText
    })).filter(task => task.description && task.description.length > 5);
  }

  /**
   * Clean task description
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/^[-*•]\s*/, '') // Remove bullet points
      .replace(/^\d+\.\s*/, '') // Remove numbering
      .trim();
  }

  /**
   * Normalize priority value
   */
  private normalizePriority(priority: any): 'high' | 'medium' | 'low' {
    const p = String(priority).toLowerCase();
    if (p.includes('high') || p === '1') return 'high';
    if (p.includes('low') || p === '3') return 'low';
    return 'medium';
  }

  /**
   * Normalize confidence score
   */
  private normalizeConfidence(confidence: any): number {
    const c = Number(confidence);
    if (isNaN(c)) return 75;
    return Math.max(0, Math.min(100, c));
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Extract participants from response and transcript
   */
  private extractParticipants(participants: any[], transcript: TranscriptContent): string[] {
    const allParticipants = new Set<string>();
    
    // Add from Claude's response
    if (Array.isArray(participants)) {
      participants.forEach(p => {
        if (typeof p === 'string' && p.trim()) {
          allParticipants.add(p.trim());
        }
      });
    }

    // Add from transcript sections
    if (transcript.sections) {
      transcript.sections.forEach(section => {
        if (section.speaker && section.speaker !== 'Unknown') {
          allParticipants.add(section.speaker);
        }
      });
    }

    return Array.from(allParticipants);
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(tasks: ExtractedTask[]): number {
    if (tasks.length === 0) return 0;
    const sum = tasks.reduce((acc, task) => acc + task.confidence, 0);
    return Math.round(sum / tasks.length);
  }

  /**
   * Deduplicate similar tasks
   */
  private deduplicateTasks(tasks: ExtractedTask[]): ExtractedTask[] {
    const uniqueTasks: ExtractedTask[] = [];
    const seenDescriptions = new Set<string>();

    for (const task of tasks) {
      const normalized = task.description.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Check for duplicates
      let isDuplicate = false;
      for (const seen of seenDescriptions) {
        if (this.calculateSimilarity(normalized, seen) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueTasks.push(task);
        seenDescriptions.add(normalized);
      }
    }

    return uniqueTasks;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Fallback extraction without AI
   */
  private fallbackExtraction(transcript: TranscriptContent): TaskExtractionResult {
    logInfo('Using pattern-based fallback extraction');
    
    // Use tasks already extracted by transcriptParser
    const existingTasks = transcript.extractedTasks || [];
    
    // Convert to our format with confidence scoring
    const tasks: ExtractedTask[] = existingTasks.map(taskText => ({
      description: taskText,
      assignee: 'me',
      priority: this.guessPriority(taskText),
      confidence: this.calculatePatternConfidence(taskText),
      category: this.guessCategory(taskText),
      rawText: taskText
    }));

    // Extract participants
    const participants = new Set<string>();
    if (transcript.sections) {
      transcript.sections.forEach(s => {
        if (s.speaker) participants.add(s.speaker);
      });
    }

    return {
      tasks: tasks.slice(0, 20), // Limit to top 20 tasks
      summary: `Extracted ${tasks.length} potential tasks from meeting transcript`,
      participants: Array.from(participants),
      meetingDate: transcript.metadata?.creationDate || new Date(),
      keyDecisions: [],
      nextSteps: [],
      confidence: 60
    };
  }

  /**
   * Guess priority based on keywords
   */
  private guessPriority(text: string): 'high' | 'medium' | 'low' {
    const lower = text.toLowerCase();
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical')) {
      return 'high';
    }
    if (lower.includes('when possible') || lower.includes('eventually') || lower.includes('nice to have')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Calculate confidence based on patterns
   */
  private calculatePatternConfidence(text: string): number {
    let confidence = 50;
    
    const highConfidencePatterns = [
      /^I will/i,
      /^I'll/i,
      /action item/i,
      /assigned to/i,
    ];
    
    const mediumConfidencePatterns = [
      /we should/i,
      /need to/i,
      /have to/i,
      /let's/i,
    ];

    for (const pattern of highConfidencePatterns) {
      if (pattern.test(text)) confidence += 20;
    }
    
    for (const pattern of mediumConfidencePatterns) {
      if (pattern.test(text)) confidence += 10;
    }

    return Math.min(confidence, 95);
  }

  /**
   * Guess category based on keywords
   */
  private guessCategory(text: string): string {
    const lower = text.toLowerCase();
    
    if (/\b(code|implement|fix|bug|api|test)\b/.test(lower)) return 'engineering';
    if (/\b(design|ui|ux|mockup|figma)\b/.test(lower)) return 'design';
    if (/\b(doc|document|readme|wiki)\b/.test(lower)) return 'documentation';
    if (/\b(email|slack|meeting|call|present)\b/.test(lower)) return 'communication';
    if (/\b(feature|product|user|customer)\b/.test(lower)) return 'product';
    
    return 'other';
  }

  /**
   * Format tasks for Obsidian
   */
  formatTasksForObsidian(tasks: ExtractedTask[]): string[] {
    return tasks.map(task => {
      const priorityEmoji = {
        high: '🔴',
        medium: '🟡', 
        low: '🟢'
      }[task.priority];

      const dueStr = task.dueDate ? ` 📅 ${task.dueDate}` : '';
      const assigneeStr = task.assignee !== 'me' ? ` @${task.assignee}` : '';
      const confidenceStr = task.confidence < 70 ? ' ❓' : '';
      
      return `- [ ] ${priorityEmoji} ${task.description}${assigneeStr}${dueStr}${confidenceStr}`;
    });
  }
}

// Export singleton instance
export const claudeTaskExtractor = new ClaudeTaskExtractor();